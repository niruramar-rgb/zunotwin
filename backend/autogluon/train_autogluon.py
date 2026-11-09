"""
AutoGluon Tabular Ensemble Model Trainer for ZunoTwin
Trains a tabular ensemble on the aquaculture feature vector
to enable real-time prediction model comparison against XGBoost.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from autogluon.tabular import TabularPredictor

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

def train_autogluon_ensemble(data_path: str = None, model_dir: str = None):
    root_dir = Path(__file__).resolve().parent.parent
    if data_path is None:
        data_path = root_dir / "data" / "aquaculture_dataset.csv"
    if model_dir is None:
        model_dir = Path(__file__).resolve().parent / "ag_models"
    else:
        model_dir = Path(model_dir)

    df = pd.read_csv(data_path)
    train_data = df[FEATURE_COLUMNS + [TARGET_COLUMN]]

    # Train AutoGluon Tabular ensemble with fast 'medium_quality' or 'good_quality' preset
    predictor = TabularPredictor(
        label=TARGET_COLUMN,
        problem_type="regression",
        eval_metric="root_mean_squared_error",
        path=str(model_dir)
    ).fit(
        train_data=train_data,
        time_limit=45,  # 45 seconds fast ensemble training
        presets="medium_quality",
        verbosity=2
    )

    leaderboard = predictor.leaderboard(train_data, silent=True)
    best_model_name = predictor.get_model_best()

    summary_metrics = {
        "best_model": best_model_name,
        "eval_metric": "root_mean_squared_error",
        "models_count": len(leaderboard),
        "leaderboard": leaderboard[["model", "score_val", "pred_time_val", "fit_time"]].head(5).to_dict(orient="records") if "score_val" in leaderboard.columns else []
    }

    metrics_file = Path(__file__).resolve().parent / "autogluon_metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(summary_metrics, f, indent=2)

    print(f"AutoGluon Tabular ensemble training completed!")
    print(f"Best model: {best_model_name}")
    print(leaderboard.head())

    return predictor, summary_metrics

if __name__ == "__main__":
    train_autogluon_ensemble()
