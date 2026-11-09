"""
XGBoost Stress Index Model Trainer for ZunoTwin
Ingests aquaculture dataset feature vector:
[shrimp_count, avg_bbox_area, water_temp, ph_level, do_level, tds_ec, turbidity]
Trains an XGBRegressor to predict continuous live stress_index (0.0 to 1.0)
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

FEATURE_COLUMNS = [
    "shrimp_count",
    "avg_bbox_area",
    "water_temp",
    "ph_level",
    "do_level",
    "tds_ec",
    "turbidity"
]
TARGET_COLUMN = "stress_index"

def train_xgboost_model(data_path: str = None, model_dir: str = None):
    root_dir = Path(__file__).resolve().parent.parent
    if data_path is None:
        data_path = root_dir / "data" / "aquaculture_dataset.csv"
    if model_dir is None:
        model_dir = Path(__file__).resolve().parent
    else:
        model_dir = Path(model_dir)

    model_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(data_path)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = xgb.XGBRegressor(
        n_estimators=180,
        max_depth=5,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="reg:squarederror",
        random_state=42
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 0.0, 1.0)

    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae = float(mean_absolute_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    model_path = model_dir / "xgboost_model.json"
    model.save_model(str(model_path))

    metrics = {
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2_score": round(r2, 4),
        "features": FEATURE_COLUMNS,
        "n_samples": len(df)
    }

    metrics_path = model_dir / "model_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"XGBoost Model trained successfully!")
    print(f"Metrics: RMSE={rmse:.4f}, MAE={mae:.4f}, R2={r2:.4f}")
    print(f"Saved model to: {model_path}")

    return model, metrics

if __name__ == "__main__":
    train_xgboost_model()
