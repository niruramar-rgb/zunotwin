const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const env = require('./config/env');

// Database initialization
require('./database/connection');

// Hardware Bridges
const serialBridge = require('./hardware/serialBridge');
const mqttBridge = require('./hardware/mqttBridge');
const deviceRegistry = require('./hardware/deviceRegistry');

// Services
const sensorService = require('./services/sensorService');
const alertService = require('./services/alertService');
const automationService = require('./services/automationService');
const digitalTwinService = require('./services/digitalTwinService');

// Socket handler
const { setupSockets } = require('./sockets/sensorSocket');

// Routes & Middlewares
const authRoutes = require('./api/authRoutes');
const deviceRoutes = require('./api/deviceRoutes');
const settingsRoutes = require('./api/settingsRoutes');
const sensorRoutes = require('./api/sensorRoutes');
const alertRoutes = require('./api/alertRoutes');
const equipmentRoutes = require('./api/equipmentRoutes');
const cameraRoutes = require('./api/cameraRoutes');
const modelRoutes = require('./api/modelRoutes');
const reportRoutes = require('./api/reportRoutes');
const calibrationRoutes = require('./api/calibrationRoutes');
const diseaseRoutes = require('./api/diseaseRoutes');
const calibrationService = require('./services/calibrationService');
const { requireAuth } = require('./middleware/authMiddleware');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with permissive CORS for development
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Support browser credentials for localhost dev server
    callback(null, true);
  },
  credentials: true
}));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Setup WebSocket dispatchers
setupSockets(io);

// Wire socket emitters & dependencies to services
sensorService.setSocketEmitter((event, data) => io.emit(event, data));
alertService.setSocketEmitter((event, data) => io.emit(event, data));
automationService.setSocketEmitter((event, data) => io.emit(event, data));
deviceRegistry.setSocketEmitter((event, data) => io.emit(event, data));
deviceRegistry.setAlertService(alertService);

// Connect physical hardware bridges to sensorService ingestion
serialBridge.setSensorCallback((payload) => sensorService.processReading(payload));
mqttBridge.setSensorCallback((payload) => sensorService.processReading(payload));

// Public Authentication & Device Diagnostic Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

// Public Hardware Telemetry Endpoints (Matches project requirements)
app.get('/api/telemetry/latest', async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const summary = await sensorService.getLatestCardSummary(tankId);
    const hwStatus = deviceRegistry.getStatus();
    res.json({
      success: true,
      hardware: hwStatus,
      data: summary
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated Aerator Command Endpoint (POST /api/aerator)
app.post('/api/aerator', async (req, res) => {
  try {
    const targetState = (req.body.state || req.body.command || '').toUpperCase().replace('AERATOR_', '');
    if (!['ON', 'OFF'].includes(targetState)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid aerator target state. Must be "ON" or "OFF" (or command "AERATOR_ON" / "AERATOR_OFF").' 
      });
    }

    const hwStatus = deviceRegistry.getStatus();
    if (!hwStatus.hardwareConnected) {
      return res.status(503).json({
        success: false,
        error: 'ESP32 hardware controller is OFFLINE. Aerator command rejected by safety layer.',
        hardwareStatus: hwStatus
      });
    }

    const result = await automationService.sendEquipmentCommand('aerator_01', targetState, req.body.source || 'API_DASHBOARD');
    res.json({
      success: true,
      requestedState: targetState,
      command: `AERATOR_${targetState}`,
      state: targetState,
      acknowledged: result.verified,
      timestamp: result.timestamp,
      message: `Aerator command AERATOR_${targetState} dispatched and acknowledged.`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Public read access for alerts feed with optional auth
app.get('/api/alerts', async (req, res) => {
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

// Telemetry, Sensor, Calibration, and AI APIs
app.use('/api/sensors', sensorRoutes);
app.use('/api/calibration', calibrationRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/uploads/disease', express.static(path.resolve(__dirname, '../uploads/disease')));
app.use('/api/alerts', alertRoutes);
app.use('/api/equipment', requireAuth, equipmentRoutes);
app.use('/api/camera', requireAuth, cameraRoutes);
app.use('/api/models', requireAuth, modelRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/settings', settingsRoutes);

// Digital Twin Live Aggregation Endpoint (Protected)
app.get('/api/digital-twin/state', requireAuth, async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const state = await digitalTwinService.getTankState(tankId);
    res.json({ success: true, data: state });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    platform: 'ZUNO TWIN — Smart AIoT Aquaculture Platform',
    tagline: 'Smarter Hatcheries. Healthier Shrimps.',
    version: '2.0.0',
    status: 'ONLINE',
    environment: env.NODE_ENV
  });
});

// Serve static frontend build if present
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log(`[Static] Serving frontend static assets from: ${frontendDist}`);
  app.use(express.static(frontendDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    // If root is accessed programmatically (or Accept does not require text/html), return API metadata JSON
    if (req.path === '/' && (!req.headers.accept || !req.headers.accept.includes('text/html'))) {
      return res.json({
        platform: 'ZUNO TWIN — Smart AIoT Aquaculture Platform',
        tagline: 'Smarter Hatcheries. Healthier Shrimps.',
        version: '2.0.0',
        status: 'ONLINE',
        environment: env.NODE_ENV
      });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Root fallback when dist is not built
  app.get('/', (req, res) => {
    res.json({
      platform: 'ZUNO TWIN — Smart AIoT Aquaculture Platform',
      tagline: 'Smarter Hatcheries. Healthier Shrimps.',
      version: '2.0.0',
      status: 'ONLINE',
      environment: env.NODE_ENV
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server & Physical Hardware Bridge
server.listen(env.PORT, env.HOST, async () => {
  console.log(`=======================================================`);
  console.log(`  ZUNO TWIN AIoT Server running at http://${env.HOST}:${env.PORT}`);
  console.log(`  Tagline: "Smarter Hatcheries. Healthier Shrimps."`);
  console.log(`=======================================================`);

  // Load persistent sensor calibration profiles
  await calibrationService.init();

  // Start hardware serial port listener
  await serialBridge.start();

  // Start MQTT broker listener if enabled
  mqttBridge.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[ZUNO TWIN] Shutting down services gracefully...');
  server.close(() => {
    console.log('[ZUNO TWIN] Server closed.');
    process.exit(0);
  });
});

module.exports = { app, server };
