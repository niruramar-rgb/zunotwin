"""
YOLOv8 Training pipeline for shrimp detection and visible anomalies
"""
from pathlib import Path
import sys

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

_BASE_DIR = Path(__file__).resolve().parent

def train_yolo(
    data_yaml: str = "dataset.yaml",
    epochs: int = 50,
    imgsz: int = 640,
    batch: int = 16
):
    if not ULTRALYTICS_AVAILABLE:
        print("Ultralytics package is required for YOLO training.")
        return

    yaml_path = _BASE_DIR / data_yaml
    if not yaml_path.exists():
        print(f"Dataset config not found at {yaml_path}. Use dataset.yaml.example as reference.")
        return

    base_model = _BASE_DIR / "weights" / "yolov8n.pt"
    if not base_model.exists():
        base_model = "yolov8n.pt"

    print(f"Starting YOLOv8 training using {base_model} on {yaml_path}...")
    model = YOLO(str(base_model))
    results = model.train(
        data=str(yaml_path),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=str(_BASE_DIR / "runs"),
        name="shrimp_detector",
        exist_ok=True
    )
    print("Training complete. Results saved in runs/shrimp_detector.")
    return results

if __name__ == "__main__":
    train_yolo()
