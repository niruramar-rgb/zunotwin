# ZUNO TWIN — System Architecture & Data Flow

## 1. System Overview

**ZUNO TWIN** is a cyber-physical AIoT aquaculture monitoring, early disease-risk prediction, and digital twin platform for smart shrimp hatcheries.

```
+-----------------------------------------------------------------------------------------+
|                                PHYSICAL HATCHERY TANK                                   |
|   Sensors: pH (GPIO 32), DO (GPIO 33), TDS (GPIO 34), Turbidity (GPIO 35),              |
|            Water Temp (GPIO 23 DS18B20), DHT11 (GPIO 4), Relay (GPIO 15)                |
+--------------------------------------------+--------------------------------------------+
                                             |
                         [USB Serial @ 115200 baud / MQTT]
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                     ZUNO TWIN BACKEND SERVICE (Node.js & Express)                       |
|                                                                                         |
|  * Hardware Serial Bridge: Auto-detects Silicon Labs CP210x / FTDI / CH340 COM ports    |
|  * Strict Heartbeat Failsafe: Delta > 5.0s -> 'DISCONNECTED' -> Mark telemetry offline   |
|  * Ingestion & Validation: Validates numerical ranges, rejects NaNs / open-circuit -999  |
|  * SQLite Persistence: sensor_readings, alerts, equipment_states, model_inferences      |
|  * Alert Engine: Real-time threshold breach detection, hysteresis & cooldowns           |
|  * Automation Service: Relay commands, cycle time safety, manual overrides, E-Stop      |
|  * Socket.IO Dispatcher: Broadcasts sensor-reading, hardware-status, equipment-status   |
+---------------------+---------------------------------------------+---------------------+
                      |                                             |
           REST / WebSockets (Port 5000)                 Internal REST (Port 8000)
                      |                                             |
                      v                                             v
+--------------------------------------------+  +-----------------------------------------+
|     3D DIGITAL TWIN WEB FRONTEND           |  |       AI / ML INFERENCE MICROSERVICE    |
|       (React 18 + Vite + Three.js)         |  |             (Python 3.13 + FastAPI)     |
|                                            |  |                                         |
|  * Cyber-Physical 3D Tank (R3F & Drei)     |  |  * YOLOv8 Shrimp Detector: Trackers &   |
|    - Translucent acrylic cylinder & rim    |  |    bounding boxes on camera frames      |
|    - Animated water wave displacement      |  |  * XGBoost Risk Regressor: Continuous   |
|    - Bubbling particles active on aerator  |  |    aquaculture water stress index       |
|    - Turbidity-responsive color shift      |  |  * AutoGluon: Multi-model comparison    |
|  * 7 Telemetry Sensor Cards with Real Data |  |  * SHAP: TreeExplainer Shapley XAI and  |
|  * Recharts 1h/6h/12h/24h/7d Trends        |  |    natural language advisories          |
|  * Camera Inspection & Human Review Studio |  |  * EWMA: Statistical anomaly detection  |
|  * Live Alerts & Equipment Console         |  |    with dynamic UCL/LCL control bands   |
+--------------------------------------------+  +-----------------------------------------+
```

## 2. Hardware Failsafe Rules

1. **Heartbeat Timeout**: If elapsed time since last valid ESP32 sensor heartbeat exceeds `5.0 seconds`, the hardware state switches from `CONNECTED` to `DISCONNECTED`.
2. **No Data Fabrication**: When disconnected, sensor cards strictly display `UNAVAILABLE / OFFLINE` rather than inventing mock numbers.
3. **Stale Telemetry Interlock**: When data age exceeds `10.0 seconds`, automated relay activations are locked to prevent interventions based on stale environmental readings.
4. **Relay Minimum Cycle Time**: All actuators enforce a minimum 15-second dwell time between state transitions to protect pump and aerator motors.

## 3. Database Schema

- `sensor_readings`: Chronological storage of all 7 sensor parameters with raw JSON payloads and source tags.
- `alerts`: Threshold violation events, severity (`WARNING`, `CRITICAL`), parameter, measured value, threshold, and acknowledgement status.
- `equipment_states`: Actuator statuses (`ON`, `OFF`, `UNKNOWN`), operating mode (`AUTO`, `MANUAL`), and hardware verification flag.
- `equipment_events`: Audit trail of all sent commands, sources, and verification outcomes.
- `model_inferences`: Log of AI model executions (YOLO, XGBoost, SHAP) with timestamps and confidence scores.
- `camera_analyses`: Uploaded image frames, detected shrimp counts, bounding boxes, and technician review statuses.
