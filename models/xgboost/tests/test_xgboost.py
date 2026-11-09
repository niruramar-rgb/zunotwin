import unittest
import sys
from pathlib import Path

_XGB_DIR = Path(__file__).resolve().parent.parent
if str(_XGB_DIR) not in sys.path:
    sys.path.insert(0, str(_XGB_DIR))

from features import prepare_feature_dataframe, FEATURE_COLUMNS
from predict import XGBoostRiskPredictor

class TestXGBoost(unittest.TestCase):
    def test_feature_preparation_dict(self):
        input_data = {
            "ph": 8.1,
            "temperature": 28.5,
            "turbidity": 20.0,
            "tds": 1650.0,
            "salinity": 24.0,
            "ammonia": 0.02,
            "dissolved_oxygen": 6.5
        }
        df = prepare_feature_dataframe(input_data)
        self.assertEqual(list(df.columns), FEATURE_COLUMNS)
        self.assertEqual(df.iloc[0]["ph"], 8.1)
        self.assertEqual(df.iloc[0]["water_temperature"], 28.5)

    def test_predictor_nominal_and_stress(self):
        predictor = XGBoostRiskPredictor()
        if not predictor.is_ready():
            self.skipTest("XGBoost model not trained yet")

        # Nominal parameters
        res_nominal = predictor.predict({
            "ph": 8.0,
            "water_temperature": 28.5,
            "turbidity": 20.0,
            "tds": 1650.0,
            "salinity": 23.0,
            "ammonia": 0.01,
            "dissolved_oxygen": 6.8
        })
        self.assertEqual(res_nominal["status"], "READY")
        self.assertLess(res_nominal["risk_index"], 0.20)
        self.assertEqual(res_nominal["risk_category"], "OPTIMAL")

        # Extreme hypoxia + high ammonia stress
        res_stress = predictor.predict({
            "ph": 9.2,
            "water_temperature": 34.0,
            "turbidity": 75.0,
            "tds": 2800.0,
            "salinity": 35.0,
            "ammonia": 0.45,
            "dissolved_oxygen": 2.2
        })
        self.assertGreater(res_stress["risk_index"], 0.45)
        self.assertEqual(res_stress["risk_category"], "CRITICAL")

if __name__ == "__main__":
    unittest.main()
