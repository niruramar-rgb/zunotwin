const { dbAsync } = require('../database/connection');
const env = require('../config/env');
const thresholds = require('../config/thresholds');
const sensorsConfig = require('../config/sensors');
const deviceRegistry = require('../hardware/deviceRegistry');
const alertService = require('./alertService');
const automationService = require('./automationService');
const calibrationService = require('./calibrationService');

class SensorService {
  constructor() {
    this.socketEmitter = null;
    this.latestReading = null;
  }

  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  async processReading(normalizedPayload) {
    const { tankId, timestamp, measurements, source, raw } = normalizedPayload;
    const m = measurements;
    const r = raw || {};

    // 1. Persist to SQLite with raw ADC and voltage diagnostics
    try {
      await dbAsync.run(`
        INSERT INTO sensor_readings (
          tank_id, timestamp, ph, temperature, turbidity, tds,
          salinity, alkalinity, ammonia, dissolved_oxygen, humidity,
          ph_raw_adc, do_raw_adc, tds_raw_adc, turbidity_raw_adc, ldr_state,
          ph_voltage, do_voltage, tds_voltage, turbidity_voltage,
          source, raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tankId,
        timestamp,
        m.ph,
        m.temperature,
        m.turbidity,
        m.tds,
        m.salinity,
        m.alkalinity,
        m.ammonia,
        m.dissolved_oxygen,
        m.humidity,
        r.ph_raw_adc !== undefined ? r.ph_raw_adc : null,
        r.do_raw_adc !== undefined ? r.do_raw_adc : null,
        r.tds_raw_adc !== undefined ? r.tds_raw_adc : null,
        r.turbidity_raw_adc !== undefined ? r.turbidity_raw_adc : null,
        r.ldr_state !== undefined ? r.ldr_state : null,
        r.ph_voltage !== undefined ? r.ph_voltage : null,
        r.do_voltage !== undefined ? r.do_voltage : null,
        r.tds_voltage !== undefined ? r.tds_voltage : null,
        r.turbidity_voltage !== undefined ? r.turbidity_voltage : null,
        source,
        raw ? JSON.stringify(raw) : null
      ]);
    } catch (dbErr) {
      console.warn('[SensorService] Insert error (fallback insert):', dbErr.message);
      await dbAsync.run(`
        INSERT INTO sensor_readings (tank_id, timestamp, ph, temperature, turbidity, tds, salinity, alkalinity, ammonia, dissolved_oxygen, humidity, source, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tankId, timestamp, m.ph, m.temperature, m.turbidity, m.tds, m.salinity, m.alkalinity, m.ammonia, m.dissolved_oxygen, m.humidity, source, raw ? JSON.stringify(raw) : null
      ]);
    }

    this.latestReading = normalizedPayload;

    // 2. Evaluate Alerts (with deduplication & recovery)
    await alertService.evaluateReadings(normalizedPayload);

    // 3. Evaluate Equipment Automations
    await automationService.evaluateAutomations(normalizedPayload);

    // 4. Emit to connected dashboards
    if (this.socketEmitter) {
      const summary = await this.getLatestCardSummary(tankId);
      this.socketEmitter('sensor-reading', {
        reading: normalizedPayload,
        cards: summary,
        deviceStatus: deviceRegistry.getStatus()
      });
    }

    return normalizedPayload;
  }

  async getLatestCardSummary(tankId = env.DEFAULT_TANK_ID) {
    const hwStatus = deviceRegistry.getStatus();
    const isOffline = !hwStatus.hardwareConnected || hwStatus.isStale;

    // Get latest row from database
    const row = await dbAsync.get(
      'SELECT * FROM sensor_readings WHERE tank_id = ? ORDER BY timestamp DESC LIMIT 1',
      [tankId]
    );

    // Fetch previous 1-hour reading to compute actual historical trend
    const oneHourAgo = (row ? row.timestamp : Date.now()) - (60 * 60 * 1000);
    const prevRow = await dbAsync.get(
      'SELECT * FROM sensor_readings WHERE tank_id = ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1',
      [tankId, oneHourAgo]
    );

    const cards = {};

    // 1. Water Temperature (Calibrated from DS18B20 OneWire)
    const tempVal = (!isOffline && row && row.temperature !== null) ? row.temperature : null;
    let tempStatus = 'UNAVAILABLE';
    if (!isOffline && tempVal !== null) {
      if (tempVal < 20.0 || tempVal > 35.0) tempStatus = 'CRITICAL';
      else if (tempVal < 24.0 || tempVal > 32.0) tempStatus = 'WARNING';
      else tempStatus = 'OPTIMAL';
    }

    cards['temperature'] = {
      key: 'temperature',
      label: 'Water Temperature',
      calibrated: true,
      value: tempVal !== null ? Number(tempVal.toFixed(1)) : null,
      unit: '°C',
      status: isOffline ? 'OFFLINE' : (tempVal === null ? 'UNAVAILABLE' : tempStatus),
      statusReason: isOffline ? 'Hardware disconnected or stale' : (tempVal === null ? 'Sensor Disconnected / ERR' : 'DS18B20 OneWire Live'),
      hardwareSource: 'DS18B20 Waterproof (GPIO 23)',
      acceptableMin: 24.0,
      acceptableMax: 32.0,
      optimalMin: 28.0,
      optimalMax: 30.5,
      trend: isOffline || tempVal === null ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && tempVal !== null) ? row.timestamp : null
    };

