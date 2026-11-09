#!/usr/bin/env python3
"""
ZunoTwin AI Shrimp Black-Spot / Shell-Lesion Disease Classifier
Training Pipeline using MobileNetV3 Transfer Learning.

Scientific Grounding:
  Black Spot / Shell Lesion Disease (Rust/Ulcerative Shell Disease) is a bacterial
  infection caused by chitinolytic Vibrio, Aeromonas, or Pseudomonas degrading the
  exoskeleton cuticle and triggering proPO melanization.
  It is BIOLOGICALLY DISTINCT from Black Gill (BG) disease (branchial lamellae fouling).
  This pipeline strictly prohibits relabeling Black Gill images as Black Spot.
"""

import os
import sys
import json
import time
import hashlib
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, List, Set

import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset, Dataset
from torchvision import transforms, models

try:
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
    from sklearn.model_selection import StratifiedShuffleSplit
    from sklearn.utils.class_weight import compute_class_weight
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
DATA_DIR = ML_DIR / "data" / "black_spot"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"

TARGET_CLASSES = ["Healthy", "Black_Spot_Shell_Lesion"]

def parse_args():
    parser = argparse.ArgumentParser(description="Train Shrimp Black-Spot Detection Model")
    parser.add_argument("--data-dir", type=str, default=str(DATA_DIR), help="Path to verified black spot dataset")
    parser.add_argument("--epochs", type=int, default=15, help="Number of epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--arch", type=str, default="mobilenet_v3_small", choices=["mobilenet_v3_small", "mobilenet_v3_large"])
    return parser.parse_args()

