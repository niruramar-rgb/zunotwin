const { dbAsync } = require('../database/connection');

/**
 * ZunoTwin Sensor Calibration Service
 * Manages persistent calibration coefficients, multi-point buffer calculations,
 * and temperature compensation for analog aquaculture probes (pH, TDS, Turbidity).
 */
class CalibrationService {
  constructor() {
    this.calibrations = {
      ph: {
        sensorKey: 'ph',
        isCalibrated: false,
        method: 'UNSET',
        slope: null,
        offset: null,
        tempCompEnabled: true,
        refTempC: 25.0,
        points: [],
        calibratedAt: null,
        calibratedBy: null,
        notes: 'Uncalibrated'
      },
      tds: {
        sensorKey: 'tds',
        isCalibrated: false,
        method: 'UNSET',
        slope: null,
        offset: null,
        tempCompEnabled: true,
        refTempC: 25.0,
        points: [],
        calibratedAt: null,
        calibratedBy: null,
        notes: 'Uncalibrated'
      },
      turbidity: {
        sensorKey: 'turbidity',
        isCalibrated: false,
        method: 'UNSET',
        slope: null,
        offset: null,
        tempCompEnabled: false,
        refTempC: 25.0,
        points: [],
        calibratedAt: null,
        calibratedBy: null,
        notes: 'Uncalibrated'
      }
    };
    this.initialized = false;
  }

  /**
   * Load stored calibration records from SQLite database
   */
  async init() {
    try {
      const rows = await dbAsync.all('SELECT * FROM sensor_calibrations');
      for (const row of rows) {
        if (this.calibrations[row.sensor_key]) {
          let points = [];
          try {
            points = row.points_json ? JSON.parse(row.points_json) : [];
          } catch (_) {
            points = [];
          }

          this.calibrations[row.sensor_key] = {
            sensorKey: row.sensor_key,
            isCalibrated: Boolean(row.is_calibrated),
            method: row.method || 'UNSET',
            slope: row.slope,
            offset: row.offset,
            tempCompEnabled: Boolean(row.temp_comp_enabled),
            refTempC: row.ref_temp_c || 25.0,
            points,
            calibratedAt: row.calibrated_at,
            calibratedBy: row.calibrated_by,
            notes: row.notes || ''
          };
        }
      }
      this.initialized = true;
      console.log('[CalibrationService] Initialized stored calibration profiles successfully.');
    } catch (err) {
      console.error('[CalibrationService] Init error:', err.message);
    }
  }

  /**
   * Retrieve all calibration records
   */
  getAll() {
    return this.calibrations;
  }

  /**
   * Retrieve calibration profile for specific sensor
   */
  get(sensorKey) {
    return this.calibrations[sensorKey] || null;
  }

  /**
   * Calibrate pH Probe (2-point or 3-point calibration)
   * Buffer standards: pH 4.00, pH 7.00, pH 10.00
   * 
   * @param {Object} payload 
   * @param {Array} payload.points - Array of { standard: 7.00, voltage: 1.65, rawADC: 2048, tempC: 25.0 }
   * @param {string} payload.user - Technician identifier
   * @param {string} payload.notes - Calibration notes
   */
  async calibratePH({ points, user = 'Operator', notes = '' }) {
    if (!points || !Array.isArray(points) || points.length < 2) {
      throw new Error('pH calibration requires at least 2 distinct buffer points (e.g. pH 7.00 and pH 4.00).');
    }

    // Validate points
    for (const pt of points) {
      if (typeof pt.standard !== 'number' || typeof pt.voltage !== 'number') {
        throw new Error('Each calibration point must contain standard pH and measured voltage.');
      }
      if (pt.voltage < 0.05 || pt.voltage > 3.25) {
        throw new Error(`Measured voltage ${pt.voltage}V is out of valid analog range (0.05V - 3.25V). Check probe connection.`);
      }
    }

    // Sort by standard pH
    const sorted = [...points].sort((a, b) => a.standard - b.standard);
    const p1 = sorted[0];
    const p2 = sorted[sorted.length - 1];

    const deltaV = p2.voltage - p1.voltage;
    const deltaPH = p2.standard - p1.standard;

    if (Math.abs(deltaV) < 0.10) {
      throw new Error(`Voltage difference between buffers is too small (${deltaV.toFixed(3)}V). Probe may be defective or submerged in same solution.`);
    }

    // Standard linear model: pH = slope * voltage + offset
    const slope = deltaPH / deltaV;
    const offset = p1.standard - (slope * p1.voltage);

    const now = Date.now();
    const method = points.length === 2 ? 'TWO_POINT' : 'THREE_POINT';

    await dbAsync.run(`
      INSERT INTO sensor_calibrations (sensor_key, is_calibrated, method, slope, offset, temp_comp_enabled, ref_temp_c, points_json, calibrated_at, calibrated_by, notes)
      VALUES ('ph', 1, ?, ?, ?, 1, 25.0, ?, ?, ?, ?)
      ON CONFLICT(sensor_key) DO UPDATE SET
        is_calibrated = 1,
        method = excluded.method,
        slope = excluded.slope,
        offset = excluded.offset,
        temp_comp_enabled = 1,
        ref_temp_c = 25.0,
        points_json = excluded.points_json,
        calibrated_at = excluded.calibrated_at,
        calibrated_by = excluded.calibrated_by,
        notes = excluded.notes
    `, [method, slope, offset, JSON.stringify(points), now, user, notes || `${method} Buffer Calibration`]);

    this.calibrations.ph = {
      sensorKey: 'ph',
      isCalibrated: true,
      method,
      slope,
      offset,
      tempCompEnabled: true,
      refTempC: 25.0,
      points,
      calibratedAt: now,
      calibratedBy: user,
      notes: notes || `${method} Buffer Calibration`
    };

    return this.calibrations.ph;
  }

