# ZUNO TWIN — Machine Learning Training & Evaluation Guide

## 1. Overview of Model Modules

```text
models/
  ├── yolo/         # YOLOv8 Shrimp Specimen Tracking & Anomaly Pipeline
  ├── xgboost/      # Water Quality Stress & Risk Index Regressor
  ├── autogluon/    # Multi-Model AutoML Comparison Leaderboard
  ├── shap/         # Game-Theoretic TreeExplainer XAI Engine
  └── ewma/         # Statistical Time-Series Anomaly Detector
```

---

## 2. Training the XGBoost Water Quality Model

The model trains on the authentic 92,896-row aquaculture telemetry dataset (`data/raw/water_quality_aquaculture.csv`) with a sequential time-aware train/test split (80% train, 20% test).

```bash
# Execute training pipeline
python models/xgboost/train.py

# Evaluate test partition metrics
python models/xgboost/evaluate.py

# Run automated unit tests
python models/xgboost/tests/test_xgboost.py
```

### Benchmark Metrics (Validated on Test Split)
- **Dataset Rows**: 92,896
- **$R^2$ Score**: 0.7761
- **RMSE**: 0.0782
- **MAE**: 0.0490
- **Primary Risk Drivers**: Ammonia ($42.5\%$), pH ($16.8\%$), Dissolved Oxygen ($16.2\%$), Turbidity ($11.7\%$).

---

## 3. Explaining Predictions with SHAP (XAI)

SHAP extracts exact Shapley values from the trained XGBoost tree ensemble to explain how each parameter drives the predicted risk.

```bash
# Run SHAP verification tests
python models/shap/tests/test_shap.py
```

**Scientific Integrity Rule**: SHAP attributions represent mathematical model feature weights, not medical or biological disease causality.

---

## 4. EWMA Anomaly Detection Engine

Evaluates streaming sensor readings using dynamic control limits ($UCL / LCL$) and rate-of-change velocity.

```bash
# Run EWMA unit tests
python models/ewma/tests/test_ewma.py
```

---

## 5. YOLOv8 Shrimp Computer Vision

```bash
# Run inference tests using pretrained yolov8n weights
python models/yolo/tests/test_yolo.py

# Fine-tune on custom shrimp dataset
python models/yolo/train.py
```

**Diagnostic Disclaimer**: Generic bounding box detection does not constitute shrimp disease diagnosis. Visible anomalies require histopathology validation before definitive classification.
