const { dbAsync } = require('../database/connection');
const deviceRegistry = require('../hardware/deviceRegistry');
const serialBridge = require('../hardware/serialBridge');
const mqttBridge = require('../hardware/mqttBridge');

class AutomationService {
  constructor() {
    this.socketEmitter = null;
    this.lastToggleTimes = new Map(); // deviceId -> timestamp
    this.minCycleIntervalMs = 2000; // 2s minimum cycle interval to prevent rapid switch chatter
  }

  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  async getEquipmentList(tankId = null) {
    let sql = 'SELECT * FROM equipment_states';
    const params = [];
    if (tankId) {
      sql += ' WHERE tank_id = ?';
      params.push(tankId);
    }
    const rows = await dbAsync.all(sql, params);
    
    // Check hardware status - if hardware is disconnected, mark unverified/offline
    const hwStatus = deviceRegistry.getStatus();
    return rows.map(r => ({
      deviceId: r.device_id,
      tankId: r.tank_id,
      name: r.name,
      type: r.type,
      state: hwStatus.hardwareConnected ? r.state : (r.state === 'ON' ? 'UNKNOWN' : r.state),
      mode: r.mode,
      verified: hwStatus.hardwareConnected ? (r.verified === 1) : false,
      lastCommand: r.last_command,
      lastUpdated: r.last_updated,
      hardwareAvailable: hwStatus.hardwareConnected
    }));
  }

  async setEquipmentMode(deviceId, mode) {
    if (!['AUTO', 'MANUAL'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Must be AUTO or MANUAL.`);
    }

    const now = Date.now();
    await dbAsync.run(
      'UPDATE equipment_states SET mode = ?, last_updated = ? WHERE device_id = ?',
      [mode, now, deviceId]
    );

    await this.logEvent({
      tankId: 'tank-01',
      deviceId,
      command: `SET_MODE_${mode}`,
      source: 'USER_INTERFACE',
      verifiedState: mode,
      details: `Operating mode set to ${mode}`
    });

    this.broadcastStatus(deviceId);
    return { success: true, deviceId, mode };
  }

  async sendEquipmentCommand(deviceId, targetState, source = 'USER_MANUAL', overrideSafety = false) {
    targetState = targetState.toUpperCase();
    if (!['ON', 'OFF'].includes(targetState)) {
      throw new Error(`Invalid target state: ${targetState}. Must be ON or OFF.`);
    }

    // 1. Safety check: Check hardware connectivity
    const hwStatus = deviceRegistry.getStatus();
    if (!overrideSafety && !hwStatus.hardwareConnected) {
      throw new Error('Hardware failsafe: Cannot trigger equipment while ESP32 hardware is disconnected or timed out.');
    }

    // 2. Safety check: Minimum cycle time
    const lastToggle = this.lastToggleTimes.get(deviceId) || 0;
    const elapsed = Date.now() - lastToggle;
    if (!overrideSafety && elapsed < this.minCycleIntervalMs) {
      const waitSec = Math.ceil((this.minCycleIntervalMs - elapsed) / 1000);
      throw new Error(`Equipment safety cooldown active: Please wait ${waitSec}s before toggling ${deviceId} again.`);
    }

    // 3. Dispatch to physical hardware (Serial / MQTT)
    let physicalSent = false;
    let commandAck = null;
    if (deviceId === 'aerator_01') {
      // Physical ESP32 relay module on GPIO 15
      try {
        commandAck = await serialBridge.sendAeratorCommand(targetState);
        physicalSent = commandAck?.acknowledged || false;
      } catch (cmdErr) {
        console.warn('[AutomationService] Serial aerator command notice:', cmdErr.message);
        if (mqttBridge.isConnected) {
          physicalSent = mqttBridge.publishCommand('relay', targetState);
        }
      }
    }

    // 4. Update database state
    const now = Date.now();
    this.lastToggleTimes.set(deviceId, now);
    await dbAsync.run(`
      UPDATE equipment_states 
      SET state = ?, last_command = ?, last_updated = ?, verified = ?
      WHERE device_id = ?
    `, [targetState, `${targetState} by ${source}`, now, physicalSent ? 1 : 0, deviceId]);

    // 5. Audit event
    await this.logEvent({
      tankId: 'tank-01',
      deviceId,
      command: targetState,
      source,
      verifiedState: physicalSent ? targetState : 'UNVERIFIED',
      details: physicalSent ? 'Command transmitted to ESP32 hardware bridge' : 'Simulation state updated (no active physical actuator)'
    });

    this.broadcastStatus(deviceId);
    return {
      success: true,
      deviceId,
      state: targetState,
      verified: physicalSent,
      timestamp: now
    };
  }

  async emergencyStop(tankId = null) {
    const rows = await this.getEquipmentList(tankId);
    const results = [];
    for (const eq of rows) {
      if (eq.state === 'ON') {
        const res = await this.sendEquipmentCommand(eq.deviceId, 'OFF', 'EMERGENCY_STOP', true);
        results.push(res);
      }
    }
    return { success: true, stoppedCount: results.length, stoppedDevices: results };
  }

  async evaluateAutomations(reading) {
    if (!reading || !reading.measurements) return;
    const { ph, dissolved_oxygen, temperature } = reading.measurements;
    const hwStatus = deviceRegistry.getStatus();
    if (!hwStatus.hardwareConnected || hwStatus.isStale) return; // Do not automate when data is stale

    const equipment = await this.getEquipmentList(reading.tankId);
    
    // Auto Aerator Rule: Turn ON if DO < 4.5 mg/L or pH > 8.8 (degassing CO2)
    const aerator = equipment.find(e => e.deviceId === 'aerator_01');
    if (aerator && aerator.mode === 'AUTO') {
      if (dissolved_oxygen !== null && dissolved_oxygen < 4.5 && aerator.state !== 'ON') {
        await this.sendEquipmentCommand('aerator_01', 'ON', 'AUTO_RULE_LOW_DO');
      } else if (dissolved_oxygen !== null && dissolved_oxygen >= 6.5 && aerator.state === 'ON') {
        await this.sendEquipmentCommand('aerator_01', 'OFF', 'AUTO_RULE_DO_OPTIMAL');
      }
    }

    // Auto Heater Rule: Turn ON if Water Temp < 26.0 °C
    const heater = equipment.find(e => e.deviceId === 'heater_01');
    if (heater && heater.mode === 'AUTO') {
      if (temperature !== null && temperature < 26.0 && heater.state !== 'ON') {
        await this.sendEquipmentCommand('heater_01', 'ON', 'AUTO_RULE_LOW_TEMP');
      } else if (temperature !== null && temperature >= 29.0 && heater.state === 'ON') {
        await this.sendEquipmentCommand('heater_01', 'OFF', 'AUTO_RULE_TEMP_OPTIMAL');
      }
    }
  }

  async logEvent({ tankId, deviceId, command, source, verifiedState, details }) {
    await dbAsync.run(`
      INSERT INTO equipment_events (tank_id, device_id, command, source, verified_state, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [tankId, deviceId, command, source, verifiedState, Date.now(), details]);
  }

  async broadcastStatus(deviceId) {
    if (!this.socketEmitter) return;
    const row = await dbAsync.get('SELECT * FROM equipment_states WHERE device_id = ?', [deviceId]);
    if (row) {
      this.socketEmitter('equipment-status', row);
    }
  }
}

module.exports = new AutomationService();
