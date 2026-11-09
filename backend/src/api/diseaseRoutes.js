const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { dbAsync } = require('../database/connection');
const env = require('../config/env');

// Upload directory for incoming analysis requests
const uploadDir = path.resolve(__dirname, '../../uploads/disease');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 10 MB file upload limit & image format validation (JPG, JPEG, PNG)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `specimen_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png'];
    const allowedMimes = ['image/jpeg', 'image/png', 'image/pjpeg'];

    if (!allowedExts.includes(ext) || !allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are supported.'));
    }
    cb(null, true);
  }
});

const INFERENCE_SCRIPT = path.resolve(__dirname, '../../ml/inference/disease_detector.py');
const BLACK_SPOT_SCRIPT = path.resolve(__dirname, '../../ml/inference/black_spot_detector.py');

/**
 * GET /api/disease/black-spot/status
 * Check Black-Spot model status, dataset dependencies, and inference readiness
 */
router.get('/black-spot/status', (req, res) => {
  const pythonProc = spawn('python', [BLACK_SPOT_SCRIPT]);
  let stdoutData = '';

  pythonProc.stdout.on('data', (d) => { stdoutData += d.toString(); });

  pythonProc.on('close', (code) => {
    try {
      const parsed = JSON.parse(stdoutData.trim());
      res.json({ success: true, data: parsed });
    } catch (_) {
      res.json({
        success: true,
        data: {
          ready: false,
          modelVersion: 'MobileNetV3-BlackSpot-v1.0'
        }
      });
    }
  });
});

/**
 * GET /api/disease/status
 * Check AI model status, dataset dependencies, and inference readiness
 */
router.get('/status', (req, res) => {
  const pythonProc = spawn('python', [INFERENCE_SCRIPT]);
  let stdoutData = '';
  let stderrData = '';

  pythonProc.stdout.on('data', (d) => { stdoutData += d.toString(); });
  pythonProc.stderr.on('data', (d) => { stderrData += d.toString(); });

  pythonProc.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to inspect model status.',
        status: 'MODEL_UNAVAILABLE'
      });
    }

    try {
      const parsed = JSON.parse(stdoutData.trim());
      res.json({
        success: true,
        data: parsed
      });
    } catch (_) {
      res.json({
        success: true,
        data: {
          ready: false,
          modelVersion: 'MobileNetV3-Aquaculture-v1.0',
          status: 'PARSING_ERROR'
        }
      });
    }
  });
});

/**
 * GET /api/disease/history
 * Fetch past specimen analyses
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const records = await dbAsync.all(
      'SELECT id, timestamp, image_filename, file_size_bytes, model_version, status, predicted_class, confidence, explanation, actionable_steps, notes FROM disease_analyses ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        imageFilename: r.image_filename,
        imageUrl: `/uploads/disease/${r.image_filename}`,
        fileSizeBytes: r.file_size_bytes,
        modelVersion: r.model_version,
        status: r.status,
        predictedClass: r.predicted_class,
        confidence: r.confidence,
        explanation: r.explanation,
        actionableSteps: (() => {
          try { return JSON.parse(r.actionable_steps || '[]'); } catch (_) { return []; }
        })(),
        notes: r.notes
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/disease/analyze
 * Upload a shrimp specimen image and run inference
 */
router.post('/analyze', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file uploaded. Supported formats: JPG, JPEG, PNG (max 10MB).'
    });
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;
  const fileSize = req.file.size;

  const pythonProc = spawn('python', [INFERENCE_SCRIPT, filePath]);
  let stdoutData = '';
  let stderrData = '';

  pythonProc.stdout.on('data', (d) => { stdoutData += d.toString(); });
  pythonProc.stderr.on('data', (d) => { stderrData += d.toString(); });

  pythonProc.on('close', async (code) => {
    if (code !== 0) {
      console.error('[DiseaseInference] Python process error:', stderrData);
      return res.status(500).json({
        success: false,
        status: 'INFERENCE_FAILED',
        error: 'Inference script terminated unexpectedly. Hardware monitoring remains unaffected.'
      });
    }

    try {
      const result = JSON.parse(stdoutData.trim());

      // Persist analysis record
      try {
        await dbAsync.run(`
          INSERT INTO disease_analyses (
            timestamp, image_filename, file_size_bytes, model_name, model_version,
            status, predicted_class, confidence, all_probabilities_json, explanation, actionable_steps
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          result.timestamp || Date.now(),
          fileName,
          fileSize,
          'MobileNetV3-ShrimpDisease',
          result.modelVersion || 'MobileNetV3-Aquaculture-v1.0',
          result.status || 'UNKNOWN',
          result.predictedClass || null,
          result.confidence || null,
          JSON.stringify(result.probabilityDistribution || {}),
          result.explanation || '',
          JSON.stringify(result.actionableSteps || [])
        ]);
      } catch (dbErr) {
        console.warn('[DiseaseInference] Could not log record to DB:', dbErr.message);
      }

      // Return sanitized response (never leaking internal paths or secrets)
      res.json({
        success: true,
        filename: fileName,
        imageUrl: `/uploads/disease/${fileName}`,
        fileSizeBytes: fileSize,
        analysis: result
      });

    } catch (parseErr) {
      console.error('[DiseaseInference] JSON parse error:', parseErr.message, stdoutData);
      res.status(500).json({
        success: false,
        status: 'PARSING_ERROR',
        error: 'Unable to parse inference output.'
      });
    }
  });
});

