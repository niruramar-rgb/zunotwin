/**
 * Hardware Sensor Registry & Mapping Specification
 * Direct reflection of physical ESP32 cyber-physical wiring from shrimpsense_esp32.ino
 */

module.exports = {
  esp32Pinout: {
    ph: { pin: 32, adcChannel: 'ADC1_CH4', type: 'analog', sensorModel: 'Analog pH Meter Kit v1.1' },
    dissolved_oxygen: { pin: 33, adcChannel: 'ADC1_CH5', type: 'analog', sensorModel: 'Analog Galvanic DO Sensor' },
    tds: { pin: 34, adcChannel: 'ADC1_CH6', type: 'analog', sensorModel: 'Analog TDS Sensor Meter V1.0' },
    turbidity: { pin: 35, adcChannel: 'ADC1_CH7', type: 'analog', sensorModel: 'Turbidity Sensor SKU:SEN0189' },
    temperature: { pin: 23, protocol: 'OneWire', type: 'digital', sensorModel: 'DS18B20 Waterproof Probe' },
    humidity: { pin: 4, protocol: 'Single-Bus', type: 'digital', sensorModel: 'DHT11 Temp & Humidity Sensor' },
    relay: { pin: 15, activeLevel: 'LOW', type: 'output', targetDevice: 'Aeration Relay Module' }
  },
  
  sevenCoreSensors: [
    { key: 'ph', label: 'pH Level', unit: 'pH', decimals: 2 },
    { key: 'temperature', label: 'Water Temp', unit: '°C', decimals: 1 },
    { key: 'turbidity', label: 'Turbidity', unit: 'NTU', decimals: 1 },
    { key: 'tds', label: 'TDS', unit: 'ppm', decimals: 0 },
    { key: 'salinity', label: 'Salinity', unit: 'ppt', decimals: 1 },
    { key: 'alkalinity', label: 'Alkalinity', unit: 'mg/L', decimals: 0 },
    { key: 'ammonia', label: 'Ammonia (NH3)', unit: 'mg/L', decimals: 3 }
  ],
  
  auxiliarySensors: [
    { key: 'dissolved_oxygen', label: 'Dissolved Oxygen', unit: 'mg/L', decimals: 2 },
    { key: 'humidity', label: 'Ambient Humidity', unit: '%', decimals: 1 }
  ]
};
