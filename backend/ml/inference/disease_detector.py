#!/usr/bin/env python3
"""
ZunoTwin AI Shrimp Disease Detection - Real-time Inference Engine
Integrates MobileNetV3 transfer learning model with failsafe handling,
out-of-distribution / low-confidence detection, and veterinary advisory output.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
MODELS_DIR = ML_DIR / "models"
MODEL_WEIGHTS_PATH = MODELS_DIR / "shrimp_disease_mobilenetv3.pt"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

DEFAULT_CLASSES = [
    "Healthy",
    "Black_Gill",
    "White_Spot_Syndrome_Virus",
    "Co_Infection_BG_WSSV"
]

DISEASE_DESCRIPTIONS = {
    "Healthy": {
        "label": "Healthy Specimen",
        "severity": "NORMAL",
        "description": "Clear translucent carapace, intact appendages, full digestive tract, and absence of melanized lesions or cuticular white spots.",
        "actions": [
            "Maintain baseline water quality monitoring (pH 7.8-8.3, DO > 5.5 mg/L, Temp 28-30°C).",
            "Follow standard bio-security and feeding schedules."
        ]
    },
    "Black_Gill": {
        "label": "Black Gill Disease (BG)",
        "severity": "WARNING",
        "description": "Melanization and brown/black discoloration of branchial lamellae caused by Fusarium fungal infection, bacterial encrustation, or severe particulate fouling.",
        "actions": [
            "Inspect mechanical bio-drum filter and aeration flow immediately.",
            "Conduct 20% water exchange with bio-secured conditioned water.",
            "Sample hemolymph or gill tissue for microscopic wet-mount confirmation.",
            "Reduce organic sediment buildup at bottom drains."
        ]
    },
    "White_Spot_Syndrome_Virus": {
        "label": "White Spot Syndrome Virus (WSSV)",
        "severity": "CRITICAL",
        "description": "Characteristic 0.5-2.0mm white calcified spots embedded beneath the carapace, reddish bodily discoloration, lethargy, and loose cuticle.",
        "actions": [
            "Quarantine tank effluent immediately to prevent transmission across hatchery bays.",
            "Perform immediate nested PCR or lateral-flow antigen test to confirm viral presence.",
            "Do not discharge pond/tank water into common drainage canals without chlorine disinfection.",
            "Consult regional aquatic veterinary officer for emergency containment."
        ]
    },
    "Co_Infection_BG_WSSV": {
        "label": "Co-Infection (Black Gill + WSSV)",
        "severity": "CRITICAL",
        "description": "Severe overlapping symptoms displaying both branchial gill melanization and sub-carapace white spot calcification.",
        "actions": [
            "Execute emergency isolation protocol for Tank 01.",
            "Halt live feeding and monitor dissolved oxygen to prevent secondary bacterial asphyxiation.",
            "Submit samples to certified aquatic animal health diagnostic laboratory."
        ]
    }
}

class ShrimpDiseaseDetector:
    def __init__(self, weights_path: Path = MODEL_WEIGHTS_PATH):
        self.weights_path = Path(weights_path)
        self.model = None
        self.classes = DEFAULT_CLASSES
        self.model_version = "MobileNetV3-Aquaculture-v1.0"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu") if TORCH_AVAILABLE else None
        self.transform = None

        if TORCH_AVAILABLE:
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            self._load_model()

    def _load_model(self):
        if not self.weights_path.exists():
            return

        try:
            checkpoint = torch.load(self.weights_path, map_location=self.device)
            self.classes = checkpoint.get("classes", DEFAULT_CLASSES)
            num_classes = len(self.classes)
            arch = checkpoint.get("arch", "mobilenet_v3_small")

            if arch == "mobilenet_v3_large":
                model = models.mobilenet_v3_large(weights=None)
                in_features = model.classifier[3].in_features
                model.classifier[3] = nn.Sequential(
                    nn.Linear(in_features, 128),
                    nn.Hardswish(),
                    nn.Dropout(p=0.3),
                    nn.Linear(128, num_classes)
                )
            else:
                model = models.mobilenet_v3_small(weights=None)
                in_features = model.classifier[3].in_features
                model.classifier[3] = nn.Sequential(
                    nn.Linear(in_features, 128),
                    nn.Hardswish(),
                    nn.Dropout(p=0.3),
                    nn.Linear(128, num_classes)
                )

            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(self.device)
            model.eval()
            self.model = model
        except Exception as e:
            print(f"[ShrimpDiseaseDetector] Warning: Could not load model: {e}", file=sys.stderr)
            self.model = None

    def is_ready(self) -> bool:
        return self.model is not None

    def analyze(self, image_path: str, upload_dir: Optional[str] = None) -> Dict[str, Any]:
        start_time = time.time()
        p = Path(image_path)

        if not p.exists():
            return {
                "success": False,
                "status": "FILE_NOT_FOUND",
                "error": f"Image file not found: {image_path}"
            }

        # 1. Validate file format and integrity
        try:
            with Image.open(p) as img:
                img.verify()
            # Reopen after verify
            pil_img = Image.open(p).convert("RGB")
        except Exception as e:
            return {
                "success": False,
                "status": "INVALID_IMAGE",
                "error": f"Corrupted or unsupported image file format: {str(e)}"
            }

        # 2. Check if model is trained and ready
        if not self.is_ready():
            return {
                "success": True,
                "status": "MODEL_NOT_READY",
                "modelVersion": self.model_version,
                "predictedClass": None,
                "confidence": None,
                "confidenceScore": None,
                "timestamp": int(time.time()),
                "message": (
                    "AI disease classification model has not been trained yet. "
                    "The system requires a histopathologically validated training dataset."
                ),
                "supportedDatasets": [
                    {
                        "name": "ShrimpDiseaseImageBD v3",
                        "doi": "10.17632/jhrtdj9txm.3",
                        "url": "https://data.mendeley.com/datasets/jhrtdj9txm/3",
                        "classes": ["Healthy", "BG", "WSSV", "BG_WSSV"]
                    },
                    {
                        "name": "TigerShrimpBD",
                        "doi": "10.17632/9dj4sk5d55.1",
                        "url": "https://data.mendeley.com/datasets/9dj4sk5d55/1",
                        "classes": ["Healthy", "WSSV", "Black Gill", "Yellow Head"]
                    }
                ],
                "explanation": "No diagnostic prediction can be made until model training is executed.",
                "disclaimer": "Diagnostic integrity rule: Fake disease predictions are strictly prohibited."
            }

        # 3. Perform real inference
        try:
            tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
            with torch.no_grad():
                outputs = self.model(tensor)
                probs = torch.softmax(outputs, dim=1)[0].cpu().numpy()

            pred_idx = int(np.argmax(probs))
            pred_class_raw = self.classes[pred_idx]
            max_conf = float(probs[pred_idx])

            # Class probability distribution map
            prob_map = {self.classes[i]: float(probs[i]) for i in range(len(self.classes))}

            # 4. Out-of-distribution / Inconclusive check (Confidence < 0.60)
            if max_conf < 0.60:
                return {
                    "success": True,
                    "status": "INCONCLUSIVE",
                    "modelVersion": self.model_version,
                    "predictedClass": "Inconclusive / Out-of-Distribution",
                    "confidence": max_conf,
                    "confidenceScore": f"{max_conf * 100:.1f}% (Uncalibrated Softmax)",
                    "probabilityDistribution": prob_map,
                    "timestamp": int(time.time()),
                    "latencyMs": int((time.time() - start_time) * 1000),
                    "explanation": (
                        f"Image visual features do not match trained disease signatures with sufficient confidence ({max_conf * 100:.1f}% < 60.0% threshold). "
                        "The specimen may have poor lighting, unusual orientation, or non-pathological variations."
                    ),
                    "actionableSteps": [
                        "Capture a clearer image under uniform diffuse lighting with the specimen fully visible.",
                        "Inspect specimen physically for gross clinical signs.",
                        "Conduct standard wet-mount or PCR laboratory verification if symptoms persist."
                    ],
                    "disclaimer": "Preliminary visual screening tool. Not a definitive veterinary diagnosis."
                }

            # Map raw class to standardized clinical output
            clean_class_key = "Healthy"
            for k in DISEASE_DESCRIPTIONS.keys():
                if k.lower() in pred_class_raw.lower():
                    clean_class_key = k
                    break

            info = DISEASE_DESCRIPTIONS.get(clean_class_key, DISEASE_DESCRIPTIONS["Healthy"])

            return {
                "success": True,
                "status": "SUCCESS",
                "modelVersion": self.model_version,
                "predictedClass": info["label"],
                "classKey": clean_class_key,
                "severity": info["severity"],
                "confidence": max_conf,
                "confidenceScore": f"{max_conf * 100:.1f}% (Uncalibrated Softmax)",
                "probabilityDistribution": prob_map,
                "timestamp": int(time.time()),
                "latencyMs": int((time.time() - start_time) * 1000),
                "explanation": info["description"],
                "actionableSteps": info["actions"],
                "disclaimer": "Preliminary visual AI screening tool. Not a substitute for certified aquatic veterinary histopathology."
            }

        except Exception as e:
            return {
                "success": False,
                "status": "INFERENCE_ERROR",
                "error": f"Model inference execution failed: {str(e)}"
            }

def main():
    if len(sys.argv) < 2:
        # Check model status
        detector = ShrimpDiseaseDetector()
        res = {
            "ready": detector.is_ready(),
            "modelVersion": detector.model_version,
            "classes": detector.classes,
            "weightsPath": str(detector.weights_path)
        }
        print(json.dumps(res, indent=2))
        return

    img_path = sys.argv[1]
    detector = ShrimpDiseaseDetector()
    result = detector.analyze(img_path)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
