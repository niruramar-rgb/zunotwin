# ZUNO TWIN — Complete AIoT Smart Shrimp Hatchery Platform

> **"Smarter Hatcheries. Healthier Shrimps."**

ZUNO TWIN is a complete, production-grade cyber-physical aquaculture monitoring, disease-risk detection, and 3D digital twin automation platform. The system bridges physical water-quality sensors and cameras through an ESP32 microcontroller, Node.js WebSocket backend, SQLite historical persistence, and machine-learning models (YOLOv8, XGBoost, AutoGluon, SHAP, and EWMA) into an interactive 3D WebGL hatchery digital twin.

---

## 1. Key Architectural Features

- **Cyber-Physical Sensor Bridge**:
  - Auto-detects physical ESP32 microcontrollers on USB Serial (`115,200 baud`) and MQTT (`shrimpsense/tanks/3/sensors`).
  - Supports 7 critical parameters: **pH**, **Water Temperature**, **Turbidity**, **TDS**, **Salinity**, **Alkalinity**, and **Ammonia (NH3)** (plus Dissolved Oxygen & Ambient Humidity).
  - **Critical Hardware Heartbeat Failsafe**: Delta $> 5.0\text{s}$ flags `DISCONNECTED` and halts automation to prevent acting on stale data.
  - **Zero Data Fabrication Policy**: When hardware is disconnected or probes are uncalibrated, values are displayed honestly as `UNAVAILABLE / OFFLINE`.
- **Interactive 3D Digital Twin**:
  - Built with **Three.js**, **React Three Fiber (R3F)**, and **Drei**.
  - Translucent acrylic tank cylinder, animated surface water wave dynamics, dynamic aeration bubbles triggered by physical relay state, inlet/drain pipes, and real-time turbidity/alarm shader color shifts.
  - Camera orbit controls (rotate, pan, zoom, reset) and full-screen toggle.
- **Machine Learning & Explainable AI**:
  - **YOLOv8** (`models/yolo`): Edge object detection, bounding box extraction, and shrimp counting.
  - **XGBoost** (`models/xgboost`): Water quality risk regressor trained on 92,896 authentic aquaculture records ($R^2 = 0.7761$, $\text{RMSE} = 0.0782$).
  - **SHAP** (`models/shap`): Exact TreeExplainer Shapley attributions synthesizing human-readable risk driver explanations.
  - **EWMA** (`models/ewma`): Statistical time-series anomaly detector with dynamic $UCL / LCL$ control limits and rate-of-change velocity.
  - **AutoGluon** (`models/autogluon`): AutoML multi-model leaderboard comparison workflow.
- **Equipment Safety & Automation**:
  - Configurable automation engine for Aerator, Water Pump, Heater, Filter, and Feeder.
  - Operating modes: `AUTO` vs `MANUAL`, minimum 15-second cycle dwell times (hysteresis), and Emergency Stop (`E-STOP`).

---

## 2. Directory Structure

```text
zuno-twin/
├── backend/                  # Node.js Express + Socket.IO Server & Hardware Bridge
│   ├── src/
│   │   ├── api/              # REST Endpoints (sensors, alerts, equipment, camera, models, reports)
│   │   ├── config/           # Thresholds, sensors mapping, env config
│   │   ├── database/         # SQLite schema, migrations, and seed scripts
│   │   ├── hardware/         # SerialBridge, MqttBridge, DeviceRegistry
│   │   ├── services/         # SensorService, AlertService, AutomationService, DigitalTwinService
│   │   ├── sockets/          # Socket.IO real-time event dispatchers
│   │   └── server.js         # HTTP & WebSocket entrypoint
│   └── tests/                # Automated backend integration tests
├── frontend/                 # React 18 + Vite + Three.js + Tailwind CSS Dashboard
│   ├── src/
│   │   ├── charts/           # Recharts Water Quality Trends
│   │   ├── components/       # Header, Sidebar, SensorCards, CameraAIPanel, EquipmentPanel, etc.
│   │   ├── contexts/         # SocketContext for live WebSocket streams
│   │   ├── pages/            # 8 working pages (Dashboard, Monitoring, Digital Twin, etc.)
│   │   ├── services/         # REST API client
│   │   ├── three/            # 3D WebGL Hatchery Tank Mesh & Shaders
│   │   └── App.jsx           # Root layout and view switcher
├── models/                   # Modular Python AI/ML pipelines
│   ├── yolo/                 # YOLOv8 detection, weights, and tests
│   ├── xgboost/              # Supervised training & prediction on aquaculture dataset
│   ├── autogluon/            # AutoML model leaderboard
│   ├── shap/                 # Game-theoretic XAI TreeExplainer
│   ├── ewma/                 # Statistical anomaly detection & control limits
│   └── ai_service.py         # Unified FastAPI AI microservice (Port 8000)
├── firmware/                 # Physical ESP32 Arduino sketch
│   └── esp32/                # shrimpsense_esp32.ino
├── data/                     # Authentic 92k-row aquaculture dataset & SQLite DB
├── docs/                     # Full system documentation
│   ├── architecture.md
│   ├── hardware-setup.md
│   ├── api-reference.md
│   ├── model-training.md
│   └── troubleshooting.md
└── scripts/                  # One-click Windows PowerShell startup and test scripts
```

---

## 3. Quickstart & Installation

### Prerequisites
- **Node.js**: v18+ (Tested on v22)
- **Python**: 3.10+ (Tested on 3.13)
- **USB Serial Driver**: Silicon Labs CP210x or CH340 (for ESP32 hardware)

### Option A: Complete One-Click Launch (PowerShell)
```powershell
# Run the complete automated test suite (Backend, EWMA, XGBoost, SHAP, YOLO)
.\scripts\run-all-tests.ps1

# Launch all 3 services simultaneously
.\scripts\start-all.ps1
```

### Option B: Individual Service Launch

#### 1. Backend Service (Port 5000)
```bash
cd backend
npm install
node src/server.js
```

#### 2. Python AI Inference Microservice (Port 8000)
```bash
cd models
python -m uvicorn ai_service:app --host 127.0.0.1 --port 8000
```

#### 3. React 3D Digital Twin Frontend (Port 5173)
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## 4. Hardware Connection & Test Bench

1. Connect the ESP32 via USB. The backend auto-detects active COM ports (e.g. `COM13`) at `115,200 baud`.
2. Telemetry is streamed in real time to the dashboard.
3. If no physical hardware is plugged in, click the **"Test Bench"** button in the dashboard header to inject explicitly labelled test fixtures (`nominal`, `warning`, `critical`). Test data is strictly isolated and stamped as `test_fixture_simulation`.

---

## 5. Verification & Test Suite

All 5 test suites pass with 100% success rate:
```powershell
.\scripts\run-all-tests.ps1
```
- **Backend & Hardware Bridge**: 10 integration tests (database, failsafe disconnect, threshold alerts, equipment E-Stop, trend queries).
- **EWMA Anomaly Detector**: 4 unit tests (warm-up periods, spike detection, missing data handling, multivariate vectors).
- **XGBoost Water Quality Predictor**: 2 unit tests (feature mapping, nominal vs critical hypoxia prediction).
- **SHAP TreeExplainer**: 2 unit tests (Shapley attribution vectors, natural language synthesis).
- **YOLOv8 Shrimp Vision Pipeline**: 2 unit tests (image validation, letterbox preprocessing, bounding box inference).
