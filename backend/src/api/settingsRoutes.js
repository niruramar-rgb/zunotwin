const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/connection');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * GET /api/settings/sensors
 * Retrieve all registered sensors and their configuration states
 */
router.get('/sensors', async (req, res) => {
  try {
    const rows = await dbAsync.all('SELECT * FROM sensor_configs ORDER BY configured DESC, key ASC');
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[SettingsRoutes] Fetch sensors error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/settings/sensors/:key
 * Update an individual sensor configuration (enable/disable, configured status, thresholds, hardware source)
 */
router.put('/sensors/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const {
      enabled,
      configured,
      label,
      unit,
      hardware_source,
      min_acceptable,
      max_acceptable,
      optimal_min,
      optimal_max,
      warning_low,
      warning_high,
      critical_low,
      critical_high
    } = req.body;

    const existing = await dbAsync.get('SELECT * FROM sensor_configs WHERE key = ?', [key]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Sensor ${key} not found` });
    }

    await dbAsync.run(`
      UPDATE sensor_configs SET
        enabled = COALESCE(?, enabled),
        configured = COALESCE(?, configured),
        label = COALESCE(?, label),
        unit = COALESCE(?, unit),
        hardware_source = COALESCE(?, hardware_source),
        min_acceptable = COALESCE(?, min_acceptable),
        max_acceptable = COALESCE(?, max_acceptable),
        optimal_min = COALESCE(?, optimal_min),
        optimal_max = COALESCE(?, optimal_max),
        warning_low = COALESCE(?, warning_low),
        warning_high = COALESCE(?, warning_high),
        critical_low = COALESCE(?, critical_low),
        critical_high = COALESCE(?, critical_high),
        updated_at = ?
      WHERE key = ?
    `, [
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      configured !== undefined ? (configured ? 1 : 0) : null,
      label,
      unit,
      hardware_source,
      min_acceptable !== undefined ? parseFloat(min_acceptable) : null,
      max_acceptable !== undefined ? parseFloat(max_acceptable) : null,
      optimal_min !== undefined ? parseFloat(optimal_min) : null,
      optimal_max !== undefined ? parseFloat(optimal_max) : null,
      warning_low !== undefined ? parseFloat(warning_low) : null,
      warning_high !== undefined ? parseFloat(warning_high) : null,
      critical_low !== undefined ? parseFloat(critical_low) : null,
      critical_high !== undefined ? parseFloat(critical_high) : null,
      Date.now(),
      key
    ]);

    const updated = await dbAsync.get('SELECT * FROM sensor_configs WHERE key = ?', [key]);
    res.json({
      success: true,
      message: `Sensor ${key} configuration updated successfully`,
      data: updated
    });
  } catch (err) {
    console.error('[SettingsRoutes] Update sensor error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
