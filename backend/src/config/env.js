const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Storage
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../../data/zunotwin.db'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../data/uploads'),
  
  // Hardware Bridge Settings
  SERIAL_PORT: process.env.SERIAL_PORT || null, // Auto-detect if null
  SERIAL_BAUD_RATE: parseInt(process.env.SERIAL_BAUD_RATE, 10) || 115200,
  SERIAL_AUTO_RECONNECT_MS: 3000,
  
  // MQTT Settings
  MQTT_ENABLED: process.env.MQTT_ENABLED === 'true',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883',
  MQTT_TOPIC_SUB_SENSORS: process.env.MQTT_TOPIC_SUB_SENSORS || 'shrimpsense/tanks/3/sensors',
  MQTT_TOPIC_PUB_ACTUATORS: process.env.MQTT_TOPIC_PUB_ACTUATORS || 'shrimpsense/tanks/3/actuators',
  
  // AI Inference Microservice
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',

  // ESP32-CAM Video Stream
  CAMERA_STREAM_URL: process.env.CAMERA_STREAM_URL || null, // e.g. http://192.168.1.100:81/stream
  CAMERA_SNAPSHOT_URL: process.env.CAMERA_SNAPSHOT_URL || null, // e.g. http://192.168.1.100/capture
  
  // Heartbeat & Failsafe
  HEARTBEAT_TIMEOUT_SECONDS: 5.0,
  STALE_DATA_THRESHOLD_SECONDS: 10.0,
  
  // Tank Identification
  DEFAULT_TANK_ID: 'tank-01',
  DEFAULT_FARM_NAME: 'ZUNO TWIN Hatchery Facility',
  
  // Security & Authentication
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'zuno-secret-key-2026',
  JWT_SECRET: process.env.JWT_SECRET || 'zuno-twin-jwt-auth-secret-key-aquaculture-2026',
  SESSION_EXPIRY: process.env.SESSION_EXPIRY || '24h',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'zuno-twin-cookie-secret-key-2026'
};
