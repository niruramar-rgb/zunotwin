const express = require('express');
const router = express.Router();
const sensorService = require('../services/sensorService');
const deviceRegistry = require('../hardware/deviceRegistry');
const env = require('../config/env');

// GET /api/sensors/latest - Real-time readings and 7 sensor cards summary
router.get('/latest', async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const summary = await sensorService.getLatestCardSummary(tankId);
    const hwStatus = deviceRegistry.getStatus();
    res.json({
      success: true,
      data: summary,
      hardware: hwStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sensors/history - Time-series for trends (1h, 6h, 12h, 24h, 7d)
router.get('/history', async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const period = req.query.period || req.query.range || '24h';
    const history = await sensorService.getHistory(tankId, period);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sensors/status - Hardware device connection health
router.get('/status', (req, res) => {
  const status = deviceRegistry.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// POST /api/sensors/data - Ingestion endpoint for direct HTTP POST from ESP32
// Matches BACKEND_HTTP_URL in shrimpsense_esp32.ino
router.post('/data', async (req, res) => {
  try {
    const body = req.body;
    const deviceId = body.device_id || 'ESP32-REAL-001';
    const now = Date.now();
    deviceRegistry.recordHeartbeat(deviceId, now, 'HTTP');

    const sanitize = (val) => {
      if (val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num <= -500.0) return null;
      return num;
    };

    const ph = sanitize(body.ph);
    const temperature = sanitize(body.temperature);
    const turbidity = sanitize(body.turbidity_ntu !== undefined ? body.turbidity_ntu : body.turbidity);
    const tds = sanitize(body.tds_ppm !== undefined ? body.tds_ppm : body.tds);
    const doVal = sanitize(body.dissolved_oxygen);
    const humidity = sanitize(body.humidity);

    // Unconfigured future sensors strictly remain null until physical hardware integration
    const salinity = null;
    const alkalinity = null;
    const ammonia = null;

    const normalized = {
      tankId: body.tank_id ? `tank-0${body.tank_id}` : env.DEFAULT_TANK_ID,
      timestamp: now,
      source: 'esp32_direct_http',
      measurements: {
        ph,
        temperature,
        turbidity,
        tds,
        salinity,
        alkalinity,
        ammonia,
        dissolved_oxygen: doVal,
        humidity
      },
      raw: body
    };

    deviceRegistry.updateSensorAvailability(normalized.measurements);
    await sensorService.processReading(normalized);

    res.json({
      status: 'success',
      message: 'Telemetry ingested successfully',
      tank_id: normalized.tankId,
      timestamp: now
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/sensors/simulate - Isolated test bench injector for validation & demonstrations
router.post('/simulate', async (req, res) => {
  try {
    const { mode = 'nominal', values = {} } = req.body;
    const now = Date.now();
    let measurements = {};

    if (mode === 'nominal') {
      measurements = {
        ph: values.ph || 7.95,
        temperature: values.temperature || 28.5,
        turbidity: values.turbidity || 22.0,
        tds: values.tds || 1720.0,
        salinity: values.salinity || 24.5,
        alkalinity: values.alkalinity || 155.0,
        ammonia: values.ammonia || 0.02,
        dissolved_oxygen: values.dissolved_oxygen || 6.8,
        humidity: 68.0
      };
    } else if (mode === 'warning') {
      measurements = {
        ph: values.ph || 8.65,
        temperature: values.temperature || 32.8,
        turbidity: values.turbidity || 48.0,
        tds: values.tds || 2300.0,
        salinity: values.salinity || 31.0,
        alkalinity: values.alkalinity || 205.0,
        ammonia: values.ammonia || 0.18,
        dissolved_oxygen: values.dissolved_oxygen || 4.1,
        humidity: 80.0
      };
    } else if (mode === 'critical') {
      measurements = {
        ph: values.ph || 9.15,
        temperature: values.temperature || 34.5,
        turbidity: values.turbidity || 78.0,
        tds: values.tds || 2900.0,
        salinity: values.salinity || 36.5,
        alkalinity: values.alkalinity || 240.0,
        ammonia: values.ammonia || 0.42,
        dissolved_oxygen: values.dissolved_oxygen || 2.4,
        humidity: 88.0
      };
    }

    const payload = {
      tankId: env.DEFAULT_TANK_ID,
      timestamp: now,
      source: 'test_fixture_simulation',
      measurements,
      raw: { simulation_mode: mode }
    };

    deviceRegistry.recordHeartbeat('ESP32-REAL-001', now, 'SIMULATOR_PORT');
    deviceRegistry.updateSensorAvailability(measurements);
    await sensorService.processReading(payload);

    res.json({
      success: true,
      mode,
      data: payload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
