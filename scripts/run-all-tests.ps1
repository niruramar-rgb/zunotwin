Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     RUNNING COMPLETE ZUNO TWIN VERIFICATION SUITE       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Backend Integration Tests
Write-Host "`n[1/5] Running Backend & Hardware Bridge Integration Tests..." -ForegroundColor Yellow
node backend/tests/test_backend.js
if ($LASTEXITCODE -ne 0) { Write-Host "Backend tests failed!" -ForegroundColor Red; exit 1 }

# 2. EWMA Anomaly Detection Tests
Write-Host "`n[2/5] Running EWMA Anomaly Detector Unit Tests..." -ForegroundColor Yellow
python models/ewma/tests/test_ewma.py
if ($LASTEXITCODE -ne 0) { Write-Host "EWMA tests failed!" -ForegroundColor Red; exit 1 }

# 3. XGBoost Risk Prediction Tests
Write-Host "`n[3/5] Running XGBoost Water Quality Predictor Tests..." -ForegroundColor Yellow
python models/xgboost/tests/test_xgboost.py
if ($LASTEXITCODE -ne 0) { Write-Host "XGBoost tests failed!" -ForegroundColor Red; exit 1 }

# 4. SHAP Explainability Tests
Write-Host "`n[4/5] Running SHAP TreeExplainer Unit Tests..." -ForegroundColor Yellow
python models/shap/tests/test_shap.py
if ($LASTEXITCODE -ne 0) { Write-Host "SHAP tests failed!" -ForegroundColor Red; exit 1 }

# 5. YOLO Shrimp Detection Tests
Write-Host "`n[5/5] Running YOLOv8 Shrimp Vision Pipeline Tests..." -ForegroundColor Yellow
python models/yolo/tests/test_yolo.py
if ($LASTEXITCODE -ne 0) { Write-Host "YOLO tests failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  ALL 5 TEST SUITES PASSED CLEANLY WITH 100% SUCCESS!   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
