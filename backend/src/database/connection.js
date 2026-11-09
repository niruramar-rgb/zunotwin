const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const dbDir = path.dirname(env.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(env.DB_PATH, (err) => {
  if (err) {
    console.error('[DB] Failed to open SQLite database at', env.DB_PATH, err.message);
  } else {
    console.log('[DB] Connected to SQLite database at', env.DB_PATH);
    initTables();
  }
});

// Promisified DB helpers
const dbAsync = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

async function initTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tank_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      ph REAL,
      temperature REAL,
      turbidity REAL,
      tds REAL,
      salinity REAL,
      alkalinity REAL,
      ammonia REAL,
      dissolved_oxygen REAL,
      humidity REAL,
      ph_raw_adc INTEGER,
      do_raw_adc INTEGER,
      tds_raw_adc INTEGER,
      turbidity_raw_adc INTEGER,
      ldr_state INTEGER,
      ph_voltage REAL,
      do_voltage REAL,
      tds_voltage REAL,
      turbidity_voltage REAL,
      source TEXT DEFAULT 'esp32_serial',
      raw_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sensor_time ON sensor_readings(tank_id, timestamp);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tank_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      severity TEXT NOT NULL,
      parameter TEXT NOT NULL,
      value REAL,
      threshold REAL,
      message TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      ack_timestamp INTEGER,
      resolution_step TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alert_time ON alerts(tank_id, timestamp);

    CREATE TABLE IF NOT EXISTS equipment_states (
      device_id TEXT PRIMARY KEY,
      tank_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      state TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'AUTO',
      verified INTEGER DEFAULT 0,
      last_command TEXT,
      last_updated INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tank_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      command TEXT NOT NULL,
      source TEXT NOT NULL,
      verified_state TEXT,
      timestamp INTEGER NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS model_inferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tank_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      inference_type TEXT NOT NULL,
      prediction_json TEXT NOT NULL,
      explanation_json TEXT,
      confidence REAL
    );

    CREATE TABLE IF NOT EXISTS camera_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tank_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      image_filename TEXT,
      shrimp_count INTEGER DEFAULT 0,
      avg_bbox_area REAL DEFAULT 0.0,
      detections_json TEXT,
      model_version TEXT,
      human_review_status TEXT DEFAULT 'PENDING',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS farm_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      created_at INTEGER NOT NULL,
      last_login INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);

    CREATE TABLE IF NOT EXISTS sensor_configs (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      unit TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      configured INTEGER DEFAULT 1,
      hardware_source TEXT,
      min_acceptable REAL,
      max_acceptable REAL,
      optimal_min REAL,
      optimal_max REAL,
      warning_low REAL,
      warning_high REAL,
      critical_low REAL,
      critical_high REAL,
      decimals INTEGER DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sensor_calibrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_key TEXT UNIQUE NOT NULL,
      is_calibrated INTEGER DEFAULT 0,
      method TEXT DEFAULT 'UNSET',
      slope REAL,
      offset REAL,
      temp_comp_enabled INTEGER DEFAULT 1,
      ref_temp_c REAL DEFAULT 25.0,
      points_json TEXT,
      calibrated_at INTEGER,
      calibrated_by TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS disease_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      image_filename TEXT NOT NULL,
      file_size_bytes INTEGER,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      status TEXT NOT NULL,
      predicted_class TEXT,
      confidence REAL,
      all_probabilities_json TEXT,
      explanation TEXT,
      actionable_steps TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_disease_time ON disease_analyses(timestamp);
  `;

  try {
    await dbAsync.exec(schema);
    console.log('[DB] Core tables initialized successfully');

    // Run safe migrations for existing tables
    const tableInfo = await dbAsync.all("PRAGMA table_info(sensor_readings)");
    const existingCols = new Set(tableInfo.map(c => c.name));
    const newColumns = [
      { name: 'ph_raw_adc', type: 'INTEGER' },
      { name: 'do_raw_adc', type: 'INTEGER' },
      { name: 'tds_raw_adc', type: 'INTEGER' },
      { name: 'turbidity_raw_adc', type: 'INTEGER' },
      { name: 'ldr_state', type: 'INTEGER' },
      { name: 'ph_voltage', type: 'REAL' },
      { name: 'do_voltage', type: 'REAL' },
      { name: 'tds_voltage', type: 'REAL' },
      { name: 'turbidity_voltage', type: 'REAL' }
    ];

    for (const col of newColumns) {
      if (!existingCols.has(col.name)) {
        await dbAsync.run(`ALTER TABLE sensor_readings ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[DB Migration] Added column ${col.name} to sensor_readings`);
      }
    }

    await seedDefaultEquipment();
    await seedSensorConfigs();
    await seedDefaultCalibrations();
    await seedDefaultUserIfNeeded();
    await seedInitialHistoricalReadingsIfNeeded();
  } catch (err) {
    console.error('[DB] Schema initialization error:', err.message);
  }
}

async function seedDefaultCalibrations() {
  const defaultSensors = ['ph', 'tds', 'turbidity'];
  for (const s of defaultSensors) {
    await dbAsync.run(`
      INSERT OR IGNORE INTO sensor_calibrations (sensor_key, is_calibrated, method, temp_comp_enabled, ref_temp_c, notes)
      VALUES (?, 0, 'UNSET', 1, 25.0, 'Initial uncalibrated state')
    `, [s]);
  }
}

async function seedDefaultEquipment() {
  const devices = [
    { device_id: 'aerator_01', name: 'Main Paddlewheel Aerator', type: 'aerator', state: 'OFF', mode: 'AUTO' },
    { device_id: 'water_pump_01', name: 'Circulation Water Pump', type: 'water_pump', state: 'ON', mode: 'AUTO' },
    { device_id: 'heater_01', name: 'Thermostatic Immersion Heater', type: 'heater', state: 'OFF', mode: 'AUTO' },
    { device_id: 'filter_01', name: 'Bio-Drum Mechanical Filter', type: 'filter', state: 'ON', mode: 'AUTO' },
    { device_id: 'feeder_01', name: 'Auto Micro-Feed Dispenser', type: 'feeder', state: 'OFF', mode: 'MANUAL' }
  ];

  for (const d of devices) {
    await dbAsync.run(`
      INSERT OR IGNORE INTO equipment_states (device_id, tank_id, name, type, state, mode, verified, last_command, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'INIT', ?)
    `, [d.device_id, env.DEFAULT_TANK_ID, d.name, d.type, d.state, d.mode, Date.now()]);
  }
}

async function seedSensorConfigs() {
  const configs = [
    // 4 Currently Installed & Configured physical sensors
    {
      key: 'ph',
      label: 'pH Level',
      unit: 'pH',
      enabled: 1,
      configured: 1,
      hardware_source: 'ESP32 GPIO 32 (Analog ADC1_CH4)',
      min_acceptable: 7.5,
      max_acceptable: 8.5,
      optimal_min: 7.8,
      optimal_max: 8.3,
      warning_low: 7.2,
      warning_high: 8.8,
      critical_low: 6.8,
      critical_high: 9.2,
      decimals: 2
    },
    {
      key: 'temperature',
      label: 'Water Temp',
      unit: '°C',
      enabled: 1,
      configured: 1,
      hardware_source: 'ESP32 GPIO 23 (DS18B20 OneWire)',
      min_acceptable: 26.0,
      max_acceptable: 32.0,
      optimal_min: 28.0,
      optimal_max: 30.5,
      warning_low: 24.0,
      warning_high: 33.0,
      critical_low: 20.0,
      critical_high: 35.0,
      decimals: 1
    },
    {
      key: 'turbidity',
      label: 'Turbidity',
      unit: 'NTU',
      enabled: 1,
      configured: 1,
      hardware_source: 'ESP32 GPIO 35 (Analog SKU:SEN0189)',
      min_acceptable: 10.0,
      max_acceptable: 40.0,
      optimal_min: 15.0,
      optimal_max: 30.0,
      warning_low: 5.0,
      warning_high: 60.0,
      critical_low: 0.0,
      critical_high: 90.0,
      decimals: 1
    },
    {
      key: 'tds',
      label: 'TDS',
      unit: 'ppm',
      enabled: 1,
      configured: 1,
      hardware_source: 'ESP32 GPIO 34 (Analog ADC1_CH6)',
      min_acceptable: 1200.0,
      max_acceptable: 2400.0,
      optimal_min: 1500.0,
      optimal_max: 2000.0,
      warning_low: 900.0,
      warning_high: 2700.0,
      critical_low: 600.0,
      critical_high: 3200.0,
      decimals: 0
    },

    // 3 Future additions - NOT currently installed or configured (Unconfigured by default)
    {
      key: 'salinity',
      label: 'Salinity',
      unit: 'ppt',
      enabled: 0,
      configured: 0,
      hardware_source: 'Unassigned (Future RS485 / Modbus probe)',
      min_acceptable: 15.0,
      max_acceptable: 30.0,
      optimal_min: 20.0,
      optimal_max: 28.0,
      warning_low: 10.0,
      warning_high: 34.0,
      critical_low: 5.0,
      critical_high: 38.0,
      decimals: 1
    },
    {
      key: 'alkalinity',
      label: 'Alkalinity',
      unit: 'mg/L',
      enabled: 0,
      configured: 0,
      hardware_source: 'Unassigned (Future Photometric probe)',
      min_acceptable: 120.0,
      max_acceptable: 200.0,
      optimal_min: 140.0,
      optimal_max: 180.0,
      warning_low: 100.0,
      warning_high: 220.0,
      critical_low: 80.0,
      critical_high: 250.0,
      decimals: 0
    },
    {
      key: 'ammonia',
      label: 'Ammonia (NH3)',
      unit: 'mg/L',
      enabled: 0,
      configured: 0,
      hardware_source: 'Unassigned (Future Ion Selective Electrode)',
      min_acceptable: 0.0,
      max_acceptable: 0.1,
      optimal_min: 0.0,
      optimal_max: 0.05,
      warning_low: 0.0,
      warning_high: 0.2,
      critical_low: 0.0,
      critical_high: 0.5,
      decimals: 3
    }
  ];

  for (const c of configs) {
    await dbAsync.run(`
      INSERT OR IGNORE INTO sensor_configs (
        key, label, unit, enabled, configured, hardware_source,
        min_acceptable, max_acceptable, optimal_min, optimal_max,
        warning_low, warning_high, critical_low, critical_high, decimals, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c.key, c.label, c.unit, c.enabled, c.configured, c.hardware_source,
      c.min_acceptable, c.max_acceptable, c.optimal_min, c.optimal_max,
      c.warning_low, c.warning_high, c.critical_low, c.critical_high, c.decimals, Date.now()
    ]);
  }
}

