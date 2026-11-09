const deviceRegistry = require('../hardware/deviceRegistry');
const sensorService = require('../services/sensorService');
const alertService = require('../services/alertService');
const automationService = require('../services/automationService');

function setupSockets(io) {
  const emitAll = (event, payload) => {
    io.emit(event, payload);
  };

  // Wire emitters into services
  sensorService.setSocketEmitter(emitAll);
  alertService.setSocketEmitter(emitAll);
  automationService.setSocketEmitter(emitAll);

  io.on('connection', async (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send initial snapshot immediately upon connection
    try {
      const summary = await sensorService.getLatestCardSummary();
      const hwStatus = deviceRegistry.getStatus();
      const activeAlerts = await alertService.getActiveAlerts(null, 10);
      const equipment = await automationService.getEquipmentList();

      socket.emit('initial-state', {
        sensors: summary,
        hardware: hwStatus,
        alerts: activeAlerts,
        equipment
      });
    } catch (e) {
      console.warn('[Socket.IO] Error emitting initial state:', e.message);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  // Periodic heartbeat broadcast every 2 seconds
  setInterval(() => {
    const hwStatus = deviceRegistry.getStatus();
    io.emit('hardware-status', hwStatus);
  }, 2000);
}

module.exports = {
  setupSockets
};
