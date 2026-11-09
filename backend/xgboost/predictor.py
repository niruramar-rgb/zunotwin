"""
XGBoost Predictor runtime class for live inference
"""
import sys
from pathlib import Path
from typing import Dict, List, Union
import numpy as np
import pandas as pd

# Safe import of third-party xgboost avoiding local directory name collision
_backup_paths = sys.path[:]
_this_dir = str(Path(__file__).resolve().parent)
_backend_dir = str(Path(__file__).resolve().parent.parent)
sys.path = [p for p in sys.path if p not in (_this_dir, _backend_dir, "")]
try:
    import xgboost as xgb
finally:
    sys.path = _backup_paths

FEATURE_COLUMNS = [
    "shrimp_count",
    "avg_bbox_area",
    "water_temp",
    "ph_level",
    "do_level",
    "tds_ec",
    "turbidity"
]

class XGBoostStressPredictor:
    def __init__(self, model_path: Union[str, Path] = None):
        if model_path is None:
            model_path = Path(__file__).resolve().parent / "xgboost_model.json"
        self.model_path = Path(model_path)
        self.model = xgb.XGBRegressor()
        if self.model_path.exists():
            self.model.load_model(str(self.model_path))
            self._loaded = True
        else:
            self._loaded = False

    def is_loaded(self) -> bool:
        return self._loaded

    def predict(self, feature_data: Union[Dict[str, float], List[float], pd.DataFrame]) -> float:
        """
        Accepts dict with keys in FEATURE_COLUMNS, or list in column order, or DataFrame.
        Returns continuous stress_index strictly in [0.0, 1.0].
        """
        if isinstance(feature_data, dict):
            row = [feature_data.get(col, 0.0) for col in FEATURE_COLUMNS]
            df = pd.DataFrame([row], columns=FEATURE_COLUMNS)
        elif isinstance(feature_data, (list, tuple, np.ndarray)):
            df = pd.DataFrame([feature_data], columns=FEATURE_COLUMNS)
        elif isinstance(feature_data, pd.DataFrame):
            df = feature_data[FEATURE_COLUMNS]
        else:
            raise ValueError(f"Unsupported feature_data type: {type(feature_data)}")

        pred = self.model.predict(df)[0]
        return float(np.clip(pred, 0.0, 1.0))

    def get_raw_model(self) -> xgb.XGBRegressor:
        return self.model
