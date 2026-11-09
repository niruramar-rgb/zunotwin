"""
Model evaluation report generator for XGBoost Water Quality Predictor
"""
import json
from pathlib import Path
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from features import prepare_feature_dataframe, compute_water_stress_index

def evaluate():
    base_dir = Path(__file__).resolve().parent
    model_file = base_dir / "xgboost_model.json"
    data_file = base_dir.parent.parent / "data" / "raw" / "water_quality_aquaculture.csv"

    if not model_file.exists():
        print("Model file not found. Please run train.py first.")
        return

    model = xgb.XGBRegressor()
    model.load_model(str(model_file))

    df_raw = pd.read_csv(data_file)
    X = prepare_feature_dataframe(df_raw)
    y = compute_water_stress_index(X)

    # Use test partition (last 20%)
    split_idx = int(len(X) * 0.8)
    X_test, y_test = X.iloc[split_idx:], y.iloc[split_idx:]

    preds = np.clip(model.predict(X_test), 0.0, 1.0)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)

    print("=== INDEPENDENT TEST EVALUATION ===")
    print(f"Test Records: {len(X_test)}")
    print(f"R²:           {r2:.4f}")
    print(f"RMSE:         {rmse:.4f}")
    print(f"MAE:          {mae:.4f}")

if __name__ == "__main__":
    evaluate()
