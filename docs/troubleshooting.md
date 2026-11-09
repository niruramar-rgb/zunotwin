# ZUNO TWIN — Troubleshooting & Operations Guide

## 1. ESP32 Hardware Not Detected

**Symptom**: Dashboard displays `ESP32 OFFLINE (No USB COM port detected)`.

**Solutions**:
1. Verify the USB cable supports data transmission (not charge-only).
2. Check Windows Device Manager under `Ports (COM & LPT)`. You should see `Silicon Labs CP210x USB to UART Bridge` or `CH340`.
3. If the port is not auto-detected, explicitly set the port in `backend/.env`:
   ```env
   SERIAL_PORT=COM13
   ```
4. Verify no other serial monitor (e.g., Arduino IDE Serial Monitor or PuTTY) is holding an exclusive lock on the COM port.

---

## 2. Heartbeat Timeout / Disconnect Failsafe

**Symptom**: Status switches to `DISCONNECTED` with reason `Heartbeat delta > 5.0s`.

**Cause**: The ESP32 firmware sends telemetry every 5.0 seconds. If a packet is dropped or delayed, the strict cyber-physical failsafe engages to prevent acting on stale data.

**Solutions**:
1. Check the ESP32 Serial output at 115,200 baud to ensure the main loop is not blocking.
2. In `backend/.env`, you can adjust the tolerance threshold if testing over high-latency networks:
   ```env
   HEARTBEAT_TIMEOUT_SECONDS=6.0
   ```

---

## 3. Sensor Cards Display "OFFLINE / UNAVAILABLE"

**Reason**: ZUNO TWIN enforces a strict "no data fabrication" policy. If a physical sensor probe is unplugged, open-circuit, or uncalibrated, the firmware outputs `null` / `-999.0`, which the dashboard renders honestly as `UNAVAILABLE`.

**Solutions**:
1. Ensure the sensor ADC pins (GPIO 32, 33, 34, 35) are receiving power (3.3V / 5V) and signal.
2. For testing without physical hardware, click the **Test Bench** button in the dashboard header to inject explicitly labelled test fixtures (`nominal`, `warning`, `critical`).

---

## 4. Relay Actuator Does Not Trigger

**Safety Interlocks**:
1. The platform will block actuation if the ESP32 is disconnected or data is stale (> 10s).
2. The platform enforces a 15-second minimum cycle dwell time to protect motors.
3. Verify the relay wiring to GPIO 15 (Active LOW: setting GPIO 15 LOW closes the relay contact).
