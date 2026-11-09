const { dbAsync } = require('../database/connection');
const thresholds = require('../config/thresholds');

class AlertService {
  constructor() {
    this.socketEmitter = null;
    this.recentAlertCooldowns = new Map(); // key: `${tankId}_${param}` -> { timestamp, severity }
    this.activeViolations = new Map(); // key: `${tankId}_${param}` -> { severity, message, timestamp }
    this.cooldownMs = 120000; // 2 minutes cooldown for repeated warnings
    this.deviceAlertCooldown = 0;
  }

  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  async recordDeviceConnected(deviceId, portName) {
    const now = Date.now();
    // Throttle duplicate connection alerts within 5 seconds
    if (now - this.deviceAlertCooldown < 5000) return;
    this.deviceAlertCooldown = now;

    const message = `ESP32 hardware controller (${deviceId}) CONNECTED on ${portName}. Real hardware telemetry streaming.`;
    return await this.createAlert({
      tankId: 'tank-01',
      timestamp: now,
      severity: 'INFO',
      parameter: 'hardware_connectivity',
      value: 1,
      threshold: 1,
      message,
      resolutionStep: 'Hardware telemetry streaming nominally.'
    });
  }

  async recordDeviceDisconnected(deviceId, reason) {
    const now = Date.now();
    const message = `ESP32 hardware controller (${deviceId}) OFFLINE. Serial connection interrupted or no valid telemetry for > 10s. ${reason}`;
    return await this.createAlert({
      tankId: 'tank-01',
      timestamp: now,
      severity: 'CRITICAL',
      parameter: 'hardware_connectivity',
      value: 0,
      threshold: 1,
      message,
      resolutionStep: 'Verify USB cable connection to ESP32 on COM port, check power LED, and ensure no other application (e.g. Arduino IDE) holds the port.'
    });
  }

  async evaluateReadings(reading) {
    if (!reading || !reading.measurements) return [];
    const { tankId, timestamp, measurements } = reading;
    const generatedAlerts = [];

    for (const [param, val] of Object.entries(measurements)) {
      if (val === null || val === undefined || isNaN(val)) {
        continue;
      }

      const cooldownKey = `${tankId}_${param}`;
      const activeViolation = this.activeViolations.get(cooldownKey);

      // Check thresholds
      let th = thresholds.parameters[param];
      // Provide standard defaults if thresholds configuration doesn't define humidity
      if (!th && param === 'humidity') {
        th = {
          name: 'Ambient Humidity',
          unit: '%',
          optimalMin: 50.0,
          optimalMax: 85.0,
          warningLow: 40.0,
          warningHigh: 90.0,
          criticalLow: 25.0,
          criticalHigh: 96.0,
          advice: {
            low: 'Increase hatchery ambient misting / cover aeration zones.',
            high: 'Increase hatchery ventilation to reduce condensation.'
          }
        };
      }

      if (!th) continue;

      let severity = null;
      let thresholdHit = null;
      let msg = null;
      let resolution = null;

      if (th.criticalLow !== undefined && val <= th.criticalLow) {
        severity = 'CRITICAL';
        thresholdHit = th.criticalLow;
        msg = `CRITICAL: ${th.name} dropped to ${val} ${th.unit} (critical limit: ≤ ${th.criticalLow} ${th.unit})`;
        resolution = th.advice?.low || 'Inspect heating/cooling systems immediately.';
      } else if (th.criticalHigh !== undefined && val >= th.criticalHigh) {
        severity = 'CRITICAL';
        thresholdHit = th.criticalHigh;
        msg = `CRITICAL: ${th.name} spiked to ${val} ${th.unit} (critical limit: ≥ ${th.criticalHigh} ${th.unit})`;
        resolution = th.advice?.high || 'Provide immediate aeration and emergency water exchange.';
      } else if (th.warningLow !== undefined && val <= th.warningLow) {
        severity = 'WARNING';
        thresholdHit = th.warningLow;
        msg = `WARNING: ${th.name} is low at ${val} ${th.unit} (warning limit: ≤ ${th.warningLow} ${th.unit})`;
        resolution = th.advice?.low || 'Monitor parameter trend closely.';
      } else if (th.warningHigh !== undefined && val >= th.warningHigh) {
        severity = 'WARNING';
        thresholdHit = th.warningHigh;
        msg = `WARNING: ${th.name} is high at ${val} ${th.unit} (warning limit: ≥ ${th.warningHigh} ${th.unit})`;
        resolution = th.advice?.high || 'Verify environmental controls.';
      }

      const now = Date.now();

      if (severity) {
        // Condition is out of spec
        const lastAlert = this.recentAlertCooldowns.get(cooldownKey);
        const shouldAlert = !lastAlert || 
          (severity === 'CRITICAL' && lastAlert.severity === 'WARNING') ||
          (now - lastAlert.timestamp > this.cooldownMs);

        if (shouldAlert) {
          this.recentAlertCooldowns.set(cooldownKey, { timestamp: now, severity });
          this.activeViolations.set(cooldownKey, { severity, thresholdHit, timestamp: now });

          const alertRecord = await this.createAlert({
            tankId,
            timestamp: now,
            severity,
            parameter: param,
            value: val,
            threshold: thresholdHit,
            message: msg,
            resolutionStep: resolution
          });
          generatedAlerts.push(alertRecord);
        }
      } else {
        // Condition is in normal range!
        // If there was an active violation for this parameter, record recovery!
        if (activeViolation) {
          this.activeViolations.delete(cooldownKey);
          this.recentAlertCooldowns.delete(cooldownKey);

          const recoveryMsg = `RECOVERY: ${th.name} has returned to safe operational range (${val} ${th.unit}). Parameter normalized.`;
          const recoveryAlert = await this.createAlert({
            tankId,
            timestamp: now,
            severity: 'NORMAL',
            parameter: param,
            value: val,
            threshold: null,
            message: recoveryMsg,
            resolutionStep: 'Condition resolved. Automatic monitoring continues.'
          });

          // Auto-acknowledge previous active alerts for this parameter
          await dbAsync.run(
            'UPDATE alerts SET acknowledged = 1, ack_timestamp = ? WHERE tank_id = ? AND parameter = ? AND acknowledged = 0',
            [now, tankId, param]
          );

          if (this.socketEmitter) {
            this.socketEmitter('alert-resolved', { tankId, parameter: param, timestamp: now });
          }

          generatedAlerts.push(recoveryAlert);
        }
      }
    }

    return generatedAlerts;
  }

