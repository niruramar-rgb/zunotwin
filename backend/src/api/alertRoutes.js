const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');

// GET /api/alerts - Active and historical alerts
router.get('/', async (req, res) => {
  try {
    const tankId = req.query.tankId || null;
    const limit = parseInt(req.query.limit, 10) || 50;
    const showAll = req.query.all === 'true';

    const alerts = showAll 
      ? await alertService.getAllAlerts(tankId, limit)
      : await alertService.getActiveAlerts(tankId, limit);

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/:id/ack - Acknowledge alert
router.post('/:id/ack', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const result = await alertService.acknowledgeAlert(alertId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/ack-all - Acknowledge all active alerts
router.post('/ack-all', async (req, res) => {
  try {
    const tankId = req.query.tankId || null;
    const result = await alertService.acknowledgeAll(tankId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