  /**
   * Calibrate TDS Sensor
   * Uses known reference standard (e.g. 342 ppm NaCl or 1413 µS/cm standard)
   * 
   * @param {Object} payload
   * @param {number} payload.standardPpm - Certified reference value (e.g., 342 ppm)
   * @param {number} payload.voltage - Measured analog voltage in reference solution
   * @param {number} payload.waterTempC - Water temperature during calibration
   * @param {string} payload.user - Technician identifier
   */
  async calibrateTDS({ standardPpm, voltage, waterTempC = 25.0, user = 'Operator', notes = '' }) {
    if (!standardPpm || standardPpm <= 0) {
      throw new Error('Valid positive TDS reference standard value is required (e.g. 342 ppm).');
    }
    if (voltage === undefined || voltage < 0.05 || voltage > 3.25) {
      throw new Error('Measured voltage is invalid or probe is open-circuit (must be between 0.05V and 3.25V).');
    }

    // Temperature compensation factor to 25°C
    const tempFactor = 1.0 + 0.02 * (waterTempC - 25.0);
    const compensatedVoltage = voltage / tempFactor;

    // Linear calibration factor: standardPpm / compensatedVoltage
    const slope = standardPpm / compensatedVoltage;
    const offset = 0.0;
    const now = Date.now();
    const points = [{ standard: standardPpm, voltage, tempC: waterTempC, compensatedVoltage }];

    await dbAsync.run(`
      INSERT INTO sensor_calibrations (sensor_key, is_calibrated, method, slope, offset, temp_comp_enabled, ref_temp_c, points_json, calibrated_at, calibrated_by, notes)
      VALUES ('tds', 1, 'SINGLE_POINT_REF', ?, ?, 1, 25.0, ?, ?, ?, ?)
      ON CONFLICT(sensor_key) DO UPDATE SET
        is_calibrated = 1,
        method = excluded.method,
        slope = excluded.slope,
        offset = excluded.offset,
        temp_comp_enabled = 1,
        ref_temp_c = 25.0,
        points_json = excluded.points_json,
        calibrated_at = excluded.calibrated_at,
        calibrated_by = excluded.calibrated_by,
        notes = excluded.notes
    `, [slope, offset, JSON.stringify(points), now, user, notes || `Reference standard ${standardPpm} ppm`]);

    this.calibrations.tds = {
      sensorKey: 'tds',
      isCalibrated: true,
      method: 'SINGLE_POINT_REF',
      slope,
      offset,
      tempCompEnabled: true,
      refTempC: 25.0,
      points,
      calibratedAt: now,
      calibratedBy: user,
      notes: notes || `Reference standard ${standardPpm} ppm`
    };

    return this.calibrations.tds;
  }