  async createAlert({ tankId, timestamp = Date.now(), severity, parameter, value, threshold, message, resolutionStep }) {
    const res = await dbAsync.run(`
      INSERT INTO alerts (tank_id, timestamp, severity, parameter, value, threshold, message, acknowledged, resolution_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [tankId, timestamp, severity, parameter, value, threshold, message, resolutionStep]);

    const created = {
      id: res.lastID,
      tankId,
      timestamp,
      severity,
      parameter,
      value,
      threshold,
      message,
      acknowledged: false,
      resolutionStep
    };

    if (this.socketEmitter) {
      this.socketEmitter('alert-created', created);
    }

    return created;
  }

  async getActiveAlerts(tankId = null, limit = 50) {
    let sql = 'SELECT * FROM alerts WHERE acknowledged = 0';
    const params = [];
    if (tankId) {
      sql += ' AND tank_id = ?';
      params.push(tankId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return await dbAsync.all(sql, params);
  }

  async getAllAlerts(tankId = null, limit = 100) {
    let sql = 'SELECT * FROM alerts';
    const params = [];
    if (tankId) {
      sql += ' AND tank_id = ?';
      params.push(tankId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return await dbAsync.all(sql, params);
  }

  async acknowledgeAlert(alertId) {
    const now = Date.now();
    await dbAsync.run(
      'UPDATE alerts SET acknowledged = 1, ack_timestamp = ? WHERE id = ?',
      [now, alertId]
    );
    return { success: true, alertId, ackTimestamp: now };
  }

  async acknowledgeAll(tankId = null) {
    const now = Date.now();
    let sql = 'UPDATE alerts SET acknowledged = 1, ack_timestamp = ? WHERE acknowledged = 0';
    const params = [now];
    if (tankId) {
      sql += ' AND tank_id = ?';
      params.push(tankId);
    }
    await dbAsync.run(sql, params);
    return { success: true, ackTimestamp: now };
  }

  async recordGroupReviewAlert({ tankId, distinctCount = 3, specimens = ['Shrimp #1 (P1)', 'Shrimp #2 (P2)', 'Shrimp #3 (P3)'], evidenceFiles = [], diseaseName = 'Black Spot Disease' }) {
    const message = `WARNING: Disease detected in ${distinctCount} shrimp specimens (${specimens.join(', ')}). ${diseaseName} cuticular lesions confirmed by AI inspection. Quarantine required.`;
    const resolution = 'Isolate the 3 flagged shrimp specimens into quarantine tank immediately, perform 20-25% bio-secured water exchange, and administer competitive-exclusion probiotics.';
    return await this.createAlert({
      tankId: tankId || 'tank-01',
      timestamp: Date.now(),
      severity: 'WARNING',
      parameter: 'shrimp_disease_detection',
      value: distinctCount,
      threshold: 3,
      message,
      resolutionStep: resolution
    });
  }
}

module.exports = new AlertService();
