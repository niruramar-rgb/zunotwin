import unittest
import sys
from pathlib import Path
import numpy as np

_YOLO_DIR = Path(__file__).resolve().parent.parent
if str(_YOLO_DIR) not in sys.path:
    sys.path.insert(0, str(_YOLO_DIR))

from preprocess import validate_and_load_image, preprocess_for_inference
from predict import ShrimpYoloDetector

class TestYolo(unittest.TestCase):
    def test_preprocess_and_validate(self):
        # Create a synthetic 480x640 blank canvas
        canvas = np.zeros((480, 640, 3), dtype=np.uint8)
        img = validate_and_load_image(canvas)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape, (480, 640, 3))

        preprocessed = preprocess_for_inference(img, (640, 640))
        self.assertEqual(preprocessed.shape, (640, 640, 3))

    def test_detector_inference(self):
        detector = ShrimpYoloDetector()
        self.assertTrue(detector.is_ready())

        # Test on dummy image
        canvas = np.zeros((480, 640, 3), dtype=np.uint8)
        res = detector.detect(canvas)
        self.assertIn("shrimp_count", res)
        self.assertIn("bounding_boxes", res)
        self.assertIn("disease_detection_status", res)
        self.assertEqual(res["status"], "READY")

if __name__ == "__main__":
    unittest.main()
