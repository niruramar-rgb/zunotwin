const express = require('express');
const router = express.Router();
const automationService = require('../services/automationService');

// GET /api/equipment - List verified equipment status
router.get('/', async (req, res) => {
  try {
    const tankId = req.query.tankId || null;
    const equipment = await automationService.getEquipmentList(tankId);
    res.json({
      success: true,
      count: equipment.length,
      data: equipment
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/equipment/:id/command - Send control command
router.post('/:id/command', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { state, source = 'DASHBOARD_MANUAL' } = req.body;
    if (!state) {
      return res.status(400).json({ success: false, error: 'Target state (ON or OFF) is required' });
    }

    const result = await automationService.sendEquipmentCommand(deviceId, state, source);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/equipment/:id/mode - Set operating mode (AUTO / MANUAL)
router.post('/:id/mode', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { mode } = req.body;
    if (!mode) {
      return res.status(400).json({ success: false, error: 'Mode (AUTO or MANUAL) is required' });
    }

    const result = await automationService.setEquipmentMode(deviceId, mode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/equipment/emergency-stop - Shut down all active devices
router.post('/emergency-stop', async (req, res) => {
  try {
    const tankId = req.query.tankId || null;
    const result = await automationService.emergencyStop(tankId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
