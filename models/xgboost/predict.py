"""
Runtime prediction engine for XGBoost Water Quality Risk Model
"""
import json
import sys
from pathlib import Path
from typing import Dict, Any, Union, List
import numpy as np
import pandas as pd
import xgboost as xgb

_THIS_DIR = str(Path(__file__).resolve().parent)
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

from features import FEATURE_COLUMNS, prepare_feature_dataframe

class XGBoostRiskPredictor:
    def __init__(self, model_path: Union[str, Path] = None):
        base_dir = Path(__file__).resolve().parent
        if model_path is None:
            model_path = base_dir / "xgboost_model.json"
        self.model_path = Path(model_path)
        self.model = xgb.XGBRegressor()
        self.loaded = False

        if self.model_path.exists():
            try:
                self.model.load_model(str(self.model_path))
                self.loaded = True
            except Exception as e:
                print(f"[XGBoostPredictor] Error loading model: {e}")

    def is_ready(self) -> bool:
        return self.loaded

    def predict(self, feature_data: Any) -> Dict[str, Any]:
        if not self.loaded:
            return {
                "status": "NOT_TRAINED",
                "risk_index": None,
                "error": "XGBoost model weights not trained yet. Run train.py first."
            }

        df = prepare_feature_dataframe(feature_data)
        raw_pred = self.model.predict(df)[0]
        risk_index = float(np.clip(raw_pred, 0.0, 1.0))

        if risk_index > 0.45:
            risk_category = "CRITICAL"
        elif risk_index > 0.20:
            risk_category = "WARNING"
        else:
            risk_category = "OPTIMAL"

        return {
            "status": "READY",
            "model_version": "1.4.0",
            "risk_index": round(risk_index, 4),
            "risk_category": risk_category,
            "features_used": df.iloc[0].to_dict()
        }

    def get_booster(self):
        return self.model.get_booster()
