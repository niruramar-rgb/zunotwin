const express = require('express');
const router = express.Router();
const inferenceService = require('../services/inferenceService');
const sensorService = require('../services/sensorService');
const env = require('../config/env');

// GET /api/models/status - Current operational status of all AI/ML models
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: inferenceService.getModelsStatus()
  });
});

// POST /api/models/predict-risk - XGBoost & AutoGluon risk index inference
router.post('/predict-risk', async (req, res) => {
  try {
    let payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      // Use latest sensor readings if body is empty
      const summary = await sensorService.getLatestCardSummary(env.DEFAULT_TANK_ID);
      payload = {
        ph: summary.cards.ph?.value,
        temperature: summary.cards.temperature?.value,
        turbidity: summary.cards.turbidity?.value,
        tds: summary.cards.tds?.value,
        salinity: summary.cards.salinity?.value,
        alkalinity: summary.cards.alkalinity?.value,
        ammonia: summary.cards.ammonia?.value,
        dissolved_oxygen: 6.4
      };
    }

    const prediction = await inferenceService.predictWaterRisk(payload);
    res.json({
      success: true,
      data: prediction
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/explain - SHAP feature attributions and advisory
router.get('/explain', async (req, res) => {
  try {
    const explanation = await inferenceService.getShapExplanation();
    res.json({
      success: true,
      data: explanation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