def compute_file_hash(filepath: Path) -> str:
    """Computes SHA-256 hash of file content to prevent exact-duplicate leakage across splits."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def audit_dataset(data_dir: Path) -> Tuple[bool, str, Dict[str, List[Path]]]:
    """
    Audits the dataset directory:
    1. Rejects substitution of Black Gill (BG) images for Black Spot.
    2. Collects verified images for 'Healthy' and 'Black_Spot_Shell_Lesion'.
    3. Detects duplicate image hashes.
    """
    if not data_dir.exists():
        return False, f"Directory does not exist: {data_dir}", {}

    subdirs = {d.name.lower(): d for d in data_dir.iterdir() if d.is_dir()}

    # Strict Pathology Rule Check: Reject Black Gill relabeling
    for name in subdirs.keys():
        if "black_gill" in name or name == "bg":
            msg = (
                f"SCIENTIFIC VIOLATION: Directory '{name}' found in black-spot training path.\n"
                "Black Gill disease affects branchial lamellae and cannot be relabeled as "
                "Black Spot / Shell Lesion disease (which affects the chitinous exoskeleton)."
            )
            return False, msg, {}

    # Locate Healthy and Black Spot folders
    healthy_dir = None
    black_spot_dir = None

    for name, p in subdirs.items():
        if "healthy" in name:
            healthy_dir = p
        elif "black_spot" in name or "shell_lesion" in name or "brown_spot" in name:
            black_spot_dir = p

    if not healthy_dir or not black_spot_dir:
        msg = (
            f"Dataset at {data_dir} does not contain verified class directories.\n"
            f"Required folder structure:\n"
            f"  {data_dir}/Healthy/\n"
            f"  {data_dir}/Black_Spot_Shell_Lesion/\n"
            f"Note: Public Mendeley datasets only contain Black Gill (BG). "
            f"A verified farm-level shell lesion dataset (e.g. Bui et al. ICCITX 2026) is required."
        )
        return False, msg, {}

    valid_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    healthy_imgs = [f for f in healthy_dir.glob("*") if f.suffix.lower() in valid_exts]
    black_spot_imgs = [f for f in black_spot_dir.glob("*") if f.suffix.lower() in valid_exts]

    if len(healthy_imgs) < 10 or len(black_spot_imgs) < 10:
        msg = (
            f"Insufficient verified image samples for training:\n"
            f"  Healthy: {len(healthy_imgs)} images (minimum 10 required)\n"
            f"  Black Spot / Shell Lesion: {len(black_spot_imgs)} images (minimum 10 required)\n"
            f"Place confirmed specimens in {data_dir} before running training."
        )
        return False, msg, {"Healthy": healthy_imgs, "Black_Spot_Shell_Lesion": black_spot_imgs}

    # Deduplicate within and across classes
    unique_healthy = []
    unique_black_spot = []
    seen_hashes: Set[str] = set()

    for img_p in healthy_imgs:
        h = compute_file_hash(img_p)
        if h not in seen_hashes:
            seen_hashes.add(h)
            unique_healthy.append(img_p)

    for img_p in black_spot_imgs:
        h = compute_file_hash(img_p)
        if h not in seen_hashes:
            seen_hashes.add(h)
            unique_black_spot.append(img_p)

    return True, f"Dataset verified: {len(unique_healthy)} unique Healthy images, {len(unique_black_spot)} unique Black-Spot images.", {
        "Healthy": unique_healthy,
        "Black_Spot_Shell_Lesion": unique_black_spot
    }

class FilteredImageDataset(Dataset):
    def __init__(self, samples: List[Tuple[Path, int]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        with Image.open(path) as img:
            img = img.convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label

def build_model(arch: str = "mobilenet_v3_small") -> nn.Module:
    if arch == "mobilenet_v3_large":
        model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(64, 2)
        )
    else:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(64, 2)
        )
    return model

def main():
    args = parse_args()
    data_path = Path(args.data_dir)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("==================================================================")
    print("  ZunoTwin AI Shrimp Black-Spot / Shell-Lesion Training Pipeline")
    print("==================================================================")
    print(f"Dataset path: {data_path}")

    ready, msg, class_images = audit_dataset(data_path)

    if not ready:
        print("\n[DATASET AUDIT RESULT: TRAINING HALTED]")
        print(msg)

        # Write scientific audit report explaining limitation
        audit_file = REPORTS_DIR / "black_spot_dataset_status.json"
        with open(audit_file, "w") as f:
            json.dump({
                "status": "DATASET_VERIFICATION_REQUIRED",
                "timestamp": int(time.time()),
                "message": msg,
                "pathological_rule": (
                    "Black Gill (BG) affects gills beneath carapace and CANNOT be relabeled as Black Spot / Shell Lesion "
                    "(which is a bacterial chitinolytic cuticle erosion). Relabeling unrelated disease images is prohibited."
                ),
                "literature_benchmark": {
                    "study": "Minh-Huy Bui et al., 'A Novel Farm-Level Dataset and Real-Time Detection Framework for Shrimp Black Spot Disease', IEEE ICCITX 2026",
                    "sample_count": 1010,
                    "target": "Shrimp Black Spot Disease in Commercial Ponds"
                },
                "instructions": (
                    "Place verified Healthy shrimp images in backend/ml/data/black_spot/Healthy/ "
                    "and verified Black-Spot/Shell-Lesion images in backend/ml/data/black_spot/Black_Spot_Shell_Lesion/. "
                    "Then rerun: python backend/ml/training/train_black_spot_classifier.py"
                )
            }, f, indent=2)

        print(f"\nSaved dataset audit report to: {audit_file}")
        sys.exit(0)

    # If dataset is verified with confirmed images:
    healthy_samples = [(p, 0) for p in class_images["Healthy"]]
    black_spot_samples = [(p, 1) for p in class_images["Black_Spot_Shell_Lesion"]]
    all_samples = healthy_samples + black_spot_samples
    labels = [s[1] for s in all_samples]

    print(f"\n[Deduplication Verified] {len(all_samples)} total unique specimens.")

    # 70% Train, 15% Val, 15% Test stratified split
    sss_val = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=42)
    train_idx, temp_idx = next(sss_val.split(np.zeros(len(labels)), labels))

    temp_labels = [labels[i] for i in temp_idx]
    sss_test = StratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=42)
    val_sub_idx, test_sub_idx = next(sss_test.split(np.zeros(len(temp_labels)), temp_labels))

    val_idx = [temp_idx[i] for i in val_sub_idx]
    test_idx = [temp_idx[i] for i in test_sub_idx]

    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_data = FilteredImageDataset([all_samples[i] for i in train_idx], transform=train_transform)
    val_data = FilteredImageDataset([all_samples[i] for i in val_idx], transform=val_transform)
    test_data = FilteredImageDataset([all_samples[i] for i in test_idx], transform=val_transform)

    print(f"Dataset split: Train={len(train_data)}, Val={len(val_data)}, Test={len(test_data)}")

    # Class imbalance weighting
    train_labels = [labels[i] for i in train_idx]
    class_weights = compute_class_weight(
        class_weight="balanced",
        classes=np.unique(train_labels),
        y=train_labels
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)

    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_data, batch_size=args.batch_size, shuffle=False)

    model = build_model(arch=args.arch).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_val_acc = 0.0
    best_weights_path = MODELS_DIR / "shrimp_black_spot_mobilenetv3.pt"

    print("\nStarting Black-Spot classifier training...")
    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, targets in train_loader:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += torch.sum(preds == targets.data).item()
            total += targets.size(0)

        epoch_loss = running_loss / total
        epoch_acc = correct / total

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, targets in val_loader:
                images, targets = images.to(device), targets.to(device)
                outputs = model(images)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += torch.sum(preds == targets.data).item()
                val_total += targets.size(0)

        val_loss = val_loss / val_total
        val_acc = val_correct / val_total

        print(f"Epoch {epoch:02d}/{args.epochs:02d} | Train Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f} | Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({
                "model_state_dict": model.state_dict(),
                "classes": TARGET_CLASSES,
                "arch": args.arch,
                "val_acc": val_acc,
                "epoch": epoch,
                "timestamp": int(time.time())
            }, best_weights_path)

    duration = time.time() - start_time
    print(f"\nTraining completed in {duration:.1f}s. Best Val Accuracy: {best_val_acc:.4f}")

    # Evaluate on held-out test set
    checkpoint = torch.load(best_weights_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    all_preds = []
    all_labels = []
    with torch.no_grad():
        for images, targets in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy().tolist())
            all_labels.extend(targets.numpy().tolist())

    test_acc = accuracy_score(all_labels, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(all_labels, all_preds, average="binary", zero_division=0)
    cm = confusion_matrix(all_labels, all_preds).tolist()

    report = {
        "model_name": "MobileNetV3-ShrimpBlackSpot-Detector",
        "model_version": "v1.0-black-spot",
        "architecture": args.arch,
        "classes": TARGET_CLASSES,
        "test_metrics": {
            "accuracy": float(test_acc),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "confusion_matrix": cm
        },
        "training_duration_seconds": float(duration),
        "best_val_acc": float(best_val_acc),
        "weights_path": str(best_weights_path),
        "evaluated_at": int(time.time()),
        "pathological_disclaimer": "Diagnostic screening tool for cuticular shell lesions. Confirmatory diagnosis requires bacteriological swab and PCR."
    }

    report_path = REPORTS_DIR / "black_spot_evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    mapping_path = MODELS_DIR / "black_spot_class_mapping.json"
    with open(mapping_path, "w") as f:
        json.dump({
            "model_version": "MobileNetV3-BlackSpot-v1.0",
            "classes": TARGET_CLASSES,
            "architecture": args.arch,
            "accuracy": float(test_acc),
            "f1_score": float(f1),
            "trained_at": int(time.time()),
            "status": "READY"
        }, f, indent=2)

    print(f"Saved evaluation metrics to: {report_path}")
    print(f"Saved class mapping to: {mapping_path}")

if __name__ == "__main__":
    main()
