"""
Image preprocessing and validation utilities for YOLO shrimp vision pipeline
"""
import io
from pathlib import Path
from typing import Tuple, Union, Optional
import numpy as np
import cv2
from PIL import Image

def validate_and_load_image(image_input: Union[bytes, str, Path, np.ndarray, Image.Image]) -> Optional[np.ndarray]:
    """
    Validates image bytes, file path, PIL Image, or numpy array.
    Returns standard RGB numpy array, or None if invalid.
    """
    if image_input is None:
        return None

    try:
        if isinstance(image_input, bytes):
            image = Image.open(io.BytesIO(image_input)).convert("RGB")
            return np.array(image)
        elif isinstance(image_input, (str, Path)):
            p = Path(image_input)
            if not p.exists():
                return None
            image = Image.open(p).convert("RGB")
            return np.array(image)
        elif isinstance(image_input, Image.Image):
            return np.array(image_input.convert("RGB"))
        elif isinstance(image_input, np.ndarray):
            if len(image_input.shape) == 2:
                return cv2.cvtColor(image_input, cv2.COLOR_GRAY2RGB)
            elif len(image_input.shape) == 3 and image_input.shape[2] == 4:
                return cv2.cvtColor(image_input, cv2.COLOR_RGBA2RGB)
            elif len(image_input.shape) == 3 and image_input.shape[2] == 3:
                return image_input
            return None
    except Exception as e:
        print(f"[YOLO Preprocess] Error parsing image: {e}")
        return None

def preprocess_for_inference(img: np.ndarray, target_size: Tuple[int, int] = (640, 640)) -> np.ndarray:
    """
    Resizes image maintaining aspect ratio with letterboxing for YOLO inference.
    """
    h, w = img.shape[:2]
    target_w, target_h = target_size
    scale = min(target_w / w, target_h / h)
    nw, nh = int(w * scale), int(h * scale)
    
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((target_h, target_w, 3), 114, dtype=np.uint8)
    dx = (target_w - nw) // 2
    dy = (target_h - nh) // 2
    canvas[dy:dy+nh, dx:dx+nw] = resized
    return canvas
