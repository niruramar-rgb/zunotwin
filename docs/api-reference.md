# ZUNO TWIN — REST API & WebSocket Reference

## REST API (Default Port: 5000)

### 1. Sensors & Telemetry

- **`GET /api/sensors/latest?tankId=tank-01`**  
  Returns the latest sensor readings, 7 sensor cards summary, status, acceptable ranges, and 1-hour trend delta.
  
- **`GET /api/sensors/history?tankId=tank-01&period=1h|6h|12h|24h|7d`**  
  Returns chronologically ordered sensor readings persisted in SQLite for trend charting.

- **`GET /api/sensors/status`**  
  Returns the physical ESP32 connection state, detected COM port name, data age, and heartbeat health.

- **`POST /api/sensors/data`**  
  Direct HTTP POST telemetry ingestion endpoint matching the ESP32 firmware format.

- **`POST /api/sensors/simulate`**  
  Injects explicitly labelled test bench telemetry (`mode`: `nominal`, `warning`, `critical`).

---

### 2. Alerts

- **`GET /api/alerts?tankId=tank-01&all=false`**  
  Returns active unacknowledged alerts (or all historical alerts if `all=true`).

- **`POST /api/alerts/:id/ack`**  
  Acknowledges an individual alert.

- **`POST /api/alerts/ack-all`**  
  Acknowledges all active alerts for the tank.

---

### 3. Equipment & Actuators

- **`GET /api/equipment?tankId=tank-01`**  
  Lists all configured equipment, current states (`ON`, `OFF`, `UNKNOWN`), modes (`AUTO`, `MANUAL`), and hardware verification flags.

- **`POST /api/equipment/:id/command`**  
  Sends an `ON` or `OFF` command. Enforces hardware connectivity checks and minimum cycle time cooldowns.

- **`POST /api/equipment/:id/mode`**  
  Switches equipment operating mode between `AUTO` and `MANUAL`.

- **`POST /api/equipment/emergency-stop`**  
  Immediate failsafe halt of all active actuators and relays.

---

### 4. 3D Digital Twin

- **`GET /api/digital-twin/state?tankId=tank-01`**  
  Aggregates the 3D tank state, geometry, dynamic water shader parameters, particle bubbling density, and alert overlays.

---

### 5. Camera & Computer Vision

- **`GET /api/camera/status`**  
  Returns camera stream state and recent image inspection records.

- **`POST /api/camera/upload`**  
  Multipart/form-data upload of a tank frame. Executes YOLOv8 inference and returns specimen counts and bounding boxes.

---

### 6. Reports & Data Export

- **`GET /api/reports/water-quality?tankId=tank-01&hours=24`**  
  Returns parametric statistical summary (min, max, mean, missing data rate).

- **`GET /api/reports/export-csv?tankId=tank-01&hours=24`**  
  Streams a downloadable CSV of all persisted telemetry points.

---

## Real-Time WebSocket Events (Socket.IO)

Clients connect to `ws://localhost:5000` to receive push updates:

- **`initial-state`**: Full telemetry, equipment, and alert snapshot sent immediately upon client connection.
- **`sensor-reading`**: Emitted on every newly ingested reading vector.
- **`hardware-status`**: Emitted every 2 seconds reporting COM port link status and data freshness.
- **`alert-created`**: Emitted immediately when a water quality threshold is breached.
- **`equipment-status`**: Emitted when an equipment state or operating mode transitions.
