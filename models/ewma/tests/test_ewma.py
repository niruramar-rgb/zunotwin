import unittest
import sys
from pathlib import Path

# Add models root to path
_MODELS_DIR = Path(__file__).resolve().parent.parent.parent
if str(_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(_MODELS_DIR))

from ewma.anomaly_detector import AquacultureEWMAEngine, SensorEWMAState

class TestEWMA(unittest.TestCase):
    def test_single_tracker_warmup(self):
        tracker = SensorEWMAState("ph", alpha=0.3, control_limit_k=3.0, warmup_points=5)
        # First 4 points are warming up
        for i in range(4):
            res = tracker.update(7.8 + i * 0.05)
            self.assertFalse(res["is_warmed_up"])
            self.assertIsNone(res["ucl"])

        # 5th point is warmed up
        res = tracker.update(7.9)
        self.assertTrue(res["is_warmed_up"])
        self.assertIsNotNone(res["ucl"])
        self.assertIsNotNone(res["lcl"])

    def test_anomaly_spike_detection(self):
        tracker = SensorEWMAState("ammonia", alpha=0.3, control_limit_k=2.5, warmup_points=5)
        # Establish stable baseline
        for _ in range(10):
            tracker.update(0.02)

        # Inject massive ammonia spike
        spike_res = tracker.update(0.85)
        self.assertTrue(spike_res["is_anomaly"])
        self.assertEqual(spike_res["severity"], "CRITICAL_DEVIATION")

    def test_missing_data_handling(self):
        tracker = SensorEWMAState("turbidity", alpha=0.25)
        tracker.update(18.0)
        tracker.update(18.5)
        # Missing reading (None)
        res = tracker.update(None)
        self.assertEqual(res["status"], "UNAVAILABLE")
        self.assertIsNone(res["value"])
        self.assertFalse(res["is_anomaly"])

    def test_multivariate_engine(self):
        engine = AquacultureEWMAEngine()
        payload = {
            "ph": 8.0,
            "temperature": 28.5,
            "turbidity": 22.0,
            "tds": 1700.0,
            "salinity": 24.0,
            "alkalinity": 150.0,
            "ammonia": 0.03
        }
        res = engine.process_vector(payload)
        self.assertEqual(len(res), 7)
        self.assertIn("ph", res)
        self.assertIn("ammonia", res)

if __name__ == "__main__":
    unittest.main()