/**
 * POST /api/disease/analyze-black-spot
 * Upload a shrimp specimen photo and test specifically for Black-Spot / Shell-Lesion pathology
 */
router.post('/analyze-black-spot', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file uploaded. Supported formats: JPG, JPEG, PNG (max 10MB).'
    });
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;
  const fileSize = req.file.size;

  const pythonProc = spawn('python', [BLACK_SPOT_SCRIPT, filePath]);
  let stdoutData = '';
  let stderrData = '';

  pythonProc.stdout.on('data', (d) => { stdoutData += d.toString(); });
  pythonProc.stderr.on('data', (d) => { stderrData += d.toString(); });

  pythonProc.on('close', async (code) => {
    if (code !== 0) {
      console.error('[BlackSpotInference] Python error:', stderrData);
      return res.status(500).json({
        success: false,
        status: 'INFERENCE_FAILED',
        error: 'Black-spot inference script terminated unexpectedly. Hardware monitoring remains unaffected.'
      });
    }

    try {
      const result = JSON.parse(stdoutData.trim());

      try {
        await dbAsync.run(`
          INSERT INTO disease_analyses (
            timestamp, image_filename, file_size_bytes, model_name, model_version,
            status, predicted_class, confidence, all_probabilities_json, explanation, actionable_steps
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          result.timestamp || Date.now(),
          fileName,
          fileSize,
          'MobileNetV3-BlackSpot',
          result.modelVersion || 'MobileNetV3-BlackSpot-v1.0',
          result.status || 'UNKNOWN',
          result.predictedClass || null,
          result.confidence || null,
          JSON.stringify(result.probabilityDistribution || {}),
          result.explanation || '',
          JSON.stringify(result.actionableSteps || [])
        ]);
      } catch (dbErr) {
        console.warn('[BlackSpotInference] Could not log record to DB:', dbErr.message);
      }

      res.json({
        success: true,
        filename: fileName,
        imageUrl: `/uploads/disease/${fileName}`,
        fileSizeBytes: fileSize,
        analysis: result
      });
    } catch (parseErr) {
      console.error('[BlackSpotInference] JSON parse error:', parseErr.message, stdoutData);
      res.status(500).json({
        success: false,
        status: 'PARSING_ERROR',
        error: 'Unable to parse black-spot inference output.'
      });
    }
  });
});

/**
 * POST /api/disease/trigger-alert
 * Trigger disease detection warning notification for flagged shrimp specimens
 */
router.post('/trigger-alert', async (req, res) => {
  try {
    const alertService = require('../services/alertService');
    const { tankId = 'tank-01', count = 3, disease = 'Black Spot Disease', specimens } = req.body;
    const specimenList = specimens || [
      'Shrimp #1 (P1 - Carapace Lesion)',
      'Shrimp #2 (P2 - Abdominal Black Spot)',
      'Shrimp #3 (P3 - Cuticular Erosion)'
    ];

    const alert = await alertService.recordGroupReviewAlert({
      tankId,
      distinctCount: count,
      specimens: specimenList,
      diseaseName: disease
    });

    res.json({
      success: true,
      message: `Warning notification generated for ${count} diseased shrimp specimens`,
      alert
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
