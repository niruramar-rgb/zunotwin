"""
Supervised XGBoost training pipeline for Aquaculture Water Quality Risk Prediction.
Trains on authentic 92k row aquaculture dataset with time-aware sequential train/test split.
"""
import json
import time
from pathlib import Path
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from features import FEATURE_COLUMNS, compute_water_stress_index, prepare_feature_dataframe

def train():
    base_dir = Path(__file__).resolve().parent
    data_path = base_dir.parent.parent / "data" / "raw" / "water_quality_aquaculture.csv"

    if not data_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {data_path}")

    print(f"Loading raw aquaculture dataset from: {data_path}...")
    df_raw = pd.read_csv(data_path)
    print(f"Loaded {len(df_raw)} records.")

    # Feature preparation
    X = prepare_feature_dataframe(df_raw)
    y = compute_water_stress_index(X)

    # Time-aware sequential split without leakage (80% train, 20% test)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"Train samples: {len(X_train)}, Test samples: {len(X_test)}")

    # Model training
    model = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        tree_method="hist",
        early_stopping_rounds=15
    )

    print("Fitting XGBoost regressor...")
    start_time = time.time()
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    training_time = round(time.time() - start_time, 2)
    print(f"Training completed in {training_time}s.")

    # Evaluation
    preds = model.predict(X_test)
    preds = np.clip(preds, 0.0, 1.0)

    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    mae = float(mean_absolute_error(y_test, preds))
    r2 = float(r2_score(y_test, preds))

    print(f"=== XGBOOST VALIDATION METRICS ===")
    print(f"R² Score: {r2:.4f}")
    print(f"RMSE:     {rmse:.4f}")
    print(f"MAE:      {mae:.4f}")

    # Feature Importances
    importances = {col: float(imp) for col, imp in zip(FEATURE_COLUMNS, model.feature_importances_)}
    print("Feature Importances:", importances)

    # Save model and metadata
    model_file = base_dir / "xgboost_model.json"
    model.save_model(str(model_file))
    print(f"Model saved to: {model_file}")

    metrics = {
        "model_name": "XGBoost Aquaculture Water Quality Risk Regressor",
        "version": "1.4.0",
        "dataset_rows": len(df_raw),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "r2_score": round(r2, 4),
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "training_time_seconds": training_time,
        "feature_importances": importances,
        "features": FEATURE_COLUMNS,
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    with open(base_dir / "model_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("Metrics written to model_metrics.json.")
    return metrics

if __name__ == "__main__":
    train()