    // 2. Air Humidity (Calibrated from DHT11)
    const humVal = (!isOffline && row && row.humidity !== null) ? row.humidity : null;
    let humStatus = 'UNAVAILABLE';
    if (!isOffline && humVal !== null) {
      if (humVal < 30.0 || humVal > 95.0) humStatus = 'CRITICAL';
      else if (humVal < 45.0 || humVal > 90.0) humStatus = 'WARNING';
      else humStatus = 'OPTIMAL';
    }

    cards['humidity'] = {
      key: 'humidity',
      label: 'Air Humidity',
      calibrated: true,
      value: humVal !== null ? Number(humVal.toFixed(1)) : null,
      unit: '%',
      status: isOffline ? 'OFFLINE' : (humVal === null ? 'UNAVAILABLE' : humStatus),
      statusReason: isOffline ? 'Hardware disconnected' : (humVal === null ? 'Sensor Disconnected / ERR' : 'DHT11 Ambient Live'),
      hardwareSource: 'DHT11 Sensor (GPIO 4)',
      acceptableMin: 50.0,
      acceptableMax: 85.0,
      optimalMin: 60.0,
      optimalMax: 80.0,
      trend: isOffline || humVal === null ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && humVal !== null) ? row.timestamp : null
    };

    // 3. pH Sensor (Calibrated reading if available, else Raw ADC)
    const phRaw = (!isOffline && row) ? row.ph_raw_adc : null;
    const phVolt = (!isOffline && row) ? (row.ph_voltage !== null ? row.ph_voltage : (phRaw !== null ? Number((phRaw * 3.3 / 4095.0).toFixed(3)) : null)) : null;
    const phCalibrated = phVolt !== null ? calibrationService.computeCalibratedValue('ph', phVolt, tempVal) : null;
    const phVal = phCalibrated !== null ? phCalibrated : ((!isOffline && row && row.ph !== null) ? row.ph : null);
    const phValid = (phVal !== null) || (phRaw !== null && phRaw > 10 && phRaw < 4080);
    const phCalProfile = calibrationService.get('ph');

    cards['ph'] = {
      key: 'ph',
      label: 'pH Level',
      calibrated: phVal !== null,
      value: phVal !== null ? Number(phVal.toFixed(2)) : null,
      unit: phVal !== null ? 'pH' : 'ADC',
      rawADC: phRaw,
      voltage: phVolt !== null ? Number(phVolt.toFixed(3)) : null,
      calibrationProfile: phCalProfile,
      status: isOffline ? 'OFFLINE' : (phVal !== null ? (phVal < 7.2 || phVal > 8.8 ? 'WARNING' : 'OPTIMAL') : (phValid ? 'UNCALIBRATED' : 'DISCONNECTED')),
      statusReason: isOffline ? 'Hardware disconnected' : (phCalibrated !== null ? `Calibrated (${phCalProfile?.method || 'Active'})` : (phVal !== null ? 'Calibrated reading' : (phValid ? 'Raw ADC valid (Uncalibrated probe)' : 'Probe open-circuit / near rail'))),
      hardwareSource: 'Analog pH Module (GPIO 32)',
      acceptableMin: 7.5,
      acceptableMax: 8.5,
      optimalMin: 7.8,
      optimalMax: 8.3,
      trend: isOffline || (phVal === null && phRaw === null) ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && (phVal !== null || phRaw !== null)) ? row.timestamp : null
    };

    // 4. Turbidity Sensor (Calibrated reading if available, else Raw ADC)
    const turbRaw = (!isOffline && row) ? row.turbidity_raw_adc : null;
    const turbVolt = (!isOffline && row) ? (row.turbidity_voltage !== null ? row.turbidity_voltage : (turbRaw !== null ? Number((turbRaw * 3.3 / 4095.0).toFixed(3)) : null)) : null;
    const turbCalibrated = turbVolt !== null ? calibrationService.computeCalibratedValue('turbidity', turbVolt, tempVal) : null;
    const turbVal = turbCalibrated !== null ? turbCalibrated : ((!isOffline && row && row.turbidity !== null) ? row.turbidity : null);
    const turbValid = (turbVal !== null) || (turbRaw !== null && turbRaw > 10);
    const turbCalProfile = calibrationService.get('turbidity');

    cards['turbidity'] = {
      key: 'turbidity',
      label: 'Turbidity',
      calibrated: turbVal !== null,
      value: turbVal !== null ? Number(turbVal.toFixed(1)) : null,
      unit: turbVal !== null ? 'NTU' : 'ADC',
      rawADC: turbRaw,
      voltage: turbVolt !== null ? Number(turbVolt.toFixed(3)) : null,
      calibrationProfile: turbCalProfile,
      status: isOffline ? 'OFFLINE' : (turbVal !== null ? (turbVal > 40 ? 'WARNING' : 'OPTIMAL') : (turbValid ? 'UNCALIBRATED' : 'DISCONNECTED')),
      statusReason: isOffline ? 'Hardware disconnected' : (turbCalibrated !== null ? `Calibrated (${turbCalProfile?.method || 'Active'})` : (turbVal !== null ? 'Calibrated reading' : (turbValid ? 'Raw ADC valid (Uncalibrated probe)' : 'Optical sensor open circuit'))),
      hardwareSource: 'Optical Sensor SKU:SEN0189 (GPIO 35)',
      acceptableMin: 10.0,
      acceptableMax: 40.0,
      optimalMin: 15.0,
      optimalMax: 30.0,
      trend: isOffline || (turbVal === null && turbRaw === null) ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && (turbVal !== null || turbRaw !== null)) ? row.timestamp : null
    };

    // 5. TDS Sensor (Calibrated reading if available, else Raw ADC)
    const tdsRaw = (!isOffline && row) ? row.tds_raw_adc : null;
    const tdsVolt = (!isOffline && row) ? (row.tds_voltage !== null ? row.tds_voltage : (tdsRaw !== null ? Number((tdsRaw * 3.3 / 4095.0).toFixed(3)) : null)) : null;
    const tdsCalibrated = tdsVolt !== null ? calibrationService.computeCalibratedValue('tds', tdsVolt, tempVal) : null;
    const tdsVal = tdsCalibrated !== null ? tdsCalibrated : ((!isOffline && row && row.tds !== null) ? row.tds : null);
    const tdsValid = (tdsVal !== null) || (tdsRaw !== null && tdsRaw > 10 && tdsRaw < 4080);
    const tdsCalProfile = calibrationService.get('tds');

    cards['tds'] = {
      key: 'tds',
      label: 'TDS (Dissolved Solids)',
      calibrated: tdsVal !== null,
      value: tdsVal !== null ? Number(tdsVal.toFixed(0)) : null,
      unit: tdsVal !== null ? 'ppm' : 'ADC',
      rawADC: tdsRaw,
      voltage: tdsVolt !== null ? Number(tdsVolt.toFixed(3)) : null,
      calibrationProfile: tdsCalProfile,
      status: isOffline ? 'OFFLINE' : (tdsVal !== null ? (tdsVal < 1200 || tdsVal > 2400 ? 'WARNING' : 'OPTIMAL') : (tdsValid ? 'UNCALIBRATED' : (tdsRaw === 0 ? 'DISCONNECTED' : 'UNCALIBRATED'))),
      statusReason: isOffline ? 'Hardware disconnected' : (tdsCalibrated !== null ? `Calibrated (${tdsCalProfile?.method || 'Active'})` : (tdsVal !== null ? 'Calibrated reading' : (tdsRaw === 0 ? 'Probe wire unplugged (0V)' : 'Raw ADC valid (Uncalibrated probe)'))),
      hardwareSource: 'Analog TDS Meter (GPIO 34)',
      acceptableMin: 1200.0,
      acceptableMax: 2400.0,
      optimalMin: 1500.0,
      optimalMax: 2000.0,
      trend: isOffline || (tdsVal === null && tdsRaw === null) ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && (tdsVal !== null || tdsRaw !== null)) ? row.timestamp : null
    };

    // 6. Dissolved Oxygen Sensor (Calibrated reading if available, else Raw ADC)
    const doVal = (!isOffline && row && row.dissolved_oxygen !== null) ? row.dissolved_oxygen : null;
    const doRaw = (!isOffline && row) ? row.do_raw_adc : null;
    const doVolt = (!isOffline && row) ? row.do_voltage : null;
    const doValid = (doVal !== null) || (doRaw !== null && doRaw > 10 && doRaw < 4080);

    cards['dissolved_oxygen'] = {
      key: 'dissolved_oxygen',
      label: 'Dissolved Oxygen',
      calibrated: doVal !== null,
      value: doVal !== null ? Number(doVal.toFixed(2)) : null,
      unit: doVal !== null ? 'mg/L' : 'ADC',
      rawADC: doRaw,
      voltage: doVolt !== null ? Number(doVolt.toFixed(3)) : (doRaw !== null ? Number((doRaw * 3.3 / 4095.0).toFixed(3)) : null),
      status: isOffline ? 'OFFLINE' : (doVal !== null ? (doVal < 5.0 ? 'CRITICAL' : 'OPTIMAL') : (doValid ? 'UNCALIBRATED' : (doRaw === 0 ? 'DISCONNECTED' : 'UNCALIBRATED'))),
      statusReason: isOffline ? 'Hardware disconnected' : (doVal !== null ? 'Calibrated reading' : (doRaw === 0 ? 'Galvanic DO probe disconnected (0V)' : 'Raw ADC valid (Uncalibrated probe)')),
      hardwareSource: 'Galvanic DO Sensor (GPIO 33)',
      acceptableMin: 5.0,
      acceptableMax: 9.0,
      optimalMin: 6.0,
      optimalMax: 8.0,
      trend: isOffline || (doVal === null && doRaw === null) ? '—' : 'STABLE',
      lastUpdated: (!isOffline && row && (doVal !== null || doRaw !== null)) ? row.timestamp : null
    };

    // Future expansion sensors (Phase 2)
    const futureKeys = [
      { key: 'salinity', label: 'Salinity (Phase 2)', unit: 'ppt' },
      { key: 'alkalinity', label: 'Alkalinity (Phase 2)', unit: 'mg/L' },
      { key: 'ammonia', label: 'Ammonia (Phase 2)', unit: 'mg/L' }
    ];

    for (const f of futureKeys) {
      cards[f.key] = {
        key: f.key,
        label: f.label,
        value: null,
        unit: f.unit,
        calibrated: false,
        status: 'UNAVAILABLE',
        statusReason: 'Probe not installed (Phase 2 expansion)',
        hardwareSource: 'Unassigned (Future Probe)',
        acceptableMin: '--',
        acceptableMax: '--',
        optimalMin: '--',
        optimalMax: '--',
        trend: '—',
        lastUpdated: null
      };
    }

    return {
      tankId,
      hardwareConnected: hwStatus.hardwareConnected,
      isStale: hwStatus.isStale,
      lastTimestamp: (!isOffline && row) ? row.timestamp : null,
      rawTelemetry: (!isOffline && row) ? {
        temperature: row.temperature,
        humidity: row.humidity,
        ph_raw_adc: row.ph_raw_adc,
        ph_voltage: row.ph_voltage,
        do_raw_adc: row.do_raw_adc,
        do_voltage: row.do_voltage,
        tds_raw_adc: row.tds_raw_adc,
        tds_voltage: row.tds_voltage,
        turbidity_raw_adc: row.turbidity_raw_adc,
        turbidity_voltage: row.turbidity_voltage,
        ldr_state: row.ldr_state
      } : null,
      cards
    };
  }

  async getHistory(tankId = env.DEFAULT_TANK_ID, period = '24h') {
    const periodMap = {
      '1h': 1 * 3600 * 1000,
      '6h': 6 * 3600 * 1000,
      '12h': 12 * 3600 * 1000,
      '24h': 24 * 3600 * 1000,
      '7d': 7 * 24 * 3600 * 1000
    };

    const duration = periodMap[period] || periodMap['24h'];
    const now = Date.now();
    const fromTime = now - duration;

    // Fetch stored points
    const rows = await dbAsync.all(`
      SELECT timestamp, temperature, humidity, ph_raw_adc, ph_voltage, do_raw_adc, tds_raw_adc, turbidity_raw_adc
      FROM sensor_readings
      WHERE tank_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `, [tankId, fromTime]);

    let points = rows;
    if (rows.length > 200) {
      const step = Math.ceil(rows.length / 200);
      points = rows.filter((_, idx) => idx % step === 0);
    }

    return {
      tankId,
      period,
      fromTime,
      toTime: now,
      count: points.length,
      data: points
    };
  }
}

module.exports = new SensorService();
