#!/usr/bin/env python3
"""
ZunoTwin AI Shrimp Disease Classifier - Transfer Learning Training Pipeline
Target Architecture: MobileNetV3-Small / MobileNetV3-Large (Transfer Learning)
Verified Datasets Supported:
  1. Mendeley ShrimpDiseaseImageBD v3 (DOI: 10.17632/jhrtdj9txm.3)
     Classes: Healthy, BG (Black Gill), WSSV (White Spot Syndrome Virus), BG_WSSV
  2. Mendeley TigerShrimpBD (DOI: 10.17632/9dj4sk5d55.1)
     Classes: Healthy, WSSV, Black Gill, Yellow Head
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, List

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms, models

try:
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
    from sklearn.model_selection import StratifiedShuffleSplit
    from sklearn.utils.class_weight import compute_class_weight
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

DISEASE_CLASSES = [
    "Healthy",
    "Black_Gill",
    "White_Spot_Syndrome_Virus",
    "Co_Infection_BG_WSSV"
]

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
DATA_DIR = ML_DIR / "data" / "shrimp_disease"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"

def parse_args():
    parser = argparse.ArgumentParser(description="Train ZunoTwin Shrimp Disease Classifier")
    parser.add_argument("--data-dir", type=str, default=str(DATA_DIR), help="Path to shrimp disease dataset")
    parser.add_argument("--epochs", type=int, default=15, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Initial learning rate")
    parser.add_argument("--arch", type=str, default="mobilenet_v3_small", choices=["mobilenet_v3_small", "mobilenet_v3_large"])
    return parser.parse_args()

def check_dataset_readiness(data_dir: Path) -> Tuple[bool, str, List[Path]]:
    if not data_dir.exists():
        return False, f"Data directory does not exist: {data_dir}", []

    # Check for subdirectories containing images
    subdirs = [d for d in data_dir.iterdir() if d.is_dir()]
    if len(subdirs) < 2:
        # Check if there is a 'Raw Images' subfolder
        raw_dir = data_dir / "Raw Images"
        if raw_dir.exists() and raw_dir.is_dir():
            subdirs = [d for d in raw_dir.iterdir() if d.is_dir()]

    if len(subdirs) < 2:
        msg = (
            f"Dataset at {data_dir} does not contain at least 2 class directories.\n"
            f"Expected directory structure based on Mendeley ShrimpDiseaseImageBD v3:\n"
            f"  {data_dir}/Healthy/\n"
            f"  {data_dir}/BG/\n"
            f"  {data_dir}/WSSV/\n"
            f"  {data_dir}/BG_WSSV/\n"
            f"Or download dataset from: https://data.mendeley.com/datasets/jhrtdj9txm/3"
        )
        return False, msg, []

    # Count image files
    valid_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    total_imgs = 0
    for d in subdirs:
        imgs = [f for f in d.glob("*") if f.suffix.lower() in valid_exts]
        total_imgs += len(imgs)

    if total_imgs < 10:
        return False, f"Dataset has only {total_imgs} images across {len(subdirs)} classes. Insufficient for training.", subdirs

    return True, f"Dataset ready with {len(subdirs)} classes and {total_imgs} total images.", subdirs

def build_model(num_classes: int, arch: str = "mobilenet_v3_small") -> nn.Module:
    if arch == "mobilenet_v3_large":
        model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(128, num_classes)
        )
    else:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(128, num_classes)
        )
    return model

def main():
    args = parse_args()
    data_path = Path(args.data_dir)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("==================================================================")
    print("  ZunoTwin AI Shrimp Disease Detection - Training Pipeline")
    print("==================================================================")
    print(f"Data directory: {data_path}")

    ready, msg, class_dirs = check_dataset_readiness(data_path)
    if not ready:
        print(f"\n[STATUS: DATASET_NOT_READY]")
        print(msg)
        # Write metadata documenting missing dataset state
        status_file = REPORTS_DIR / "dataset_status.json"
        with open(status_file, "w") as f:
            json.dump({
                "status": "DATASET_NOT_READY",
                "message": msg,
                "dataset_sources": [
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
                "instructions": "Download dataset archive, extract into backend/ml/data/shrimp_disease, and rerun train_disease_classifier.py."
            }, f, indent=2)
        sys.exit(0)

    print(f"[Dataset OK] {msg}")

    # Standard data transforms
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    full_dataset = datasets.ImageFolder(root=str(data_path), transform=train_transform)
    classes = full_dataset.classes
    num_classes = len(classes)
    targets = [s[1] for s in full_dataset.samples]

    print(f"Detected classes ({num_classes}): {classes}")

    # 70% Train, 15% Val, 15% Test split with stratified sampling
    sss_val = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=42)
    train_idx, temp_idx = next(sss_val.split(np.zeros(len(targets)), targets))

    temp_targets = [targets[i] for i in temp_idx]
    sss_test = StratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=42)
    val_sub_idx, test_sub_idx = next(sss_test.split(np.zeros(len(temp_targets)), temp_targets))

    val_idx = [temp_idx[i] for i in val_sub_idx]
    test_idx = [temp_idx[i] for i in test_sub_idx]

    train_data = Subset(full_dataset, train_idx)
    # Val & Test should use val_transform
    val_base = datasets.ImageFolder(root=str(data_path), transform=val_transform)
    val_data = Subset(val_base, val_idx)
    test_data = Subset(val_base, test_idx)

    print(f"Dataset split: Train={len(train_data)}, Val={len(val_data)}, Test={len(test_data)}")

    # Class imbalance handling
    train_targets = [targets[i] for i in train_idx]
    class_weights = compute_class_weight(
        class_weight="balanced",
        classes=np.unique(train_targets),
        y=train_targets
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)

    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_data, batch_size=args.batch_size, shuffle=False)

    model = build_model(num_classes, arch=args.arch).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_val_acc = 0.0
    best_model_path = MODELS_DIR / "shrimp_disease_mobilenetv3.pt"

    print("\nStarting model training...")
    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += torch.sum(preds == labels.data).item()
            total += labels.size(0)

        epoch_loss = running_loss / total
        epoch_acc = correct / total

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += torch.sum(preds == labels.data).item()
                val_total += labels.size(0)

        val_loss = val_loss / val_total
        val_acc = val_correct / val_total

        print(f"Epoch {epoch:02d}/{args.epochs:02d} | Train Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f} | Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({
                "model_state_dict": model.state_dict(),
                "classes": classes,
                "arch": args.arch,
                "val_acc": val_acc,
                "epoch": epoch,
                "timestamp": int(time.time())
            }, best_model_path)

    training_duration = time.time() - start_time
    print(f"\nTraining finished in {training_duration:.1f}s. Best Val Accuracy: {best_val_acc:.4f}")

    # Evaluate on held-out test set
    checkpoint = torch.load(best_model_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    all_preds = []
    all_labels = []
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy().tolist())
            all_labels.extend(labels.numpy().tolist())

    test_acc = accuracy_score(all_labels, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(all_labels, all_preds, average="weighted", zero_division=0)
    cm = confusion_matrix(all_labels, all_preds).tolist()

    report = {
        "model_name": "MobileNetV3-ShrimpDisease-Classifier",
        "model_version": "v1.0",
        "architecture": args.arch,
        "classes": classes,
        "num_classes": num_classes,
        "test_metrics": {
            "accuracy": float(test_acc),
            "precision_weighted": float(precision),
            "recall_weighted": float(recall),
            "f1_weighted": float(f1),
            "confusion_matrix": cm
        },
        "training_duration_seconds": float(training_duration),
        "best_val_acc": float(best_val_acc),
        "weights_path": str(best_model_path),
        "evaluated_at": int(time.time()),
        "disclaimer": "Visual screening tool only. Not a veterinary clinical diagnosis."
    }

    report_path = REPORTS_DIR / "evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    metadata_path = MODELS_DIR / "model_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump({
            "model_version": "MobileNetV3-Aquaculture-v1.0",
            "classes": classes,
            "architecture": args.arch,
            "accuracy": float(test_acc),
            "f1_score": float(f1),
            "trained_at": int(time.time()),
            "status": "READY"
        }, f, indent=2)

    print(f"Saved evaluation report to: {report_path}")
    print(f"Saved model metadata to: {metadata_path}")

if __name__ == "__main__":
    main()