  /**
   * Calibrate Turbidity Sensor
   * 2-point reference calibration (Clean Water 0 NTU and Standard NTU solution)
   */
  async calibrateTurbidity({ points, user = 'Operator', notes = '' }) {
    if (!points || !Array.isArray(points) || points.length < 2) {
      throw new Error('Turbidity calibration requires at least 2 points (e.g. 0 NTU clean distilled water and certified standard).');
    }

    const sorted = [...points].sort((a, b) => a.standard - b.standard);
    const p1 = sorted[0]; // Clean water ~ 0 NTU (higher voltage)
    const p2 = sorted[sorted.length - 1]; // Turbid standard (lower voltage)

    const deltaV = p2.voltage - p1.voltage;
    const deltaNTU = p2.standard - p1.standard;

    if (Math.abs(deltaV) < 0.05) {
      throw new Error('Measured voltage difference between turbidity standards is too small.');
    }

    const slope = deltaNTU / deltaV;
    const offset = p1.standard - (slope * p1.voltage);
    const now = Date.now();

    await dbAsync.run(`
      INSERT INTO sensor_calibrations (sensor_key, is_calibrated, method, slope, offset, temp_comp_enabled, ref_temp_c, points_json, calibrated_at, calibrated_by, notes)
      VALUES ('turbidity', 1, 'TWO_POINT_NTU', ?, ?, 0, 25.0, ?, ?, ?, ?)
      ON CONFLICT(sensor_key) DO UPDATE SET
        is_calibrated = 1,
        method = excluded.method,
        slope = excluded.slope,
        offset = excluded.offset,
        temp_comp_enabled = 0,
        ref_temp_c = 25.0,
        points_json = excluded.points_json,
        calibrated_at = excluded.calibrated_at,
        calibrated_by = excluded.calibrated_by,
        notes = excluded.notes
    `, [slope, offset, JSON.stringify(points), now, user, notes || 'Two-point NTU calibration']);

    this.calibrations.turbidity = {
      sensorKey: 'turbidity',
      isCalibrated: true,
      method: 'TWO_POINT_NTU',
      slope,
      offset,
      tempCompEnabled: false,
      refTempC: 25.0,
      points,
      calibratedAt: now,
      calibratedBy: user,
      notes: notes || 'Two-point NTU calibration'
    };

    return this.calibrations.turbidity;
  }

  /**
   * Reset a sensor's calibration profile back to uncalibrated
   */
  async resetCalibration(sensorKey) {
    if (!this.calibrations[sensorKey]) {
      throw new Error(`Unknown sensor key: ${sensorKey}`);
    }

    await dbAsync.run(`
      UPDATE sensor_calibrations SET
        is_calibrated = 0,
        method = 'UNSET',
        slope = NULL,
        offset = NULL,
        points_json = '[]',
        calibrated_at = NULL,
        calibrated_by = NULL,
        notes = 'Reset to uncalibrated raw state'
      WHERE sensor_key = ?
    `, [sensorKey]);

    this.calibrations[sensorKey] = {
      sensorKey,
      isCalibrated: false,
      method: 'UNSET',
      slope: null,
      offset: null,
      tempCompEnabled: sensorKey !== 'turbidity',
      refTempC: 25.0,
      points: [],
      calibratedAt: null,
      calibratedBy: null,
      notes: 'Reset to uncalibrated raw state'
    };

    return this.calibrations[sensorKey];
  }

  /**
   * Apply active calibration coefficients to compute engineering values
   * Returns calibrated value if valid calibration exists, otherwise returns null.
   */
  computeCalibratedValue(sensorKey, voltage, waterTempC = 25.0) {
    if (voltage === null || voltage === undefined || isNaN(voltage)) {
      return null;
    }

    const cal = this.calibrations[sensorKey];
    if (!cal || !cal.isCalibrated || cal.slope === null) {
      return null;
    }

    if (sensorKey === 'ph') {
      // Temperature compensation via Nernst equation factor
      let effectiveSlope = cal.slope;
      if (cal.tempCompEnabled && waterTempC > 0) {
        const refTK = 273.15 + cal.refTempC;
        const curTK = 273.15 + waterTempC;
        effectiveSlope = cal.slope * (curTK / refTK);
      }
      const ph = (effectiveSlope * voltage) + cal.offset;
      if (ph < 0.0 || ph > 14.0) return null;
      return Number(ph.toFixed(2));
    }

    if (sensorKey === 'tds') {
      let vComp = voltage;
      if (cal.tempCompEnabled && waterTempC > 0) {
        const factor = 1.0 + 0.02 * (waterTempC - cal.refTempC);
        vComp = voltage / factor;
      }
      const tds = (cal.slope * vComp) + (cal.offset || 0);
      if (tds < 0.0 || tds > 5000.0) return null;
      return Number(tds.toFixed(0));
    }

    if (sensorKey === 'turbidity') {
      const ntu = (cal.slope * voltage) + cal.offset;
      if (ntu < 0.0 || ntu > 4000.0) return null;
      return Number(ntu.toFixed(1));
    }

    return null;
  }
}

module.exports = new CalibrationService();
