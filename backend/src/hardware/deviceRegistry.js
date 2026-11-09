const env = require('../config/env');

class DeviceRegistry {
  constructor() {
    this.devices = {
      'ESP32-REAL-001': {
        deviceId: 'ESP32-REAL-001',
        tankId: env.DEFAULT_TANK_ID,
        type: 'esp32_iot_controller',
        status: 'DISCONNECTED', // Default offline until real packet received
        transport: 'USB_SERIAL',
        lastHeartbeat: 0,
        lastValidReading: null,
        portName: null,
        firmwareVersion: 'ShrimpSense ESP32 v1.2',
        consecutiveErrors: 0
      }
    };

    this.activeSensors = {
      ph: false,
      temperature: false,
      turbidity: false,
      tds: false,
      salinity: false,
      alkalinity: false,
      ammonia: false,
      dissolved_oxygen: false,
      humidity: false
    };

    this.socketEmitter = null;
    this.alertService = null;
    this.previousConnectedState = false;

    // Periodic freshness evaluator (runs every 1 second)
    this.timer = setInterval(() => this.evaluateHealth(), 1000);
  }

  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  setAlertService(service) {
    this.alertService = service;
  }

  recordHeartbeat(deviceId, readingTimestamp = Date.now(), portName = null) {
    const wasConnected = this.devices[deviceId]?.status === 'CONNECTED';
    
    if (!this.devices[deviceId]) {
      this.devices[deviceId] = {
        deviceId,
        tankId: env.DEFAULT_TANK_ID,
        status: 'CONNECTED',
        transport: portName ? 'USB_SERIAL' : 'HTTP/MQTT',
        lastHeartbeat: Date.now(),
        lastValidReading: readingTimestamp,
        portName
      };
    } else {
      const dev = this.devices[deviceId];
      dev.status = 'CONNECTED';
      dev.lastHeartbeat = Date.now();
      dev.lastValidReading = readingTimestamp;
      if (portName) dev.portName = portName;
      dev.consecutiveErrors = 0;
      dev.failReason = null;
    }

    // State Transition: Disconnected -> Connected
    if (!wasConnected) {
      console.log(`[DeviceRegistry] Hardware state change: ${deviceId} is now ONLINE on ${portName || 'Serial'}`);
      if (this.alertService) {
        this.alertService.recordDeviceConnected(deviceId, portName || 'COM Port');
      }
      this.broadcastStatus();
    }
  }

  recordDisconnect(deviceId, reason = 'Hardware connection lost') {
    const dev = this.devices[deviceId];
    const wasConnected = dev?.status === 'CONNECTED';

    if (dev) {
      dev.status = 'DISCONNECTED';
      dev.failReason = reason;
      for (const key in this.activeSensors) {
        this.activeSensors[key] = false;
      }
    }

    if (wasConnected) {
      console.warn(`[DeviceRegistry] Hardware state change: ${deviceId} is now OFFLINE (${reason})`);
      if (this.alertService) {
        this.alertService.recordDeviceDisconnected(deviceId, reason);
      }
      this.broadcastStatus();
    }
  }

  updateSensorAvailability(measurements) {
    if (!measurements) return;
    for (const key of Object.keys(this.activeSensors)) {
      this.activeSensors[key] = measurements[key] !== null && measurements[key] !== undefined && !isNaN(measurements[key]);
    }
  }

  evaluateHealth() {
    const now = Date.now();
    const timeoutSeconds = env.HEARTBEAT_TIMEOUT_SECONDS || 10.0;

    for (const id in this.devices) {
      const dev = this.devices[id];
      if (dev.status === 'CONNECTED') {
        const deltaSec = (now - dev.lastHeartbeat) / 1000.0;
        if (deltaSec > timeoutSeconds) {
          console.warn(`[DeviceRegistry] Timeout failsafe triggered: ${deltaSec.toFixed(1)}s > ${timeoutSeconds}s without telemetry`);
          this.recordDisconnect(id, `Heartbeat delta ${deltaSec.toFixed(1)}s > ${timeoutSeconds}s failsafe limit`);
        }
      }
    }
  }

  broadcastStatus() {
    if (this.socketEmitter) {
      this.socketEmitter('hardware-status', this.getStatus());
    }
  }

  getStatus() {
    const primaryDevice = this.devices['ESP32-REAL-001'] || { status: 'DISCONNECTED' };
    const now = Date.now();
    const dataAgeSec = primaryDevice.lastHeartbeat > 0 ? ((now - primaryDevice.lastHeartbeat) / 1000.0) : null;
    const isStale = dataAgeSec === null || dataAgeSec > (env.STALE_DATA_THRESHOLD_SECONDS || 10.0);

    return {
      hardwareConnected: primaryDevice.status === 'CONNECTED',
      deviceStatus: primaryDevice.status,
      deviceId: primaryDevice.deviceId,
      portName: primaryDevice.portName || 'No physical COM port connected',
      lastHeartbeat: primaryDevice.lastHeartbeat,
      dataAgeSeconds: dataAgeSec ? Math.round(dataAgeSec * 10) / 10 : null,
      isStale,
      failReason: primaryDevice.failReason || null,
      activeSensors: { ...this.activeSensors }
    };
  }
}

module.exports = new DeviceRegistry();
