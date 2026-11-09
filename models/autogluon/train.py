"""
AutoGluon Tabular workflow for comparing multiple machine learning models
(LightGBM, CatBoost, XGBoost, Neural Nets, WeightedEnsemble) on real aquaculture dataset.
"""
from pathlib import Path
import pandas as pd
import sys

_BASE_DIR = Path(__file__).resolve().parent
_XGB_DIR = _BASE_DIR.parent / "xgboost"
if str(_XGB_DIR) not in sys.path:
    sys.path.insert(0, str(_XGB_DIR))

from features import prepare_feature_dataframe, compute_water_stress_index

try:
    from autogluon.tabular import TabularPredictor
    AUTOGLUON_AVAILABLE = True
except ImportError:
    AUTOGLUON_AVAILABLE = False

def run_benchmark(sample_size: int = 5000, time_limit_sec: int = 60):
    if not AUTOGLUON_AVAILABLE:
        print("AutoGluon is not installed or available in this environment.")
        return

    data_file = _BASE_DIR.parent.parent / "data" / "raw" / "water_quality_aquaculture.csv"
    if not data_file.exists():
        print(f"Data file not found at {data_file}")
        return

    print(f"Loading dataset for AutoGluon model leaderboard comparison (samples={sample_size})...")
    df_raw = pd.read_csv(data_file)
    X = prepare_feature_dataframe(df_raw.head(sample_size))
    y = compute_water_stress_index(X)

    train_data = X.copy()
    train_data["target"] = y

    # Time-aware split without leakage
    split = int(len(train_data) * 0.8)
    train_df = train_data.iloc[:split]
    test_df = train_data.iloc[split:]

    save_path = _BASE_DIR / "ag_models"
    predictor = TabularPredictor(label="target", path=str(save_path), eval_metric="root_mean_squared_error").fit(
        train_data=train_df,
        time_limit=time_limit_sec,
        presets="medium_quality",
        verbosity=1
    )

    print("\n=== AUTOGLUON MODEL COMPARISON LEADERBOARD ===")
    leaderboard = predictor.leaderboard(test_df)
    print(leaderboard)

    # Save leaderboard
    leaderboard.to_csv(_BASE_DIR / "leaderboard.csv", index=False)
    print("Leaderboard saved to leaderboard.csv")

if __name__ == "__main__":
    run_benchmark()
