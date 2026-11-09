"""
Feature engineering and extraction for XGBoost Aquaculture Risk Prediction
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Any

FEATURE_COLUMNS = [
    "ph",
    "water_temperature",
    "turbidity",
    "tds",
    "salinity",
    "ammonia",
    "dissolved_oxygen"
]

# Standard target definition for Water Quality Stress Index based on FAO aquaculture standards
def compute_water_stress_index(df: pd.DataFrame) -> pd.Series:
    ph = df["ph"].fillna(8.0)
    temp = df["water_temperature"].fillna(28.5)
    turb = df["turbidity"].fillna(25.0)
    sal = df["salinity"].fillna(22.0)
    nh3 = df["ammonia"].fillna(0.02)
    do = df["dissolved_oxygen"].fillna(6.5)

    s_ph = np.maximum(0.0, (np.abs(ph - 8.0) - 0.4) / 1.5)
    s_do = np.maximum(0.0, (5.5 - do) / 4.0)
    s_nh3 = np.minimum(1.0, nh3 / 0.30)
    s_temp = np.maximum(0.0, (np.abs(temp - 29.0) - 2.5) / 6.0)
    s_turb = np.maximum(0.0, (turb - 35.0) / 65.0)
    s_sal = np.maximum(0.0, (np.abs(sal - 23.0) - 7.0) / 15.0)

    stress = (0.30 * s_do) + (0.25 * s_nh3) + (0.20 * s_ph) + (0.15 * s_temp) + (0.05 * s_turb) + (0.05 * s_sal)
    return pd.Series(np.clip(stress, 0.0, 1.0), index=df.index, name="water_risk_index")

def prepare_feature_dataframe(data: Any) -> pd.DataFrame:
    if isinstance(data, dict):
        # Normalize keys (e.g. temperature -> water_temperature, nh3 -> ammonia)
        mapped = {
            "ph": data.get("ph", data.get("ph_level", 8.0)),
            "water_temperature": data.get("water_temperature", data.get("temperature", data.get("water_temp", 28.5))),
            "turbidity": data.get("turbidity", 20.0),
            "tds": data.get("tds", data.get("tds_ec", 1650.0)),
            "salinity": data.get("salinity", 24.0),
            "ammonia": data.get("ammonia", data.get("nh3", 0.02)),
            "dissolved_oxygen": data.get("dissolved_oxygen", data.get("do_level", 6.5))
        }
        return pd.DataFrame([mapped], columns=FEATURE_COLUMNS)
    elif isinstance(data, pd.DataFrame):
        df = data.copy()
        if "nh3" in df.columns and "ammonia" not in df.columns:
            df["ammonia"] = df["nh3"]
        if "temperature" in df.columns and "water_temperature" not in df.columns:
            df["water_temperature"] = df["temperature"]
        if "water_temp" in df.columns and "water_temperature" not in df.columns:
            df["water_temperature"] = df["water_temp"]
        if "do_level" in df.columns and "dissolved_oxygen" not in df.columns:
            df["dissolved_oxygen"] = df["do_level"]
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0.0
        return df[FEATURE_COLUMNS]
    elif isinstance(data, (list, tuple)):
        return pd.DataFrame([data], columns=FEATURE_COLUMNS)
    else:
        raise ValueError(f"Unsupported data type for feature preparation: {type(data)}")
