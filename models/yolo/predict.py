"""
YOLOv8 Shrimp Detection and Visual Anomaly Pipeline
"""
import time
import sys
from pathlib import Path
from typing import Dict, Any, List, Union, Optional
import numpy as np
import cv2
from PIL import Image

_THIS_DIR = str(Path(__file__).resolve().parent)
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

from preprocess import validate_and_load_image

_BASE_DIR = Path(__file__).resolve().parent

class ShrimpYoloDetector:
    def __init__(self, model_weight: Union[str, Path] = None):
        if model_weight is None:
            # Check local weights, then backend weights, then root
            candidates = [
                _BASE_DIR / "weights" / "yolov8n.pt",
                _BASE_DIR.parent.parent / "yolov8n.pt",
                _BASE_DIR.parent.parent / "backend" / "yolov8n.pt"
            ]
            for c in candidates:
                if c.exists():
                    model_weight = c
                    break
            if model_weight is None:
                model_weight = _BASE_DIR / "weights" / "yolov8n.pt"

        self.weight_path = Path(model_weight)
        self.model = None
        self.loaded = False
        self._init_model()

    def _init_model(self):
        if ULTRALYTICS_AVAILABLE and self.weight_path.exists():
            try:
                self.model = YOLO(str(self.weight_path))
                self.loaded = True
                print(f"[YOLO] Loaded YOLOv8 weights from {self.weight_path}")
            except Exception as e:
                print(f"[YOLO] Initialization notice: {e}")
                self.loaded = False

    def is_ready(self) -> bool:
        return self.loaded

    def detect(self, image_input: Any, conf_threshold: float = 0.25) -> Dict[str, Any]:
        start_time = time.time()
        img = validate_and_load_image(image_input)

        if img is None:
            return {
                "status": "INVALID_IMAGE",
                "error": "Could not decode or validate input image",
                "shrimp_count": 0,
                "bounding_boxes": [],
                "latency_ms": 0
            }

        height, width = img.shape[:2]
        detections: List[Dict[str, Any]] = []

        if self.loaded and self.model is not None:
            try:
                results = self.model.predict(source=img, conf=conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for i, box in enumerate(boxes):
                        xyxy = box.xyxy[0].cpu().numpy().tolist()
                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy()) if hasattr(box, "cls") else 0
                        cls_name = r.names.get(cls_id, f"object_{cls_id}") if hasattr(r, "names") else "specimen"

                        x1, y1, x2, y2 = xyxy
                        area = float(max(0.0, (x2 - x1) * (y2 - y1)))

                        detections.append({
                            "id": f"specimen_{i+1}",
                            "class": cls_name,
                            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                            "normalized_bbox": [
                                round(x1 / width, 4), round(y1 / height, 4),
                                round(x2 / width, 4), round(y2 / height, 4)
                            ],
                            "confidence": round(conf, 3),
                            "area_pixels": round(area, 1)
                        })
            except Exception as e:
                print(f"[YOLO] Inference error: {e}")

        # If zero detections on blank/generic test image, detect aquatic contours
        if len(detections) == 0 and not self.loaded:
            detections = self._fallback_contour_detection(img, width, height)

        count = len(detections)
        total_area = sum(d["area_pixels"] for d in detections)
        avg_area = round(total_area / count, 1) if count > 0 else 0.0
        latency_ms = round((time.time() - start_time) * 1000, 1)

        return {
            "status": "READY" if self.loaded else "FALLBACK",
            "model_version": "YOLOv8n-1.0",
            "shrimp_count": count,
            "avg_bbox_area": avg_area,
            "bounding_boxes": detections,
            "latency_ms": latency_ms,
            "disease_detection_status": "AI disease-specific classification in development (requires histopathology dataset)",
            "disclaimer": "Visible symptoms can have multiple causes. Object detection does not constitute biological disease diagnosis."
        }

    def _fallback_contour_detection(self, img: np.ndarray, width: int, height: int) -> List[Dict[str, Any]]:
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        boxes = []
        for i, c in enumerate(contours[:4]):
            x, y, w, h = cv2.boundingRect(c)
            if w > 20 and h > 20:
                boxes.append({
                    "id": f"contour_{i+1}",
                    "class": "shrimp_candidate",
                    "bbox": [x, y, x + w, y + h],
                    "normalized_bbox": [round(x / width, 4), round(y / height, 4), round((x + w) / width, 4), round((y + h) / height, 4)],
                    "confidence": 0.65,
                    "area_pixels": float(w * h)
                })
        return boxes
