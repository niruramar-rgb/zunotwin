const express = require('express');
const router = express.Router();
const deviceRegistry = require('../hardware/deviceRegistry');
const serialBridge = require('../hardware/serialBridge');

// GET /api/device/status - Hardware device connection status
router.get('/status', async (req, res) => {
  try {
    const status = deviceRegistry.getStatus();
    const ports = await serialBridge.listAvailablePorts();
    res.json({
      success: true,
      data: {
        ...status,
        availablePorts: ports
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/device/ports - List all detected COM ports on system
router.get('/ports', async (req, res) => {
  try {
    const ports = await serialBridge.listAvailablePorts();
    res.json({
      success: true,
      count: ports.length,
      currentPort: serialBridge.currentPortPath,
      data: ports
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/device/port - Switch or select active ESP32 COM port
router.post('/port', async (req, res) => {
  try {
    const { port } = req.body;
    if (!port) {
      return res.status(400).json({ success: false, error: 'Port path is required (e.g. COM13)' });
    }
    const result = await serialBridge.switchPort(port);
    res.json({
      success: true,
      message: `Active serial connection switched to ${port}`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
