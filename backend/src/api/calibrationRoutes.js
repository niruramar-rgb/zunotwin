const express = require('express');
const router = express.Router();
const calibrationService = require('../services/calibrationService');

/**
 * GET /api/calibration
 * Returns current calibration statuses and coefficients for all sensors
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: calibrationService.getAll()
  });
});

/**
 * GET /api/calibration/:sensorKey
 * Returns calibration profile for specific sensor
 */
router.get('/:sensorKey', (req, res) => {
  const cal = calibrationService.get(req.params.sensorKey);
  if (!cal) {
    return res.status(404).json({ success: false, error: `Sensor ${req.params.sensorKey} not found` });
  }
  res.json({ success: true, data: cal });
});

/**
 * POST /api/calibration/ph
 * Calibrate pH probe with 2 or 3 buffer points
 */
router.post('/ph', async (req, res) => {
  try {
    const { points, user, notes } = req.body;
    const result = await calibrationService.calibratePH({ points, user, notes });
    res.json({
      success: true,
      message: 'pH sensor calibrated successfully',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/calibration/tds
 * Calibrate TDS probe with known standard solution
 */
router.post('/tds', async (req, res) => {
  try {
    const { standardPpm, voltage, waterTempC, user, notes } = req.body;
    const result = await calibrationService.calibrateTDS({ standardPpm, voltage, waterTempC, user, notes });
    res.json({
      success: true,
      message: 'TDS sensor calibrated successfully',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/calibration/turbidity
 * Calibrate Turbidity probe with 2 reference standards
 */
router.post('/turbidity', async (req, res) => {
  try {
    const { points, user, notes } = req.body;
    const result = await calibrationService.calibrateTurbidity({ points, user, notes });
    res.json({
      success: true,
      message: 'Turbidity sensor calibrated successfully',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/calibration/:sensorKey
 * Reset calibration back to uncalibrated raw mode
 */
router.delete('/:sensorKey', async (req, res) => {
  try {
    const result = await calibrationService.resetCalibration(req.params.sensorKey);
    res.json({
      success: true,
      message: `Sensor ${req.params.sensorKey} reset to uncalibrated raw state`,
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
