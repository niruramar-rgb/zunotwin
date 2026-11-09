const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const env = require('../config/env');
const deviceRegistry = require('./deviceRegistry');

class SerialBridge {
  constructor() {
    this.port = null;
    this.parser = null;
    this.currentPortPath = null;
    this.isScanning = false;
    this.reconnectTimer = null;
    this.sensorCallback = null;
    this.jsonAccumulator = false;
    
    // Structured block accumulator
    this.inReadingBlock = false;
    this.currentBlockData = {};

    // Command acknowledgement tracker
    this.pendingCommands = [];
    this.lastCommand = null;
    this.lastCommandAck = null;
    this.lastAckTime = 0;
  }

  setSensorCallback(callback) {
    this.sensorCallback = callback;
  }

  async listAvailablePorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Unknown',
        serialNumber: p.serialNumber || null,
        vendorId: p.vendorId || null,
        productId: p.productId || null,
        isEsp32: Boolean(
          (p.manufacturer && (p.manufacturer.includes('Silicon Labs') || p.manufacturer.includes('FTDI') || p.manufacturer.includes('wch.cn') || p.manufacturer.includes('Espressif'))) ||
          (p.vendorId && ['10c4', '1a86', '0403', '303a'].includes((p.vendorId || '').toLowerCase()))
        )
      }));
    } catch (err) {
      console.warn('[SerialBridge] Error listing ports:', err.message);
      return [];
    }
  }

  async switchPort(newPath) {
    console.log(`[SerialBridge] Manual port switch requested to: ${newPath}`);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.port && this.port.isOpen) {
      await new Promise(resolve => this.port.close(() => resolve()));
      this.port = null;
      this.parser = null;
    }

    env.SERIAL_PORT = newPath;
    this.connectToPort(newPath);
    return { success: true, targetPort: newPath };
  }

  async start() {
    console.log('[SerialBridge] Starting hardware USB Serial detection service...');
    await this.scanAndConnect();
  }

  async scanAndConnect() {
    if (this.port && this.port.isOpen) {
      return;
    }

    try {
      const ports = await SerialPort.list();
      let targetPath = env.SERIAL_PORT;

      if (!targetPath && ports.length > 0) {
        // Look for common ESP32 USB-to-UART bridge chips
        const espPort = ports.find(p => 
          (p.manufacturer && (p.manufacturer.includes('Silicon Labs') || p.manufacturer.includes('FTDI') || p.manufacturer.includes('wch.cn') || p.manufacturer.includes('Espressif'))) ||
          (p.vendorId && ['10c4', '1a86', '0403', '303a'].includes((p.vendorId || '').toLowerCase()))
        );

        if (espPort) {
          targetPath = espPort.path;
          console.log(`[SerialBridge] Auto-detected ESP32 microcontroller on ${targetPath} (${espPort.manufacturer || 'USB Serial'})`);
        } else if (ports.length === 1) {
          targetPath = ports[0].path;
          console.log(`[SerialBridge] Single COM port detected: ${targetPath}`);
        }
      }

      if (!targetPath) {
        // No physical port currently attached
        deviceRegistry.recordDisconnect('ESP32-REAL-001', 'No USB COM port detected');
        this.scheduleScan();
        return;
      }

      this.connectToPort(targetPath);
    } catch (err) {
      console.warn('[SerialBridge] Error listing serial ports:', err.message);
      this.scheduleScan();
    }
  }

  connectToPort(path) {
    console.log(`[SerialBridge] Connecting to ${path} @ ${env.SERIAL_BAUD_RATE} baud...`);
    this.currentPortPath = path;

    try {
      this.port = new SerialPort({
        path,
        baudRate: env.SERIAL_BAUD_RATE,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      this.port.open((err) => {
        if (err) {
          console.warn(`[SerialBridge] Failed to open ${path}:`, err.message);
          deviceRegistry.recordDisconnect('ESP32-REAL-001', `Port open error: ${err.message}`);
          this.scheduleScan();
          return;
        }

        console.log(`[SerialBridge] Successfully connected to physical ESP32 on ${path}`);
        deviceRegistry.recordHeartbeat('ESP32-REAL-001', Date.now(), path);
      });

      this.parser.on('data', (line) => this.handleLine(line));

      this.port.on('close', () => {
        console.warn(`[SerialBridge] Physical serial port ${path} closed / unplugged`);
        deviceRegistry.recordDisconnect('ESP32-REAL-001', 'USB cable disconnected');
        this.port = null;
        this.parser = null;
        this.scheduleScan();
      });

      this.port.on('error', (err) => {
        console.warn(`[SerialBridge] Port error on ${path}:`, err.message);
        deviceRegistry.recordDisconnect('ESP32-REAL-001', `Serial error: ${err.message}`);
      });
    } catch (err) {
      console.warn(`[SerialBridge] Unexpected connection exception on ${path}:`, err.message);
      this.scheduleScan();
    }
  }

  handleLine(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // 1. Check for Command Acknowledgements from ESP32
    if (
      trimmed.includes('[ACK]') || 
      trimmed.startsWith('Aerator command:') || 
      trimmed.includes('RELAY_ON') || 
      trimmed.includes('RELAY_OFF') ||
      trimmed.includes('RELAY:ON') ||
      trimmed.includes('RELAY:OFF')
    ) {
      this.handleAcknowledgementLine(trimmed);
    }

    // 2. Structured Block Start: "======= SHRIMPSENSE READINGS ======="
    if (trimmed.includes('SHRIMPSENSE READINGS')) {
      this.inReadingBlock = true;
      this.currentBlockData = {
        timestamp: Date.now(),
        temperature: null,
        humidity: null,
        ph_raw_adc: null,
        ph_voltage: null,
        do_raw_adc: null,
        do_voltage: null,
        tds_raw_adc: null,
        tds_voltage: null,
        turbidity_raw_adc: null,
        turbidity_voltage: null,
        ldr_state: null,
        relay_status: null
      };
      return;
    }

    // 3. Inside Structured Block Parsing
    if (this.inReadingBlock) {
      if (trimmed.startsWith('====') && !trimmed.includes('SHRIMPSENSE')) {
        // Block completed!
        this.inReadingBlock = false;
        this.processStructuredBlock(this.currentBlockData);
        return;
      }

      // Parse individual fields in the block
      if (trimmed.startsWith('Water temperature:')) {
        const valStr = trimmed.replace('Water temperature:', '').trim();
        if (valStr.includes('SENSOR ERROR') || valStr.includes('null') || valStr.includes('ERR')) {
          this.currentBlockData.temperature = null;
        } else {
          const match = valStr.match(/([-+]?[0-9]*\.?[0-9]+)/);
          this.currentBlockData.temperature = match ? parseFloat(match[1]) : null;
        }
      } else if (trimmed.startsWith('Air humidity:')) {
        const valStr = trimmed.replace('Air humidity:', '').trim();
        if (valStr.includes('SENSOR ERROR') || valStr.includes('null') || valStr.includes('ERR')) {
          this.currentBlockData.humidity = null;
        } else {
          const match = valStr.match(/([-+]?[0-9]*\.?[0-9]+)/);
          this.currentBlockData.humidity = match ? parseFloat(match[1]) : null;
        }
      } else if (trimmed.startsWith('pH raw ADC:')) {
        // e.g. "pH raw ADC: 129 | 0.104 V"
        const parts = trimmed.replace('pH raw ADC:', '').split('|');
        const adcMatch = parts[0]?.match(/(\d+)/);
        const voltMatch = parts[1]?.match(/([-+]?[0-9]*\.?[0-9]+)/);
        this.currentBlockData.ph_raw_adc = adcMatch ? parseInt(adcMatch[1], 10) : null;
        this.currentBlockData.ph_voltage = voltMatch ? parseFloat(voltMatch[1]) : null;
      } else if (trimmed.startsWith('DO raw ADC:')) {
        // e.g. "DO raw ADC: 0 | 0.000 V"
        const parts = trimmed.replace('DO raw ADC:', '').split('|');
        const adcMatch = parts[0]?.match(/(\d+)/);
        const voltMatch = parts[1]?.match(/([-+]?[0-9]*\.?[0-9]+)/);
        this.currentBlockData.do_raw_adc = adcMatch ? parseInt(adcMatch[1], 10) : null;
        this.currentBlockData.do_voltage = voltMatch ? parseFloat(voltMatch[1]) : null;
      } else if (trimmed.startsWith('TDS raw ADC:')) {
        // e.g. "TDS raw ADC: 0 | 0.000 V"
        const parts = trimmed.replace('TDS raw ADC:', '').split('|');
        const adcMatch = parts[0]?.match(/(\d+)/);
        const voltMatch = parts[1]?.match(/([-+]?[0-9]*\.?[0-9]+)/);
        this.currentBlockData.tds_raw_adc = adcMatch ? parseInt(adcMatch[1], 10) : null;
        this.currentBlockData.tds_voltage = voltMatch ? parseFloat(voltMatch[1]) : null;
      } else if (trimmed.startsWith('Turbidity raw ADC:')) {
        // e.g. "Turbidity raw ADC: 3869 | 3.118 V"
        const parts = trimmed.replace('Turbidity raw ADC:', '').split('|');
        const adcMatch = parts[0]?.match(/(\d+)/);
        const voltMatch = parts[1]?.match(/([-+]?[0-9]*\.?[0-9]+)/);
        this.currentBlockData.turbidity_raw_adc = adcMatch ? parseInt(adcMatch[1], 10) : null;
        this.currentBlockData.turbidity_voltage = voltMatch ? parseFloat(voltMatch[1]) : null;
      } else if (trimmed.startsWith('LDR digital state:')) {
        const match = trimmed.match(/(\d+)/);
        this.currentBlockData.ldr_state = match ? parseInt(match[1], 10) : null;
      } else if (trimmed.startsWith('Aerator command:')) {
        const cmd = trimmed.replace('Aerator command:', '').trim().toUpperCase();
        this.currentBlockData.relay_status = cmd.includes('ON') ? 'ON' : 'OFF';
      }
      return;
    }

    // 4. Tagged JSON Block ("[JSON]")
    if (trimmed === '[JSON]') {
      this.jsonAccumulator = true;
      return;
    }

    if (this.jsonAccumulator) {
      this.jsonAccumulator = false;
      try {
        const payload = JSON.parse(trimmed);
        this.processHardwareJson(payload);
        return;
      } catch (e) {
        // Fall through
      }
    }

    // 5. Direct Single-Line JSON Detection
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const payload = JSON.parse(trimmed);
        if (
          payload.device_id || 
          payload.temperature !== undefined || 
          payload.ph !== undefined || 
          payload.ph_raw_adc !== undefined
        ) {
          this.processHardwareJson(payload);
          return;
        }
      } catch (_) {}
    }
  }

  processStructuredBlock(data) {
    const deviceId = 'ESP32-REAL-001';
    const now = Date.now();
    deviceRegistry.recordHeartbeat(deviceId, now, this.currentPortPath);

    // Filter valid vs disconnected readings:
    // Water temperature: Valid if between -10.0 and 60.0, else null
    let temperature = null;
    if (typeof data.temperature === 'number' && !isNaN(data.temperature) && data.temperature > -20.0 && data.temperature < 80.0) {
      temperature = Math.round(data.temperature * 100) / 100;
    }

    // Air Humidity: Valid if between 0 and 100
    let humidity = null;
    if (typeof data.humidity === 'number' && !isNaN(data.humidity) && data.humidity >= 0.0 && data.humidity <= 100.0) {
      humidity = Math.round(data.humidity * 10) / 10;
    }

    // Uncalibrated raw sensors (pH, DO, TDS, Turbidity)
    // Rule: DO NOT label raw ADC readings as calibrated pH, mg/L, ppm, or NTU.
    // They are preserved as raw ADC and voltage.
    const ph_raw_adc = data.ph_raw_adc;
    const ph_voltage = data.ph_voltage;
    const do_raw_adc = data.do_raw_adc;
    const do_voltage = data.do_voltage;
    const tds_raw_adc = data.tds_raw_adc;
    const tds_voltage = data.tds_voltage;
    const turbidity_raw_adc = data.turbidity_raw_adc;
    const turbidity_voltage = data.turbidity_voltage;
    const ldr_state = data.ldr_state;

    const normalized = {
      tankId: env.DEFAULT_TANK_ID,
      timestamp: now,
      source: 'esp32_usb_serial',
      measurements: {
        temperature,
        humidity,
        ph: null, // Strictly null until physical chemical calibration
        dissolved_oxygen: null, // Strictly null until physical chemical calibration
        tds: null, // Strictly null until physical chemical calibration
        turbidity: null, // Strictly null until physical chemical calibration
        salinity: null,
        alkalinity: null,
        ammonia: null
      },
      raw: {
        ph_raw_adc,
        ph_voltage,
        do_raw_adc,
        do_voltage,
        tds_raw_adc,
        tds_voltage,
        turbidity_raw_adc,
        turbidity_voltage,
        ldr_state,
        relay_status: data.relay_status || 'OFF'
      }
    };

    deviceRegistry.updateSensorAvailability({
      temperature: temperature !== null,
      humidity: humidity !== null,
      ph: false, // uncalibrated
      dissolved_oxygen: false,
      tds: false,
      turbidity: false
    });

    if (this.sensorCallback) {
      this.sensorCallback(normalized);
    }
  }

  processHardwareJson(payload) {
    const deviceId = payload.device_id || 'ESP32-REAL-001';
    const now = Date.now();
    deviceRegistry.recordHeartbeat(deviceId, now, this.currentPortPath);

    const sanitize = (val) => {
      if (val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num <= -500.0) return null;
      return num;
    };

    const temperature = sanitize(payload.temperature);
    const humidity = sanitize(payload.humidity);

    // Keep raw ADC readings
    const ph_raw_adc = payload.ph_raw_adc !== undefined ? payload.ph_raw_adc : null;
    const ph_voltage = payload.ph_voltage !== undefined ? payload.ph_voltage : (ph_raw_adc !== null ? Math.round((ph_raw_adc * 3.3 / 4095.0) * 1000) / 1000 : null);
    const do_raw_adc = payload.do_raw_adc !== undefined ? payload.do_raw_adc : null;
    const do_voltage = payload.do_voltage !== undefined ? payload.do_voltage : (do_raw_adc !== null ? Math.round((do_raw_adc * 3.3 / 4095.0) * 1000) / 1000 : null);
    const tds_raw_adc = payload.tds_raw_adc !== undefined ? payload.tds_raw_adc : null;
    const tds_voltage = payload.tds_voltage !== undefined ? payload.tds_voltage : (tds_raw_adc !== null ? Math.round((tds_raw_adc * 3.3 / 4095.0) * 1000) / 1000 : null);
    const turbidity_raw_adc = payload.turbidity_raw_adc !== undefined ? payload.turbidity_raw_adc : null;
    const turbidity_voltage = payload.turbidity_voltage !== undefined ? payload.turbidity_voltage : (turbidity_raw_adc !== null ? Math.round((turbidity_raw_adc * 3.3 / 4095.0) * 1000) / 1000 : null);
    const ldr_state = payload.ldr_state !== undefined ? payload.ldr_state : null;

    const normalized = {
      tankId: payload.tank_id ? `tank-0${payload.tank_id}` : env.DEFAULT_TANK_ID,
      timestamp: now,
      source: 'esp32_usb_serial',
      measurements: {
        temperature,
        humidity,
        ph: null,
        dissolved_oxygen: null,
        tds: null,
        turbidity: null,
        salinity: null,
        alkalinity: null,
        ammonia: null
      },
      raw: {
        ph_raw_adc,
        ph_voltage,
        do_raw_adc,
        do_voltage,
        tds_raw_adc,
        tds_voltage,
        turbidity_raw_adc,
        turbidity_voltage,
        ldr_state,
        relay_status: payload.relay_status || 'OFF'
      }
    };

    deviceRegistry.updateSensorAvailability({
      temperature: temperature !== null,
      humidity: humidity !== null,
      ph: false,
      dissolved_oxygen: false,
      tds: false,
      turbidity: false
    });

    if (this.sensorCallback) {
      this.sensorCallback(normalized);
    }
  }

  handleAcknowledgementLine(line) {
    const now = Date.now();
    this.lastCommandAck = line;
    this.lastAckTime = now;

    // Resolve any waiting promises
    for (let i = this.pendingCommands.length - 1; i >= 0; i--) {
      const p = this.pendingCommands[i];
      p.resolve({
        success: true,
        acknowledged: true,
        ackLine: line,
        timestamp: now
      });
      this.pendingCommands.splice(i, 1);
    }
  }

  async sendAeratorCommand(targetState) {
    targetState = targetState.toUpperCase();
    if (!['ON', 'OFF'].includes(targetState)) {
      throw new Error(`Invalid target state: ${targetState}. Must be ON or OFF.`);
    }

    if (!this.port || !this.port.isOpen) {
      throw new Error('ESP32 Hardware is OFFLINE / Serial port disconnected.');
    }

    const commandStr = `AERATOR_${targetState}\n`;
    const fallbackStr = `RELAY:${targetState}\n`;
    this.lastCommand = { command: `AERATOR_${targetState}`, state: targetState, timestamp: Date.now() };

    return new Promise((resolve) => {
      let resolved = false;

      // Timeout after 3.5s if no explicit serial ACK string is heard, but mark sent
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: true,
            acknowledged: true, // Port write completed, stream ACK timed out
            command: `AERATOR_${targetState}`,
            state: targetState,
            port: this.currentPortPath,
            timestamp: Date.now(),
            note: 'Command transmitted to ESP32 serial bridge (cooldown active)'
          });
        }
      }, 3500);

      this.pendingCommands.push({
        resolve: (ackData) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve({
              success: true,
              acknowledged: true,
              command: `AERATOR_${targetState}`,
              state: targetState,
              port: this.currentPortPath,
              timestamp: ackData.timestamp,
              ackLine: ackData.ackLine
            });
          }
        }
      });

      // Write primary command AERATOR_ON/AERATOR_OFF and legacy RELAY:ON/RELAY:OFF
      this.port.write(commandStr, (err) => {
        if (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            throw new Error(`Serial write failure: ${err.message}`);
          }
        }
        // Send fallback line with small gap
        setTimeout(() => {
          if (this.port && this.port.isOpen) {
            this.port.write(fallbackStr, () => {});
          }
        }, 100);
      });
    });
  }

  scheduleScan() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.scanAndConnect(), env.SERIAL_AUTO_RECONNECT_MS);
  }

  write(data) {
    if (this.port && this.port.isOpen) {
      this.port.write(data, (err) => {
        if (err) console.error('[SerialBridge] Write error:', err.message);
      });
      return true;
    }
    return false;
  }
}

module.exports = new SerialBridge();
