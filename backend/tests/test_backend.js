const assert = require('assert');
const path = require('path');
const http = require('http');

// Setup test environment overrides
process.env.DB_PATH = path.resolve(__dirname, '../../data/test_zunotwin.db');
process.env.PORT = '5055';
process.env.MQTT_ENABLED = 'false';
process.env.HEARTBEAT_TIMEOUT_SECONDS = '5.0';
process.env.NODE_ENV = 'test';

const { app, server } = require('../src/server');
const { dbAsync } = require('../src/database/connection');
const deviceRegistry = require('../src/hardware/deviceRegistry');
const thresholds = require('../src/config/thresholds');
const alertService = require('../src/services/alertService');
const automationService = require('../src/services/automationService');
const sensorService = require('../src/services/sensorService');

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING ZUNO TWIN BACKEND INTEGRATION TEST SUITE  ');
  console.log('====================================================');

  try {
    // Test 1: Service Root Endpoint
    const rootRes = await fetchJson('http://127.0.0.1:5055/');
    assert.strictEqual(rootRes.platform, 'ZUNO TWIN — Smart AIoT Aquaculture Platform');
    assert.strictEqual(rootRes.status, 'ONLINE');
    console.log('[PASS] Test 1: Root endpoint responding correctly.');

    // Test 2: Database Initialization & Seeding
    const readingCount = await dbAsync.get('SELECT COUNT(*) as c FROM sensor_readings');
    assert(readingCount.c > 0, 'Database should contain seeded historical readings');
    const eqCount = await dbAsync.get('SELECT COUNT(*) as c FROM equipment_states');
    assert.strictEqual(eqCount.c, 5, 'All 5 default equipment devices should exist');
    console.log(`[PASS] Test 2: Database tables initialized with ${readingCount.c} historical records and 5 equipment states.`);

    // Test 3: Hardware Failsafe & Stale Handling
    deviceRegistry.recordHeartbeat('ESP32-REAL-001', Date.now());
    let status = deviceRegistry.getStatus();
    assert.strictEqual(status.hardwareConnected, true, 'Device should be CONNECTED after fresh heartbeat');
    
    // Simulate expired heartbeat (> 5s)
    deviceRegistry.devices['ESP32-REAL-001'].lastHeartbeat = Date.now() - 7000;
    deviceRegistry.evaluateHealth();
    status = deviceRegistry.getStatus();
    assert.strictEqual(status.hardwareConnected, false, 'Device must be declared DISCONNECTED when delta > 5s');
    assert(status.failReason.includes('failsafe limit'), 'Failsafe reason must be explicitly recorded');
    console.log('[PASS] Test 3: Hardware failsafe verified. Delta > 5.0s triggered DISCONNECTED state.');

    // Test 4: Sensor Ingestion with Missing Values (No Fake Data Rule)
    const testPayload = {
      device_id: 'ESP32-REAL-001',
      tank_id: 1,
      temperature: 29.2,
      ph: 8.1,
      turbidity: 18.5,
      tds_ppm: 1650.0,
      dissolved_oxygen: null, // Disconnected probe
      ammonia: null           // Disconnected probe
    };

    const ingestRes = await postJson('http://127.0.0.1:5055/api/sensors/data', testPayload);
    assert.strictEqual(ingestRes.status, 'success');

    const latest = await sensorService.getLatestCardSummary('tank-01');
    assert.strictEqual(latest.cards.temperature.value, 29.2);
    assert.strictEqual(latest.cards.ph.value, 8.1);
    assert.strictEqual(latest.cards.ammonia.value, null, 'Null sensor values must remain null (no fabrication)');
    assert.strictEqual(latest.cards.ammonia.status, 'UNAVAILABLE');
    console.log('[PASS] Test 4: Sensor ingestion handled missing probes honestly without fabricating numbers.');

    // Test 5: Alert Threshold Evaluation (Critical & Warning triggers)
    const criticalReading = {
      tankId: 'tank-01',
      timestamp: Date.now(),
      source: 'test_bench',
      measurements: {
        ph: 9.35, // Critical High (> 9.2)
        temperature: 29.0,
        turbidity: 20.0,
        tds: 1600.0,
        salinity: 22.0,
        alkalinity: 150.0,
        ammonia: 0.65 // Critical High (> 0.50)
      }
    };

    const alerts = await alertService.evaluateReadings(criticalReading);
    assert(alerts.length >= 2, 'Should create alerts for both critical pH and critical Ammonia');
    assert(alerts.some(a => a.parameter === 'ph' && a.severity === 'CRITICAL'));
    assert(alerts.some(a => a.parameter === 'ammonia' && a.severity === 'CRITICAL'));
    console.log(`[PASS] Test 5: Alert engine detected ${alerts.length} critical threshold violations accurately.`);

    // Test 6: Alert Acknowledgement Workflow
    const activeAlerts = await alertService.getActiveAlerts('tank-01');
    const firstAlertId = activeAlerts[0].id;
    const ackRes = await alertService.acknowledgeAlert(firstAlertId);
    assert.strictEqual(ackRes.success, true);
    const updatedAlert = await dbAsync.get('SELECT acknowledged FROM alerts WHERE id = ?', [firstAlertId]);
    assert.strictEqual(updatedAlert.acknowledged, 1);
    console.log('[PASS] Test 6: Alert acknowledgement persisted to database.');

    // Test 7: Equipment Safety & Operating Modes
    const equipList = await automationService.getEquipmentList();
    assert.strictEqual(equipList.length, 5);
    
    // Toggle mode to MANUAL
    const modeRes = await automationService.setEquipmentMode('aerator_01', 'MANUAL');
    assert.strictEqual(modeRes.mode, 'MANUAL');

    // Force connected status for command test
    deviceRegistry.devices['ESP32-REAL-001'].status = 'CONNECTED';
    deviceRegistry.devices['ESP32-REAL-001'].lastHeartbeat = Date.now();

    const cmdRes = await automationService.sendEquipmentCommand('aerator_01', 'ON', 'UNIT_TEST', true);
    assert.strictEqual(cmdRes.state, 'ON');

    // Emergency Stop
    const estopRes = await automationService.emergencyStop();
    assert(estopRes.stoppedCount >= 1, 'Emergency stop should shut down active equipment');
    const aeratorAfter = await dbAsync.get("SELECT state FROM equipment_states WHERE device_id = 'aerator_01'");
    assert.strictEqual(aeratorAfter.state, 'OFF');
    console.log('[PASS] Test 7: Equipment command authorization and Emergency Stop successfully verified.');

    // Test 8: Historical Trend Timeseries Query
    const histRes = await sensorService.getHistory('tank-01', '24h');
    assert.strictEqual(histRes.period, '24h');
    assert(histRes.data.length > 0, 'Historical series must contain time-series points');
    console.log(`[PASS] Test 8: Historical timeseries query returned ${histRes.data.length} data points.`);

    // Test 9: Digital Twin Aggregated State
    const dtStateRes = await fetchJson('http://127.0.0.1:5055/api/digital-twin/state');
    assert.strictEqual(dtStateRes.success, true);
    assert(dtStateRes.data.digitalTwinMeshParams !== undefined);
    assert(dtStateRes.data.waterQuality !== undefined);
    console.log('[PASS] Test 9: Digital Twin 3D mesh aggregation endpoint operational.');

    // Test 10: Statistical Water Quality Report & CSV Export
    const reportRes = await fetchJson('http://127.0.0.1:5055/api/reports/water-quality?hours=24');
    assert.strictEqual(reportRes.success, true);
    assert(reportRes.report.statistics.total_samples > 0);
    console.log('[PASS] Test 10: Statistical summary report computed correctly.');

    console.log('\n====================================================');
    console.log('  ALL 10 BACKEND INTEGRATION TESTS PASSED (100%)    ');
    console.log('====================================================');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST FAILURE]', err);
    server.close();
    process.exit(1);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data)); }
      });
    }).on('error', reject);
  });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(respData)); }
        catch (e) { reject(new Error('Invalid JSON: ' + respData)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Allow server 500ms to open port
setTimeout(runTests, 500);
