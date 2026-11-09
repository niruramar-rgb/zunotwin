"""
SHAP Explainable AI (XAI) Engine for Aquaculture Water Quality Risk Model
Extracts Shapley values using TreeExplainer on XGBoost regressor,
computes global and local feature contributions, and synthesizes honest human-readable explanations.
"""
import sys
from pathlib import Path
from typing import Dict, Any, List, Union
import numpy as np
import pandas as pd
import shap

# Add xgboost directory to path
_XGB_DIR = Path(__file__).resolve().parent.parent / "xgboost"
if str(_XGB_DIR) not in sys.path:
    sys.path.insert(0, str(_XGB_DIR))

from features import FEATURE_COLUMNS, prepare_feature_dataframe
from predict import XGBoostRiskPredictor

class AquacultureShapExplainer:
    def __init__(self, predictor: XGBoostRiskPredictor = None):
        if predictor is None:
            predictor = XGBoostRiskPredictor()
        self.predictor = predictor
        self.explainer = None
        self._init_explainer()

    def _init_explainer(self):
        if self.predictor.is_ready():
            try:
                model = self.predictor.model
                self.explainer = shap.TreeExplainer(model)
                print("[ShapExplainer] TreeExplainer initialized successfully.")
            except Exception as e:
                print(f"[ShapExplainer] TreeExplainer init warning: {e}")
                self.explainer = None

    def is_ready(self) -> bool:
        return self.explainer is not None

    def explain(self, input_data: Any) -> Dict[str, Any]:
        if not self.is_ready():
            return {
                "status": "NOT_AVAILABLE",
                "message": "SHAP TreeExplainer not ready (underlying XGBoost model not loaded)",
                "attributions": {},
                "actionable_advice": "Model explanation currently unavailable."
            }

        df = prepare_feature_dataframe(input_data)
        values_dict = df.iloc[0].to_dict()

        # Compute exact Shapley values
        shap_res = self.explainer(df)
        shap_vals = shap_res.values[0]
        base_val = float(shap_res.base_values[0]) if hasattr(shap_res, "base_values") else 0.15

        attributions = {}
        contributions = []

        for i, col in enumerate(FEATURE_COLUMNS):
            attr_val = float(shap_vals[i])
            cur_val = float(values_dict.get(col, 0.0))
            attributions[col] = round(attr_val, 4)

            impact = "NEUTRAL"
            if attr_val > 0.02:
                impact = "RISK_INDUCING"
            elif attr_val < -0.02:
                impact = "RISK_ALLEVIATING"

            contributions.append({
                "feature": col,
                "current_value": round(cur_val, 3),
                "shap_attribution": round(attr_val, 4),
                "impact": impact
            })

        # Sort by absolute attribution magnitude
        contributions.sort(key=lambda x: abs(x["shap_attribution"]), reverse=True)
        primary_driver = contributions[0]["feature"] if contributions else "ammonia"

        # Synthesize honest, scientific explanation
        natural_explanation = self._synthesize_natural_language(contributions, values_dict)

        return {
            "status": "READY",
            "base_value": round(base_val, 4),
            "attributions": attributions,
            "sorted_contributions": contributions,
            "primary_driver": primary_driver,
            "natural_explanation": natural_explanation,
            "disclaimer": "SHAP reflects mathematical model feature contributions, not medical or biological disease causality."
        }

    def _synthesize_natural_language(self, contributions: List[Dict[str, Any]], values: Dict[str, float]) -> str:
        if not contributions:
            return "All water parameters are within optimal ranges."

        top = contributions[0]
        feature_name_map = {
            "ammonia": "Total Ammonia Nitrogen (NH3)",
            "dissolved_oxygen": "Dissolved Oxygen (DO)",
            "ph": "Water pH",
            "turbidity": "Turbidity",
            "water_temperature": "Water Temperature",
            "salinity": "Salinity",
            "tds": "Total Dissolved Solids"
        }

        top_name = feature_name_map.get(top["feature"], top["feature"])
        val_str = f"{top['current_value']}"

        if top["impact"] == "RISK_INDUCING":
            text = f"{top_name} ({val_str}) contributed most positively (+{top['shap_attribution']}) to the predicted water risk."
        elif top["impact"] == "RISK_ALLEVIATING":
            text = f"{top_name} ({val_str}) provided the strongest mitigating effect ({top['shap_attribution']}) keeping risk low."
        else:
            text = f"{top_name} ({val_str}) is currently stable with minimal contribution ({top['shap_attribution']})."

        # Add second contributor if significant
        if len(contributions) > 1 and abs(contributions[1]["shap_attribution"]) > 0.01:
            second = contributions[1]
            sec_name = feature_name_map.get(second["feature"], second["feature"])
            if second["impact"] == "RISK_INDUCING":
                text += f" Meanwhile, {sec_name} ({second['current_value']}) also elevated predicted risk (+{second['shap_attribution']})."
            else:
                text += f" Meanwhile, {sec_name} ({second['current_value']}) is within safe bounds ({second['shap_attribution']})."

        return text
