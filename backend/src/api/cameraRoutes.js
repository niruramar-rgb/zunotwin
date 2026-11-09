const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const inferenceService = require('../services/inferenceService');
const { dbAsync } = require('../database/connection');

// Ensure upload directory exists
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `tank_frame_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are permitted.'));
    }
    cb(null, true);
  }
});

// In-memory stream config
let cameraConfig = {
  connected: Boolean(env.CAMERA_STREAM_URL || env.CAMERA_SNAPSHOT_URL),
  streamType: env.CAMERA_STREAM_URL ? 'MJPEG' : 'NONE', // 'NONE', 'WEBCAM', 'RTSP', 'MJPEG'
  streamUrl: env.CAMERA_STREAM_URL || null,
  snapshotUrl: env.CAMERA_SNAPSHOT_URL || null,
  lastFrameTimestamp: null,
  totalProcessedFrames: 0
};

// GET /api/camera/status
router.get('/status', async (req, res) => {
  const recentAnalyses = await dbAsync.all(
    'SELECT * FROM camera_analyses ORDER BY timestamp DESC LIMIT 20'
  );

  res.json({
    success: true,
    data: {
      ...cameraConfig,
      streamConfigured: Boolean(env.CAMERA_STREAM_URL),
      recentAnalyses: recentAnalyses.map(a => ({
        id: a.id,
        timestamp: a.timestamp,
        imageFilename: a.image_filename,
        imageUrl: `/uploads/${a.image_filename}`,
        shrimpCount: a.shrimp_count,
        avgBboxArea: a.avg_bbox_area,
        modelVersion: a.model_version,
        detections: (() => {
          try { return JSON.parse(a.detections_json || '[]'); } catch (_) { return []; }
        })(),
        humanReviewStatus: a.human_review_status || 'PENDING',
        notes: a.notes || ''
      }))
    }
  });
});

// GET /api/camera/records - List all analysis records
router.get('/records', async (req, res) => {
  try {
    const records = await dbAsync.all(
      'SELECT * FROM camera_analyses ORDER BY timestamp DESC LIMIT 50'
    );
    res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        imageFilename: r.image_filename,
        imageUrl: `/uploads/${r.image_filename}`,
        shrimpCount: r.shrimp_count,
        avgBboxArea: r.avg_bbox_area,
        modelVersion: r.model_version,
        detections: (() => {
          try { return JSON.parse(r.detections_json || '[]'); } catch (_) { return []; }
        })(),
        humanReviewStatus: r.human_review_status,
        notes: r.notes
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/camera/review/:id - Update review status of an inspection frame
router.post('/review/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED_ABNORMALITY', 'NORMAL_CLEARED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status.' });
    }

    await dbAsync.run(
      'UPDATE camera_analyses SET human_review_status = ?, notes = ? WHERE id = ?',
      [status, notes || '', req.params.id]
    );

    res.json({ success: true, message: 'Review status recorded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/camera/group-alert - Trigger group-level alert if >= 3 distinct shrimp flagged
router.post('/group-alert', async (req, res) => {
  try {
    const alertService = require('../services/alertService');
    const { distinctShrimp, evidenceFilenames, tankId } = req.body;
    
    if (!distinctShrimp || !Array.isArray(distinctShrimp) || distinctShrimp.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Group alert requires at least 3 distinct shrimp specimens.'
      });
    }

    const alert = await alertService.recordGroupReviewAlert({
      tankId: tankId || env.DEFAULT_TANK_ID,
      distinctCount: distinctShrimp.length,
      specimens: distinctShrimp,
      evidenceFiles: evidenceFilenames || []
    });

    res.json({
      success: true,
      message: 'Group review alert generated and logged in alert center',
      alert
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/camera/upload - Analyze an uploaded shrimp frame
router.post('/upload', upload.single('frame'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image frame uploaded' });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    const inferenceResult = await inferenceService.analyzeImageWithYolo(imageBuffer, req.file.filename);

    cameraConfig.lastFrameTimestamp = Date.now();
    cameraConfig.totalProcessedFrames++;

    res.json({
      success: true,
      filename: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      analysis: inferenceResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/camera/stream-config - Set or test camera feed configuration
router.post('/stream-config', (req, res) => {
  const { streamType, streamUrl } = req.body;
  if (!['NONE', 'WEBCAM', 'RTSP', 'MJPEG'].includes(streamType)) {
    return res.status(400).json({ success: false, error: 'Invalid streamType. Options: NONE, WEBCAM, RTSP, MJPEG' });
  }

  cameraConfig.streamType = streamType;
  cameraConfig.streamUrl = streamUrl || null;
  cameraConfig.connected = streamType !== 'NONE';

  res.json({
    success: true,
    message: 'Camera stream configuration updated',
    config: cameraConfig
  });
});

module.exports = router;
