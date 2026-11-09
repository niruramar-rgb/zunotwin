import React, { useState, useEffect } from 'react';
import { FileText, Download, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Database } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export function ReportsPage() {
  const { selectedTank } = useSocket();
  const [reportHours, setReportHours] = useState(24);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const res = await api.getWaterQualityReport(selectedTank, reportHours);
        if (res.success && res.report) {
          setReportData(res.report);
        }
      } catch (_) {}
      finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [selectedTank, reportHours]);

  const stats = reportData?.statistics || {};
  const integrity = reportData?.dataIntegrity || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Aquaculture Audit & Compliance Reports</h2>
          <p className="text-xs text-slate-400 mt-1">
            Statistical summaries, missing sensor data auditing, and downloadable CSV telemetry archives
          </p>
        </div>

        {/* Download CSV Button */}
        <a
          href={api.getCsvExportUrl(selectedTank, reportHours)}
          download
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs hover:shadow-neon-cyan transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Dataset</span>
        </a>
      </div>

      {/* Filter Hours */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Time Window:</span>
        {[12, 24, 72, 168].map(h => (
          <button
            key={h}
            onClick={() => setReportHours(h)}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium border ${
              reportHours === h 
                ? 'bg-cyan-neon/20 border-cyan-neon text-cyan-neon' 
                : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            {h < 48 ? `${h} Hours` : `${h / 24} Days`}
          </button>
        ))}
      </div>

      {/* Integrity & Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Logged Records</span>
            <Database className="w-4 h-4 text-cyan-neon" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {integrity.totalSamples || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Spanning past {reportHours} hours
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Missing Data / Sensor Drops</span>
            <AlertTriangle className="w-4 h-4 text-status-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {integrity.missingDataPercentage ?? 0}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {integrity.missingPhSamples || 0} missing probe intervals
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Audit Alert Events</span>
            <ShieldCheck className="w-4 h-4 text-status-normal" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {reportData?.alertsLogged || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Breaches recorded in period
          </p>
        </div>
      </div>

      {/* Statistical Summary Table */}
      <div className="glass-panel p-5 rounded-2xl border border-navy-700/80">
        <h3 className="text-sm font-bold text-white mb-3">Parametric Statistical Distribution</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-navy-700 text-slate-400">
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Min Value</th>
                <th className="py-2.5 px-3">Mean Average</th>
                <th className="py-2.5 px-3">Max Value</th>
                <th className="py-2.5 px-3">Optimal Target Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">pH Level</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_ph ? stats.min_ph.toFixed(2) : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_ph ? stats.avg_ph.toFixed(2) : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_ph ? stats.max_ph.toFixed(2) : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">7.8 - 8.3 pH</td>
              </tr>
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">Water Temperature</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_temp ? `${stats.min_temp.toFixed(1)}°C` : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_temp ? `${stats.avg_temp.toFixed(1)}°C` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_temp ? `${stats.max_temp.toFixed(1)}°C` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">28.0 - 30.5 °C</td>
              </tr>
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">Ammonia (NH3)</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_nh3 ? `${stats.min_nh3.toFixed(3)} mg/L` : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_nh3 ? `${stats.avg_nh3.toFixed(3)} mg/L` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_nh3 ? `${stats.max_nh3.toFixed(3)} mg/L` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">0.0 - 0.05 mg/L</td>
              </tr>
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">Turbidity</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_turb ? `${stats.min_turb.toFixed(1)} NTU` : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_turb ? `${stats.avg_turb.toFixed(1)} NTU` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_turb ? `${stats.max_turb.toFixed(1)} NTU` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">15.0 - 30.0 NTU</td>
              </tr>
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">Total Dissolved Solids</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_tds ? `${stats.min_tds.toFixed(0)} ppm` : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_tds ? `${stats.avg_tds.toFixed(0)} ppm` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_tds ? `${stats.max_tds.toFixed(0)} ppm` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">1500 - 2000 ppm</td>
              </tr>
              <tr className="hover:bg-navy-900/50">
                <td className="py-2.5 px-3 font-semibold text-white">Salinity</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.min_sal ? `${stats.min_sal.toFixed(1)} ppt` : '--'}</td>
                <td className="py-2.5 px-3 font-bold text-cyan-neon">{stats.avg_sal ? `${stats.avg_sal.toFixed(1)} ppt` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-300">{stats.max_sal ? `${stats.max_sal.toFixed(1)} ppt` : '--'}</td>
                <td className="py-2.5 px-3 text-slate-400">20.0 - 28.0 ppt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
