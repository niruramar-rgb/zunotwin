const mqtt = require('mqtt');
const env = require('../config/env');
const deviceRegistry = require('./deviceRegistry');

class MqttBridge {
  constructor() {
    this.client = null;
    this.sensorCallback = null;
    this.isConnected = false;
  }

  setSensorCallback(callback) {
    this.sensorCallback = callback;
  }

  start() {
    if (!env.MQTT_ENABLED) {
      console.log('[MqttBridge] MQTT bridge is disabled in configuration');
      return;
    }

    console.log(`[MqttBridge] Connecting to MQTT broker at ${env.MQTT_BROKER_URL}...`);
    try {
      this.client = mqtt.connect(env.MQTT_BROKER_URL, {
        reconnectPeriod: 5000,
        connectTimeout: 10000
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log(`[MqttBridge] Connected to MQTT broker. Subscribing to: ${env.MQTT_TOPIC_SUB_SENSORS}`);
        this.client.subscribe(env.MQTT_TOPIC_SUB_SENSORS);
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.processMqttPayload(payload);
        } catch (e) {
          console.warn('[MqttBridge] Malformed MQTT payload received:', message.toString());
        }
      });

      this.client.on('error', (err) => {
        console.warn('[MqttBridge] MQTT connection error:', err.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      console.warn('[MqttBridge] Failed to initialize MQTT client:', err.message);
    }
  }

  processMqttPayload(payload) {
    const deviceId = payload.device_id || 'ESP32-REAL-001';
    const now = Date.now();
    deviceRegistry.recordHeartbeat(deviceId, now, 'MQTT');

    const sanitize = (val) => {
      if (val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num <= -500.0) return null;
      return num;
    };

    const ph = sanitize(payload.ph);
    const temperature = sanitize(payload.temperature);
    const turbidity = sanitize(payload.turbidity_ntu !== undefined ? payload.turbidity_ntu : payload.turbidity);
    const tds = sanitize(payload.tds_ppm !== undefined ? payload.tds_ppm : payload.tds);
    const doVal = sanitize(payload.dissolved_oxygen);
    const humidity = sanitize(payload.humidity);

    let salinity = null;
    if (tds !== null && tds > 0) {
      salinity = Math.round((tds / 1000.0 * 0.72) * 10) / 10;
    }

    let alkalinity = null;
    if (ph !== null && ph > 0) {
      alkalinity = Math.round(115 + (ph - 7.0) * 35 + (salinity || 20) * 1.5);
    }

    const ammonia = payload.ammonia !== undefined ? sanitize(payload.ammonia) : null;

    const normalized = {
      tankId: payload.tank_id ? `tank-0${payload.tank_id}` : env.DEFAULT_TANK_ID,
      timestamp: now,
      source: 'esp32_mqtt',
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
      raw: payload
    };

    deviceRegistry.updateSensorAvailability(normalized.measurements);

    if (this.sensorCallback) {
      this.sensorCallback(normalized);
    }
  }

  publishCommand(action, value) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    const topic = env.MQTT_TOPIC_PUB_ACTUATORS;
    const payload = JSON.stringify({ [action]: value, timestamp: Date.now() });
    this.client.publish(topic, payload);
    return true;
  }
}

module.exports = new MqttBridge();
