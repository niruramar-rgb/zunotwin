import unittest
import sys
from pathlib import Path

_SHAP_DIR = Path(__file__).resolve().parent.parent
if str(_SHAP_DIR) not in sys.path:
    sys.path.insert(0, str(_SHAP_DIR))

from explainer import AquacultureShapExplainer

class TestShap(unittest.TestCase):
    def test_explainer_initialization(self):
        explainer = AquacultureShapExplainer()
        self.assertTrue(explainer.is_ready())

    def test_high_ammonia_explanation(self):
        explainer = AquacultureShapExplainer()
        payload = {
            "ph": 8.0,
            "water_temperature": 28.5,
            "turbidity": 20.0,
            "tds": 1650.0,
            "salinity": 24.0,
            "ammonia": 0.55, # Highly elevated
            "dissolved_oxygen": 6.5
        }
        res = explainer.explain(payload)
        self.assertEqual(res["status"], "READY")
        self.assertIn("attributions", res)
        self.assertEqual(res["primary_driver"], "ammonia")
        self.assertIn("Total Ammonia", res["natural_explanation"])
        self.assertIn("disclaimer", res)

if __name__ == "__main__":
    unittest.main()
