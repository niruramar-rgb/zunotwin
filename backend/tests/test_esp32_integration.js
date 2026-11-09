const assert = require('assert');
const path = require('path');
const http = require('http');

// Setup test environment overrides
process.env.DB_PATH = path.resolve(__dirname, '../../data/zunotwin.db');
process.env.PORT = '5066';
process.env.NODE_ENV = 'test';
process.env.MQTT_ENABLED = 'false';

const { app, server } = require('../src/server');
const { dbAsync } = require('../src/database/connection');
const deviceRegistry = require('../src/hardware/deviceRegistry');
const serialBridge = require('../src/hardware/serialBridge');
const sensorService = require('../src/services/sensorService');
const alertService = require('../src/services/alertService');
const automationService = require('../src/services/automationService');

async function runEsp32IntegrationTests() {
  console.log('================================================================');
  console.log('  RUNNING ZUNO TWIN — ESP32 HARDWARE INTEGRATION TEST SUITE     ');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    passed++;
    total++;
    console.log(`[PASS] Test ${total}: ${testName}`);
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Valid ESP32 Telemetry (JSON format)
    // -------------------------------------------------------------
    const validJsonLine = JSON.stringify({
      device_id: 'ESP32-REAL-001',
      temperature: 28.45,
      humidity: 86.5,
      ph_raw_adc: 132,
      ph_voltage: 0.106,
      do_raw_adc: 0,
      do_voltage: 0.000,
      tds_raw_adc: 0,
      tds_voltage: 0.000,
      turbidity_raw_adc: 3875,
      turbidity_voltage: 3.122,
      ldr_state: 1,
      relay_status: 'OFF'
    });

    let dispatchedPayload = null;
    serialBridge.setSensorCallback((payload) => {
      dispatchedPayload = payload;
      sensorService.processReading(payload);
    });

    serialBridge.handleLine(validJsonLine);

    assert(dispatchedPayload !== null, 'JSON telemetry must be parsed and dispatched');
    assert.strictEqual(dispatchedPayload.measurements.temperature, 28.45);
    assert.strictEqual(dispatchedPayload.measurements.humidity, 86.5);
    assert.strictEqual(dispatchedPayload.raw.ph_raw_adc, 132);
    assert.strictEqual(dispatchedPayload.raw.turbidity_raw_adc, 3875);
    assert.strictEqual(dispatchedPayload.measurements.ph, null, 'Uncalibrated pH value must remain null');
    recordPass('Valid ESP32 JSON telemetry correctly parsed and validated');

    // -------------------------------------------------------------
    // Test 2: Valid ESP32 Structured Text Block Format
    // -------------------------------------------------------------
    dispatchedPayload = null;
    const structuredBlockLines = [
      '======= SHRIMPSENSE READINGS =======',
      'Water temperature: 28.25 C',
      'Air humidity: 87.0 %',
      'pH raw ADC: 129 | 0.104 V',
      'DO raw ADC: 0 | 0.000 V',
      'TDS raw ADC: 0 | 0.000 V',
      'Turbidity raw ADC: 3869 | 3.118 V',
      'LDR digital state: 1',
      'Aerator command: OFF',
      'WiFi: DISCONNECTED - RETRYING',
      'Temperature status: TEMP WITHIN LIMIT',
      'pH/DO/TDS/turbidity status: UNCALIBRATED',
      '==================================='
    ];

    for (const line of structuredBlockLines) {
      serialBridge.handleLine(line);
    }

    assert(dispatchedPayload !== null, 'Structured block telemetry must be parsed and dispatched');
    assert.strictEqual(dispatchedPayload.measurements.temperature, 28.25);
    assert.strictEqual(dispatchedPayload.measurements.humidity, 87.0);
    assert.strictEqual(dispatchedPayload.raw.ph_raw_adc, 129);
    assert.strictEqual(dispatchedPayload.raw.ph_voltage, 0.104);
    assert.strictEqual(dispatchedPayload.raw.turbidity_raw_adc, 3869);
    assert.strictEqual(dispatchedPayload.raw.relay_status, 'OFF');
    recordPass('Structured text telemetry block from physical ESP32 parsed successfully');

    // -------------------------------------------------------------
    // Test 3: Malformed JSON Handling
    // -------------------------------------------------------------
    dispatchedPayload = null;
    const malformedLines = [
      '{malformed_json_not_valid}',
      '{"device_id": "ESP32", "temp": incomplete...',
      'random serial noise %^&*#$@!~',
      '{"temperature": "invalid_string_not_a_number"}'
    ];

    for (const mLine of malformedLines) {
      // Must not throw unhandled exception
      assert.doesNotThrow(() => {
        serialBridge.handleLine(mLine);
      }, 'Malformed serial lines must be safely discarded without crashing');
    }
    recordPass('Malformed JSON and serial noise safely ignored without server crash');

    // -------------------------------------------------------------
    // Test 4: Missing Sensor Values / Disconnected Probes
    // -------------------------------------------------------------
    dispatchedPayload = null;
    const disconnectedSensorBlock = [
      '======= SHRIMPSENSE READINGS =======',
      'Water temperature: SENSOR ERROR',
      'Air humidity: SENSOR ERROR',
      'pH raw ADC: 0 | 0.000 V',
      'DO raw ADC: 0 | 0.000 V',
      'TDS raw ADC: 0 | 0.000 V',
      'Turbidity raw ADC: 0 | 0.000 V',
      'LDR digital state: 0',
      'Aerator command: OFF',
      '==================================='
    ];

    for (const line of disconnectedSensorBlock) {
      serialBridge.handleLine(line);
    }

    assert(dispatchedPayload !== null);
    assert.strictEqual(dispatchedPayload.measurements.temperature, null, 'Failed sensor must map to null');
    assert.strictEqual(dispatchedPayload.measurements.humidity, null, 'Failed humidity must map to null');
    assert.strictEqual(dispatchedPayload.raw.do_raw_adc, 0, 'Raw ADC 0 preserved for open-circuit detection');
    recordPass('Missing sensor values and SENSOR ERROR mapped strictly to null (no mock data)');

    // -------------------------------------------------------------
    // Test 5: Offline Detection After 10 Seconds Without Telemetry
    // -------------------------------------------------------------
    deviceRegistry.recordHeartbeat('ESP32-REAL-001', Date.now(), 'COM13');
    let hwStatus = deviceRegistry.getStatus();
    assert.strictEqual(hwStatus.hardwareConnected, true, 'Device should be CONNECTED after fresh heartbeat');
    assert.strictEqual(hwStatus.isStale, false, 'Fresh data must not be stale');

    // Simulate 11 seconds elapsed without telemetry (> 10s threshold)
    deviceRegistry.devices['ESP32-REAL-001'].lastHeartbeat = Date.now() - 11000;
    deviceRegistry.evaluateHealth();
    hwStatus = deviceRegistry.getStatus();

    assert.strictEqual(hwStatus.hardwareConnected, false, 'Device must be marked OFFLINE when > 10s without telemetry');
    assert.strictEqual(hwStatus.deviceStatus, 'DISCONNECTED');
    assert.strictEqual(hwStatus.isStale, true);
    assert(hwStatus.failReason.includes('failsafe limit') || hwStatus.failReason.includes('threshold') || hwStatus.failReason.includes('telemetry'));
    recordPass('Offline detection verified: Device declared OFFLINE after 10s without telemetry');

    // -------------------------------------------------------------
    // Test 6: Connected and Disconnected Alerts Generation
    // -------------------------------------------------------------
    // Disconnect alert
    await deviceRegistry.recordDisconnect('ESP32-REAL-001', 'USB cable unplugged simulation');
    const alertsAfterDisconnect = await alertService.getActiveAlerts('tank-01', 5);
    const disconnectAlert = alertsAfterDisconnect.find(a => a.parameter === 'hardware_connectivity' && a.severity === 'CRITICAL');
    assert(disconnectAlert !== undefined, 'A CRITICAL alert must be generated on device disconnection');
    assert(disconnectAlert.message.includes('OFFLINE'));

    // Reconnect alert
    await deviceRegistry.recordHeartbeat('ESP32-REAL-001', Date.now(), 'COM13');
    const alertsAfterConnect = await alertService.getActiveAlerts('tank-01', 5);
    const connectAlert = alertsAfterConnect.find(a => a.parameter === 'hardware_connectivity' && a.severity === 'INFO');
    assert(connectAlert !== undefined, 'An INFO alert must be generated on device connection');
    assert(connectAlert.message.includes('CONNECTED'));
    recordPass('Connected and Disconnected alerts generated and logged correctly');

    // -------------------------------------------------------------
    // Test 7: Sensor Threshold Alerts and Automatic Recovery
    // -------------------------------------------------------------
    // Trigger Critical Water Temp (> 35.0 °C)
    const hotReading = {
      tankId: 'tank-01',
      timestamp: Date.now(),
      measurements: {
        temperature: 36.5, // Exceeds criticalHigh (35.0)
        humidity: 80.0
      }
    };
    const createdAlerts = await alertService.evaluateReadings(hotReading);
    assert(createdAlerts.some(a => a.parameter === 'temperature' && a.severity === 'CRITICAL'), 'Critical temperature alert must trigger');

    // Trigger Recovery: Water temp returns to 28.5 °C (Nominal)
    const nominalReading = {
      tankId: 'tank-01',
      timestamp: Date.now() + 1000,
      measurements: {
        temperature: 28.5, // Safe range
        humidity: 80.0
      }
    };
    const recoveryAlerts = await alertService.evaluateReadings(nominalReading);
    assert(recoveryAlerts.some(a => a.parameter === 'temperature' && a.severity === 'NORMAL' && a.message.includes('RECOVERY')), 'Recovery notification must trigger when returning to nominal');
    recordPass('Sensor threshold alerts and automatic recovery notifications verified');

    // -------------------------------------------------------------
    // Test 8: Aerator Command Validation & Acknowledgement
    // -------------------------------------------------------------
    // Failsafe check: when device is offline, command must be blocked
    deviceRegistry.devices['ESP32-REAL-001'].status = 'DISCONNECTED';
    let blocked = false;
    try {
      await automationService.sendEquipmentCommand('aerator_01', 'ON', 'TEST_RUN');
    } catch (e) {
      blocked = true;
      assert(e.message.includes('disconnected') || e.message.includes('failsafe'));
    }
    assert(blocked, 'Aerator command must be blocked when hardware is OFFLINE');

    // Valid command validation when hardware is connected
    deviceRegistry.devices['ESP32-REAL-001'].status = 'CONNECTED';
    deviceRegistry.devices['ESP32-REAL-001'].lastHeartbeat = Date.now();

    const cmdResult = await automationService.sendEquipmentCommand('aerator_01', 'OFF', 'TEST_RUN', true);
    assert.strictEqual(cmdResult.success, true);
    assert.strictEqual(cmdResult.state, 'OFF');

    // Invalid target state check
    let invalidBlocked = false;
    try {
      await automationService.sendEquipmentCommand('aerator_01', 'EXPLODE');
    } catch (_) {
      invalidBlocked = true;
    }
    assert(invalidBlocked, 'Invalid command target states must be rejected');
    recordPass('Aerator command validation, acknowledgement, and safety interlocks verified');

    // -------------------------------------------------------------
    // Test 9: Absence of Mock Readings When Hardware Unavailable
    // -------------------------------------------------------------
    deviceRegistry.devices['ESP32-REAL-001'].status = 'DISCONNECTED';
    deviceRegistry.devices['ESP32-REAL-001'].lastHeartbeat = Date.now() - 20000;
    deviceRegistry.evaluateHealth();

    const summaryWhileOffline = await sensorService.getLatestCardSummary('tank-01');
    assert.strictEqual(summaryWhileOffline.hardwareConnected, false);
    assert.strictEqual(summaryWhileOffline.cards.temperature.status, 'OFFLINE');
    assert.strictEqual(summaryWhileOffline.cards.temperature.value, null, 'No fake or cached value reported as live when offline');
    assert.strictEqual(summaryWhileOffline.cards.ph.status, 'OFFLINE');
    assert.strictEqual(summaryWhileOffline.cards.ph.value, null);
    recordPass('Absence of mock readings confirmed: All cards declare OFFLINE / null when hardware is down');

    // -------------------------------------------------------------
    // Test 10: Endpoints Verification (/api/health, /api/device/status, /api/telemetry/latest, /api/aerator)
    // -------------------------------------------------------------
    const healthRes = await fetchJson('http://127.0.0.1:5066/api/health');
    assert.strictEqual(healthRes.status, 'ONLINE');
    assert.strictEqual(healthRes.platform, 'ZUNO TWIN — Smart AIoT Aquaculture Platform');

    const deviceRes = await fetchJson('http://127.0.0.1:5066/api/device/status');
    assert.strictEqual(deviceRes.success, true);
    assert(deviceRes.data.deviceId !== undefined);

    const telemetryRes = await fetchJson('http://127.0.0.1:5066/api/telemetry/latest');
    assert.strictEqual(telemetryRes.success, true);
    assert(telemetryRes.data.cards !== undefined);

    recordPass('Suggested endpoints (/api/health, /api/device/status, /api/telemetry/latest) verified');

    console.log('\n================================================================');
    console.log(`  ALL ${passed}/${total} ESP32 INTEGRATION TESTS PASSED (100%)       `);
    console.log('================================================================');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[INTEGRATION TEST FAILURE]', err);
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

setTimeout(runEsp32IntegrationTests, 600);
