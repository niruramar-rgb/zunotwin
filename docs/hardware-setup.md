# ZUNO TWIN — Physical Hardware Wiring & Setup Guide

## 1. ESP32 Microcontroller Pinout (From `firmware/esp32/shrimpsense_esp32.ino`)

The hardware prototype utilizes an **ESP-WROOM-32 (ESP32 Dev Module)** connected via USB Serial or Wi-Fi.

| Sensor / Actuator | Physical Pin | Interface | Operational Range | Hardware Sensor Model |
| :--- | :--- | :--- | :--- | :--- |
| **Analog pH Sensor** | GPIO 32 | ADC1 CH4 (12-bit) | 0.0 – 14.0 pH | Analog pH Kit v1.1 |
| **Analog Dissolved Oxygen (DO)** | GPIO 33 | ADC1 CH5 (12-bit) | 0.0 – 20.0 mg/L | Galvanic DO Probe |
| **Analog TDS / EC Meter** | GPIO 34 | ADC1 CH6 (12-bit) | 0 – 3000 ppm | Analog TDS Sensor V1.0 |
| **Analog Turbidity Sensor** | GPIO 35 | ADC1 CH7 (12-bit) | 0 – 3000 NTU | SKU:SEN0189 Optical Sensor |
| **Water Temperature Probe** | GPIO 23 | OneWire (4.7kΩ pull-up) | -10.0 – 50.0 °C | DS18B20 Waterproof Probe |
| **Ambient Air Temp & Humidity** | GPIO 4 | Digital Single-Bus | 20 – 90% RH | DHT11 Digital Sensor |
| **Relay Actuator Module** | GPIO 15 | Digital Output (Active LOW) | ON / OFF | 5V Optocoupler Relay |
| **I2C 16x2 LCD Display** | SDA: 21, SCL: 22 | I2C (Address 0x27) | 16x2 Text | LiquidCrystal I2C |

## 2. USB Serial Protocol (115,200 Baud)

When plugged in via USB, the ESP32 outputs structured ASCII telemetry and JSON packets every 5 seconds:

```text
[SENSORS]
Temperature: 28.50
Humidity: 65.00
pH: 7.85
TDS: 1650.0
Turbidity: 18.2
DO: 6.40
[JSON]
{"device_id":"ESP32-REAL-001","tank_id":3,"temperature":28.5,"humidity":65.0,"ph":7.85,"tds_ppm":1650.0,"turbidity_ntu":18.2,"dissolved_oxygen":6.4,"device_status":"ONLINE","relay_status":"OFF"}
[HTTP]
Status: 200
```

## 3. Disconnected / Open-Circuit Probe Logic

The firmware implements hardware validation to detect unplugged probes:
- Analog readings near voltage rails (`ADC < 50` or `ADC > 4050`) denote an open circuit or unplugged probe.
- The firmware outputs `null` or `-999.0` for disconnected sensors.
- The ZUNO TWIN backend parses these honestly as `null` and marks the card status as `UNAVAILABLE / OFFLINE`.

## 4. Actuator Control Commands

Relay commands can be dispatched to the ESP32 via USB Serial or MQTT:
- Serial Command: `RELAY:ON\n` or `RELAY:OFF\n`
- MQTT Topic: `shrimpsense/tanks/3/actuators`
  - Payload: `{"relay": "ON"}` or `{"aerator": "OFF"}`
