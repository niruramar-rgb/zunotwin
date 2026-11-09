const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/connection');
const env = require('../config/env');

// GET /api/reports/water-quality - Statistical summary report
router.get('/water-quality', async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const periodHours = parseInt(req.query.hours, 10) || 24;
    const fromTime = Date.now() - (periodHours * 3600 * 1000);

    const stats = await dbAsync.get(`
      SELECT 
        COUNT(*) as total_samples,
        MIN(ph) as min_ph, MAX(ph) as max_ph, AVG(ph) as avg_ph,
        MIN(temperature) as min_temp, MAX(temperature) as max_temp, AVG(temperature) as avg_temp,
        MIN(turbidity) as min_turb, MAX(turbidity) as max_turb, AVG(turbidity) as avg_turb,
        MIN(tds) as min_tds, MAX(tds) as max_tds, AVG(tds) as avg_tds,
        MIN(salinity) as min_sal, MAX(salinity) as max_sal, AVG(salinity) as avg_sal,
        MIN(alkalinity) as min_alk, MAX(alkalinity) as max_alk, AVG(alkalinity) as avg_alk,
        MIN(ammonia) as min_nh3, MAX(ammonia) as max_nh3, AVG(ammonia) as avg_nh3,
        MIN(dissolved_oxygen) as min_do, MAX(dissolved_oxygen) as max_do, AVG(dissolved_oxygen) as avg_do
      FROM sensor_readings
      WHERE tank_id = ? AND timestamp >= ?
    `, [tankId, fromTime]);

    // Check count of nulls / missing samples
    const missingPh = await dbAsync.get(
      'SELECT COUNT(*) as count FROM sensor_readings WHERE tank_id = ? AND timestamp >= ? AND ph IS NULL',
      [tankId, fromTime]
    );

    const alertCount = await dbAsync.get(
      'SELECT COUNT(*) as count FROM alerts WHERE tank_id = ? AND timestamp >= ?',
      [tankId, fromTime]
    );

    res.json({
      success: true,
      report: {
        tankId,
        periodHours,
        periodFrom: fromTime,
        periodTo: Date.now(),
        statistics: stats,
        dataIntegrity: {
          totalSamples: stats?.total_samples || 0,
          missingPhSamples: missingPh?.count || 0,
          missingDataPercentage: stats?.total_samples > 0 
            ? Number(((missingPh?.count || 0) / stats.total_samples * 100).toFixed(1))
            : 0
        },
        alertsLogged: alertCount?.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/export-csv - Stream real CSV of sensor readings
router.get('/export-csv', async (req, res) => {
  try {
    const tankId = req.query.tankId || env.DEFAULT_TANK_ID;
    const periodHours = parseInt(req.query.hours, 10) || 24;
    const fromTime = Date.now() - (periodHours * 3600 * 1000);

    const rows = await dbAsync.all(`
      SELECT timestamp, ph, temperature, turbidity, tds, salinity, alkalinity, ammonia, dissolved_oxygen, source
      FROM sensor_readings
      WHERE tank_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `, [tankId, fromTime]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=zuno_twin_water_quality_${tankId}_${Date.now()}.csv`);

    let csv = 'Timestamp,ISO_Time,Tank_ID,pH,Temperature_C,Turbidity_NTU,TDS_ppm,Salinity_ppt,Alkalinity_mgL,Ammonia_mgL,DO_mgL,Source\n';

    for (const r of rows) {
      const iso = new Date(r.timestamp).toISOString();
      csv += `${r.timestamp},${iso},${tankId},${r.ph ?? ''},${r.temperature ?? ''},${r.turbidity ?? ''},${r.tds ?? ''},${r.salinity ?? ''},${r.alkalinity ?? ''},${r.ammonia ?? ''},${r.dissolved_oxygen ?? ''},${r.source}\n`;
    }

    res.send(csv);
  } catch (err) {
    res.status(500).send(`Error generating CSV: ${err.message}`);
  }
});

module.exports = router;
