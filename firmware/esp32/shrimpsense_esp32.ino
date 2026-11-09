/*
 * =========================================================================================
 * SHRIMPSENSE — PHYSICAL ESP32 AQUACULTURE CYBER-PHYSICAL FIRMWARE
 * =========================================================================================
 * Target Board: ESP32 Dev Module (ESP-WROOM-32)
 * Tank ID:      3 (ShrimpSense Prototype Tank)
 * Device ID:    ESP32-REAL-001
 * Backend Host: 10.178.56.41:8080
 *
 * PHYSICAL SENSOR HARDWARE PINOUT:
 * -----------------------------------------------------------------------------------------
 * 1. Analog pH Sensor:           GPIO 32 (ADC1 Channel 4)
 * 2. Analog DO (Dissolved O2):   GPIO 33 (ADC1 Channel 5)
 * 3. Analog TDS / EC Sensor:     GPIO 34 (ADC1 Channel 6)
 * 4. Analog Turbidity Sensor:    GPIO 35 (ADC1 Channel 7)
 * 5. DHT11 Temp & Humidity:      GPIO 4  (Digital Input)
 * 6. DS18B20 Water Temperature:  GPIO 23 (OneWire, with 4.7k pull-up resistor to 3.3V)
 * 7. Relay Module:               GPIO 15 (Active LOW relay output)
 * 8. I2C LiquidCrystal Display:  Address 0x27 (SDA -> GPIO 21, SCL -> GPIO 22)
 *
 * TELEMETRY TRANSPORT:
 * -----------------------------------------------------------------------------------------
 * 1. USB Serial @ 115200 baud: Outputs structured sensor data and JSON telemetry.
 * 2. Direct HTTP POST: Telemetry to http://10.178.56.41:8080/api/sensors/data
 * 3. MQTT over Wi-Fi (Optional): Publishes to topic "shrimpsense/tanks/3/sensors"
 * =========================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <ArduinoJson.h>

// -----------------------------------------------------------------------------------------
// NETWORK & BACKEND CONFIGURATION
// -----------------------------------------------------------------------------------------
// Configure your local Wi-Fi credentials here:
const char* WIFI_SSID         = "ShrimpSense_WiFi";    // Replace with your Wi-Fi SSID
const char* WIFI_PASS         = "shrimpsense123";      // Replace with your Wi-Fi Password

// Real Spring Boot Backend Ingestion Endpoint on PC host
const char* BACKEND_HTTP_URL  = "http://10.178.56.41:8080/api/sensors/data";

// MQTT Broker (Optional fallback)
const char* MQTT_BROKER       = "10.178.56.41";
const int   MQTT_PORT         = 1883;
const char* MQTT_USER         = "";
const char* MQTT_PASS         = "";
const char* MQTT_TOPIC_PUB    = "shrimpsense/tanks/3/sensors";
const char* MQTT_TOPIC_SUB    = "shrimpsense/tanks/3/actuators";

const char* DEVICE_ID         = "ESP32-REAL-001";
const int   TANK_ID           = 3;

// Telemetry interval in milliseconds (default: 5 seconds)
const unsigned long TELEMETRY_INTERVAL_MS = 5000;
unsigned long lastTelemetryTime = 0;

// LCD Rotation interval (2.5 seconds per screen)
const unsigned long LCD_INTERVAL_MS = 2500;
unsigned long lastLcdTime = 0;
int lcdPage = 0;

// Wi-Fi status tracking
bool wifiWasConnected = false;

// -----------------------------------------------------------------------------------------
// HARDWARE PIN DEFINITIONS (EXACT PHYSICAL WIRING)
// -----------------------------------------------------------------------------------------
#define PIN_PH_ADC          32    // Analog pH Sensor (ADC1 Channel 4)
#define PIN_DO_ADC          33    // Analog Dissolved Oxygen Sensor (ADC1 Channel 5)
#define PIN_TDS_ADC         34    // Analog TDS Sensor (ADC1 Channel 6)
#define PIN_TURB_ADC        35    // Analog Turbidity Sensor (ADC1 Channel 7)
#define PIN_DHT             4     // DHT11 Ambient Air Temp & Humidity
#define PIN_ONEWIRE_TEMP    23    // DS18B20 Waterproof Water Temperature (OneWire)
#define PIN_RELAY           15    // Relay Module (Active LOW)

#define DHTTYPE             DHT11 // DHT11 sensor

// -----------------------------------------------------------------------------------------
// GLOBAL OBJECTS & DRIVERS
// -----------------------------------------------------------------------------------------
WiFiClient espClient;
PubSubClient mqttClient(espClient);

LiquidCrystal_I2C lcd(0x27, 16, 2); // 16x2 LCD at I2C address 0x27
OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature ds18b20(&oneWire);
DHT dht(PIN_DHT, DHTTYPE);

// Physical sensor readings cache (-999.0 denotes disconnected / uncalibrated / null)
float waterTemp = -999.0;
float airTemp   = -999.0;
float humidity  = -999.0;
float phValue   = -999.0;
float doValue   = -999.0;
float tdsValue  = -999.0;
float turbValue = -999.0;

// Raw ADC readings for diagnostic integrity
int phRawADC   = 0;
int doRawADC   = 0;
int tdsRawADC  = 0;
int turbRawADC = 0;

bool relayOn    = false;

// -----------------------------------------------------------------------------------------
// PHYSICAL SENSOR ACQUISITION (NO FAKE / RANDOM VALUES)
// -----------------------------------------------------------------------------------------

// 1. Read DS18B20 Waterproof Water Temperature
float readWaterTemperature() {
  ds18b20.requestTemperatures();
  float tempC = ds18b20.getTempCByIndex(0);

  // Physical validation: DEVICE_DISCONNECTED_C is -127.0
  // Aquaculture operational range: 5.0 °C to 50.0 °C
  if (tempC <= -50.0 || tempC >= 85.0 || tempC == DEVICE_DISCONNECTED_C) {
    return -999.0; // Disconnected / invalid
  }
  return round(tempC * 100.0) / 100.0;
}

// 2. Read DHT11 Ambient Temperature & Humidity
void readAmbientSensors() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || h < 0.0 || h > 100.0) {
    humidity = -999.0;
  } else {
    humidity = round(h * 10.0) / 10.0;
  }

  if (isnan(t) || t < -20.0 || t > 70.0) {
    airTemp = -999.0;
  } else {
    airTemp = round(t * 10.0) / 10.0;
  }
}

// 3. Read Analog pH Sensor (ADC1 GPIO 32)
float readPH() {
  int raw = 0;
  for (int i = 0; i < 10; i++) {
    raw += analogRead(PIN_PH_ADC);
    delay(5);
  }
  phRawADC = raw / 10;

  // Open-circuit / disconnected probe detection
  // If ADC is near rails (0 or 4095), probe is disconnected or unpowered
  if (phRawADC < 50 || phRawADC > 4050) {
    return -999.0;
  }

  float voltage = (phRawADC / 4095.0) * 3.3;
  // Standard pH analog probe transfer function:
  // Neutral buffer (pH 7.0) ≈ 1.65V
  float calculatedPH = 7.0 + ((1.65 - voltage) * 3.5);

  if (calculatedPH < 0.0 || calculatedPH > 14.0) {
    return -999.0;
  }
  return round(calculatedPH * 100.0) / 100.0;
}

// 4. Read Analog Dissolved Oxygen Sensor (ADC1 GPIO 33)
float readDissolvedOxygen(float currentWaterTemp) {
  int raw = 0;
  for (int i = 0; i < 10; i++) {
    raw += analogRead(PIN_DO_ADC);
    delay(5);
  }
  doRawADC = raw / 10;

  if (doRawADC < 50 || doRawADC > 4050) {
    return -999.0;
  }

  float voltage = (doRawADC / 4095.0) * 3.3;
  // Galvanic DO sensor transfer function with temperature compensation
  float calFactor = 4.2;
  float tempFactor = (currentWaterTemp > 0) ? (1.0 + (currentWaterTemp - 25.0) * 0.02) : 1.0;
  float calculatedDO = voltage * calFactor * tempFactor;

  if (calculatedDO < 0.0 || calculatedDO > 25.0) {
    return -999.0;
  }
  return round(calculatedDO * 100.0) / 100.0;
}

// 5. Read Analog TDS / EC Sensor (ADC1 GPIO 34)
float readTDS(float currentWaterTemp) {
  int raw = 0;
  for (int i = 0; i < 10; i++) {
    raw += analogRead(PIN_TDS_ADC);
    delay(5);
  }
  tdsRawADC = raw / 10;

  if (tdsRawADC < 50 || tdsRawADC > 4050) {
    return -999.0;
  }

  float voltage = (tdsRawADC / 4095.0) * 3.3;
  float compensationCoefficient = 1.0 + 0.02 * ((currentWaterTemp > 0 ? currentWaterTemp : 25.0) - 25.0);
  float compensationVoltage = voltage / compensationCoefficient;
  float calculatedTDS = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5;

  if (calculatedTDS < 0.0 || calculatedTDS > 3000.0) {
    return -999.0;
  }
  return round(calculatedTDS * 10.0) / 10.0;
}

// 6. Read Analog Turbidity Sensor (ADC1 GPIO 35)
float readTurbidity() {
  int raw = 0;
  for (int i = 0; i < 10; i++) {
    raw += analogRead(PIN_TURB_ADC);
    delay(5);
  }
  turbRawADC = raw / 10;

  if (turbRawADC < 50 || turbRawADC > 4050) {
    return -999.0;
  }

  float voltage = (turbRawADC / 4095.0) * 3.3;
  float ntu = 0.0;
  if (voltage < 2.5) {
    ntu = 3000.0;
  } else {
    ntu = -1120.4 * pow(voltage, 2) + 5742.3 * voltage - 4352.9;
  }
  if (ntu < 0.0) ntu = 0.0;
  if (ntu > 3000.0) return -999.0;

  return round(ntu * 10.0) / 10.0;
}

// -----------------------------------------------------------------------------------------
// MQTT CALLBACK & RECONNECT (OPTIONAL)
// -----------------------------------------------------------------------------------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, message);
  if (!err) {
    if (doc.containsKey("relay") || doc.containsKey("aerator")) {
      const char* actState = doc.containsKey("relay") ? doc["relay"] : doc["aerator"];
      if (strcasecmp(actState, "ON") == 0 || strcmp(actState, "1") == 0) {
        relayOn = true;
        digitalWrite(PIN_RELAY, LOW); // Active LOW
      } else {
        relayOn = false;
        digitalWrite(PIN_RELAY, HIGH);
      }
    }
  }
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
  bool connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
  } else {
    connected = mqttClient.connect(clientId.c_str());
  }

  if (connected) {
    mqttClient.subscribe(MQTT_TOPIC_SUB);
  }
}

// -----------------------------------------------------------------------------------------
// TELEMETRY TRANSMISSION (USB SERIAL + DIRECT HTTP POST)
// -----------------------------------------------------------------------------------------
void transmitTelemetry() {
  StaticJsonDocument<512> doc;

  doc["device_id"] = DEVICE_ID;
  doc["tank_id"]   = TANK_ID;

  // Temperature (Water)
  if (waterTemp != -999.0) {
    doc["temperature"] = waterTemp;
  } else {
    doc["temperature"] = nullptr;
  }

  // Humidity
  if (humidity != -999.0) {
    doc["humidity"] = humidity;
  } else {
    doc["humidity"] = nullptr;
  }

  // pH
  if (phValue != -999.0) {
    doc["ph"] = phValue;
    doc["ph_sensor_status"] = "ACTIVE";
  } else {
    doc["ph"] = nullptr;
    doc["ph_sensor_status"] = (phRawADC < 50 || phRawADC > 4050) ? "DISCONNECTED" : "NOT_CALIBRATED";
  }
  doc["ph_raw_adc"] = phRawADC;
  doc["do_raw_adc"] = doRawADC;
  doc["tds_raw_adc"] = tdsRawADC;
  doc["turbidity_raw_adc"] = turbRawADC;

  // TDS
  if (tdsValue != -999.0) {
    doc["tds_ppm"] = tdsValue;
  } else {
    doc["tds_ppm"] = nullptr;
  }

  // Turbidity
  if (turbValue != -999.0) {
    doc["turbidity_ntu"] = turbValue;
  } else {
    doc["turbidity_ntu"] = nullptr;
  }

  // Dissolved Oxygen
  if (doValue != -999.0) {
    doc["dissolved_oxygen"] = doValue;
    doc["do_sensor_status"] = "ACTIVE";
  } else {
    doc["dissolved_oxygen"] = nullptr;
    doc["do_sensor_status"] = (doRawADC < 50 || doRawADC > 4050) ? "DISCONNECTED" : "NOT_CALIBRATED";
  }

  doc["device_status"] = "ONLINE";
  doc["relay_status"]  = relayOn ? "ON" : "OFF";

  String jsonString;
  serializeJson(doc, jsonString);

  // 1. Output Structured Sensor Data on USB Serial
  Serial.println("[SENSORS]");
  if (waterTemp != -999.0) {
    Serial.printf("Temperature: %.2f\n", waterTemp);
  } else {
    Serial.println("Temperature: null");
  }

  if (humidity != -999.0) {
    Serial.printf("Humidity: %.2f\n", humidity);
  } else {
    Serial.println("Humidity: null");
  }

  if (phValue != -999.0) {
    Serial.printf("pH: %.2f\n", phValue);
  } else {
    Serial.println("pH: null");
  }

  if (tdsValue != -999.0) {
    Serial.printf("TDS: %.2f\n", tdsValue);
  } else {
    Serial.println("TDS: null");
  }

  if (turbValue != -999.0) {
    Serial.printf("Turbidity: %.2f\n", turbValue);
  } else {
    Serial.println("Turbidity: null");
  }

  if (doValue != -999.0) {
    Serial.printf("DO: %.2f\n", doValue);
  } else {
    Serial.println("DO: null");
  }

  // 2. Output Raw JSON Telemetry
  Serial.println("[JSON]");
  Serial.println(jsonString);

  // 3. Direct HTTP POST Telemetry to Spring Boot Backend
  int httpResponseCode = -1;
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_HTTP_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000);
    httpResponseCode = http.POST(jsonString);
    http.end();
  }

  // 4. Output HTTP Transmission Status
  Serial.println("[HTTP]");
  if (httpResponseCode > 0) {
    Serial.printf("Status: %d\n", httpResponseCode);
  } else {
    Serial.printf("Status: %d (Offline / No WiFi)\n", httpResponseCode);
  }

  // 5. Optional MQTT Publish
  if (mqttClient.connected()) {
    mqttClient.publish(MQTT_TOPIC_PUB, jsonString.c_str());
  }
}

// -----------------------------------------------------------------------------------------
// LCD DISPLAY ROTATION
// -----------------------------------------------------------------------------------------
void updateLCDDisplay() {
  lcd.clear();
  switch (lcdPage) {
    case 0: // Water Temp & Humidity
      lcd.setCursor(0, 0);
      lcd.print("Water: ");
      if (waterTemp != -999.0) {
        lcd.print(waterTemp, 1);
        lcd.print((char)223);
        lcd.print("C");
      } else {
        lcd.print("OFFLINE");
      }

      lcd.setCursor(0, 1);
      lcd.print("Humid: ");
      if (humidity != -999.0) {
        lcd.print(humidity, 1);
        lcd.print("%");
      } else {
        lcd.print("OFFLINE");
      }
      break;

    case 1: // pH & Dissolved Oxygen
      lcd.setCursor(0, 0);
      lcd.print("pH: ");
      if (phValue != -999.0) {
        lcd.print(phValue, 2);
      } else {
        lcd.print("OFFLINE");
      }

      lcd.setCursor(0, 1);
      lcd.print("DO: ");
      if (doValue != -999.0) {
        lcd.print(doValue, 2);
        lcd.print("mg/L");
      } else {
        lcd.print("OFFLINE");
      }
      break;

    case 2: // TDS & Turbidity
      lcd.setCursor(0, 0);
      lcd.print("TDS: ");
      if (tdsValue != -999.0) {
        lcd.print(tdsValue, 0);
        lcd.print("ppm");
      } else {
        lcd.print("OFFLINE");
      }

      lcd.setCursor(0, 1);
      lcd.print("Turb: ");
      if (turbValue != -999.0) {
        lcd.print(turbValue, 1);
        lcd.print("NTU");
      } else {
        lcd.print("OFFLINE");
      }
      break;

    case 3: // System Status & Tank Info
      lcd.setCursor(0, 0);
      lcd.print("Tank 3 Hub");
      lcd.setCursor(0, 1);
      if (WiFi.status() == WL_CONNECTED) {
        lcd.print("WiFi OK");
      } else {
        lcd.print("USB Serial Live");
      }
      break;
  }

  lcdPage = (lcdPage + 1) % 4;
}

// -----------------------------------------------------------------------------------------
// SETUP
// -----------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[SHRIMPSENSE] ESP32 Real Hardware Cyber-Physical Node Starting...");

  // Relay initialization (GPIO 15)
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, HIGH); // Default OFF (Active LOW relay)

  // ADC configuration (12-bit, 0-3.3V)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Initialize OneWire / DallasTemperature and DHT11
  ds18b20.begin();
  dht.begin();

  // Initialize I2C LCD (Address 0x27, SDA 21, SCL 22)
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SHRIMPSENSE AIoT");
  lcd.setCursor(0, 1);
  lcd.print("Tank 3 Node Init");

  // Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  // Non-blocking Wi-Fi connect attempt (max 10 seconds)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiWasConnected = true;
    Serial.println("[WiFi] CONNECTED");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());

    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    reconnectMQTT();
  } else {
    wifiWasConnected = false;
    Serial.println("[WiFi] DISCONNECTED (Running in USB Serial mode)");
  }

  delay(1500);
  lcd.clear();
}

// -----------------------------------------------------------------------------------------
// MAIN LOOP
// -----------------------------------------------------------------------------------------
void loop() {
  // Serial command handler for Aerator Control (AERATOR_ON / AERATOR_OFF)
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "AERATOR_ON" || cmd == "RELAY:ON") {
      relayOn = true;
      digitalWrite(PIN_RELAY, LOW); // Active LOW relay energize
      Serial.println("[ACK] AERATOR_ON");
    } else if (cmd == "AERATOR_OFF" || cmd == "RELAY:OFF") {
      relayOn = false;
      digitalWrite(PIN_RELAY, HIGH); // Default OFF
      Serial.println("[ACK] AERATOR_OFF");
    }
  }

  // Wi-Fi Connection State Monitor
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.println("[WiFi] CONNECTED");
      Serial.print("[WiFi] IP: ");
      Serial.println(WiFi.localIP());
    }
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    mqttClient.loop();
  } else {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("[WiFi] DISCONNECTED");
    }
  }

  unsigned long currentMillis = millis();

  // Periodic Telemetry Acquisition & Transmission
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    // 1. Read physical sensors
    waterTemp = readWaterTemperature();
    readAmbientSensors();
    phValue   = readPH();
    doValue   = readDissolvedOxygen(waterTemp > 0 ? waterTemp : 25.0);
    tdsValue  = readTDS(waterTemp > 0 ? waterTemp : 25.0);
    turbValue = readTurbidity();

    // 2. Transmit telemetry via USB Serial and Direct HTTP POST
    transmitTelemetry();
  }

  // Periodic LCD Display update
  if (currentMillis - lastLcdTime >= LCD_INTERVAL_MS) {
    lastLcdTime = currentMillis;
    updateLCDDisplay();
  }

  delay(20);
}