async function seedInitialHistoricalReadingsIfNeeded() {
  const countRow = await dbAsync.get('SELECT COUNT(*) as count FROM sensor_readings');
  if (countRow && countRow.count > 0) {
    return; // Already populated
  }

  console.log('[DB] Seeding authentic historical sensor readings from dataset...');
  const csvPath = path.resolve(__dirname, '../../../data/raw/water_quality_aquaculture.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('[DB] No raw CSV found for initial seeding at', csvPath);
    return;
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length <= 1) return;

    // Header: pond_id,date,time,nitrate,ph,nh3,water_temperature,dissolved_oxygen,turbidity,salinity,tds,orp,humidity
    const header = lines[0].split(',').map(c => c.trim());
    const phIdx = header.indexOf('ph');
    const tempIdx = header.indexOf('water_temperature');
    const turbIdx = header.indexOf('turbidity');
    const tdsIdx = header.indexOf('tds');
    const salIdx = header.indexOf('salinity');
    const nh3Idx = header.indexOf('nh3');
    const doIdx = header.indexOf('dissolved_oxygen');
    const humIdx = header.indexOf('humidity');

    const sampleCount = Math.min(1500, lines.length - 1);
    const startIdx = Math.max(1, lines.length - 1 - sampleCount);
    const now = Date.now();
    const intervalMs = 60 * 1000; // 1 reading per minute

    const insertSql = `
      INSERT INTO sensor_readings (tank_id, timestamp, ph, temperature, turbidity, tds, salinity, alkalinity, ammonia, dissolved_oxygen, humidity, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map(c => c.trim());
      if (parts.length < header.length) continue;

      const offsetIdx = i - startIdx;
      const pointTimestamp = now - ((sampleCount - offsetIdx) * intervalMs);

      const ph = parseFloat(parts[phIdx]) || null;
      const temp = parseFloat(parts[tempIdx]) || null;
      const turb = parseFloat(parts[turbIdx]) || null;
      const tds = parseFloat(parts[tdsIdx]) || null;
      const sal = parseFloat(parts[salIdx]) || null;
      const nh3 = parseFloat(parts[nh3Idx]) || null;
      const doVal = parseFloat(parts[doIdx]) || null;
      const hum = parseFloat(parts[humIdx]) || null;
      const alk = ph ? (120 + (ph - 7.5) * 40) : null;

      await dbAsync.run(insertSql, [
        env.DEFAULT_TANK_ID,
        pointTimestamp,
        ph,
        temp,
        turb,
        tds,
        sal,
        alk,
        nh3,
        doVal,
        hum,
        'dataset_historical_seed'
      ]);
    }

    console.log(`[DB] Successfully seeded ${sampleCount} real historical readings`);
  } catch (err) {
    console.error('[DB] CSV seeding error:', err.message);
  }
}

async function seedDefaultUserIfNeeded() {
  try {
    const existing = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    if (existing && existing.count > 0) return;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Password@123', 10);
    const now = Date.now();
    await dbAsync.run(
      'INSERT INTO users (email, full_name, password_hash, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)',
      ['operator@zunotwin.ai', 'Aquaculture Lead Operator', hash, 'operator', now, now]
    );
    console.log('[DB] Seeded default operator account: operator@zunotwin.ai / Password@123');
  } catch (err) {
    console.warn('[DB] User seeding skipped or failed:', err.message);
  }
}

module.exports = {
  db,
  dbAsync
};
