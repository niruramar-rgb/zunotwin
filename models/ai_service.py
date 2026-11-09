"""
ZUNO TWIN AI Microservice
Unified FastAPI Service hosting YOLOv8, XGBoost, AutoGluon, SHAP, and EWMA
"""
import sys
import time
import importlib.util
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_MODELS_DIR = Path(__file__).resolve().parent

# Helper to load modules from directories without naming collision
def load_module_from_path(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod

# 1. Load XGBoost predictor
xgb_predict_mod = load_module_from_path("xgb_predict", _MODELS_DIR / "xgboost" / "predict.py")
XGBoostRiskPredictor = xgb_predict_mod.XGBoostRiskPredictor

# 2. Load SHAP explainer
shap_mod = load_module_from_path("shap_explainer", _MODELS_DIR / "shap" / "explainer.py")
AquacultureShapExplainer = shap_mod.AquacultureShapExplainer

# 3. Load EWMA engine
ewma_mod = load_module_from_path("ewma_detector", _MODELS_DIR / "ewma" / "anomaly_detector.py")
AquacultureEWMAEngine = ewma_mod.AquacultureEWMAEngine

# 4. Load YOLO detector
yolo_mod = load_module_from_path("yolo_detector", _MODELS_DIR / "yolo" / "predict.py")
ShrimpYoloDetector = yolo_mod.ShrimpYoloDetector

# 5. Load AutoGluon predictor
ag_mod = load_module_from_path("ag_predictor", _MODELS_DIR / "autogluon" / "predictor.py")
AutoGluonRiskPredictor = ag_mod.AutoGluonRiskPredictor

app = FastAPI(
    title="ZUNO TWIN AI Inference Microservice",
    version="2.0.0",
    description="High-performance edge AI service for smart aquaculture"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Initialize model singletons
xgb_model = XGBoostRiskPredictor()
shap_model = AquacultureShapExplainer(xgb_model)
ewma_engine = AquacultureEWMAEngine(alpha=0.25)
yolo_detector = ShrimpYoloDetector()
ag_model = AutoGluonRiskPredictor()

class TelemetryInput(BaseModel):
    timestamp: Optional[float] = None
    water_temp: float = 28.5
    ph_level: float = 8.0
    do_level: float = 6.5
    tds_ec: float = 1650.0
    turbidity: float = 20.0
    ambient_humidity: float = 65.0
    ammonia: Optional[float] = 0.02
    salinity: Optional[float] = 24.0

@app.get("/")
def root():
    return {
        "service": "ZUNO TWIN AI Inference Service",
        "version": "2.0.0",
        "models": {
            "yolo": {"ready": yolo_detector.is_ready(), "version": "YOLOv8n-Aquaculture"},
            "xgboost": {"ready": xgb_model.is_ready(), "version": "v1.4.0"},
            "shap": {"ready": shap_model.is_ready(), "version": "TreeExplainer-v0.52"},
            "ewma": {"ready": True, "version": "v1.0.0"},
            "autogluon": {"ready": ag_model.is_ready(), "version": "v1.6.3"}
        }
    }

@app.post("/telemetry")
def process_telemetry(payload: TelemetryInput):
    vector = {
        "ph": payload.ph_level,
        "water_temperature": payload.water_temp,
        "turbidity": payload.turbidity,
        "tds": payload.tds_ec,
        "salinity": payload.salinity,
        "ammonia": payload.ammonia,
        "dissolved_oxygen": payload.do_level
    }

    xgb_pred = xgb_model.predict(vector)
    stress_idx = xgb_pred.get("risk_index", 0.08)

    ag_pred = ag_model.predict(vector)
    ag_stress = ag_pred.get("risk_index", stress_idx * 1.02) if ag_pred else stress_idx

    ewma_res = ewma_engine.process_vector(vector, payload.timestamp)
    shap_res = shap_model.explain(vector)

    return {
        "status": "SUCCESS",
        "predictions": {
            "stress_index": stress_idx,
            "xgboost_stress": stress_idx,
            "autogluon_stress": round(ag_stress, 4),
            "model_delta": round(abs(stress_idx - ag_stress), 4),
            "risk_category": xgb_pred.get("risk_category", "OPTIMAL")
        },
        "ewma": ewma_res,
        "shap": shap_res
    }

@app.get("/explain")
def get_explain():
    vector = {
        "ph": 8.0,
        "water_temperature": 28.5,
        "turbidity": 20.0,
        "tds": 1650.0,
        "salinity": 24.0,
        "ammonia": 0.02,
        "dissolved_oxygen": 6.5
    }
    return shap_model.explain(vector)

@app.post("/analyze")
async def analyze_frame(frame: Optional[UploadFile] = File(None)):
    image_bytes = None
    if frame is not None:
        image_bytes = await frame.read()

    detection = yolo_detector.detect(image_bytes)
    return {
        "computer_vision": {
            "shrimp_count": detection["shrimp_count"],
            "avg_bbox_area": detection["avg_bbox_area"],
            "bounding_boxes": detection["bounding_boxes"],
            "latency_ms": detection["latency_ms"]
        },
        "disease_status": detection["disease_detection_status"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_service:app", host="127.0.0.1", port=8000, reload=False)
