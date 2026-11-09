import React from 'react';
import { SensorCards } from '../components/SensorCards';
import { WaterQualityTrends } from '../charts/WaterQualityTrends';
import { FutureSensorsSection } from '../components/FutureSensorsSection';
import { useSocket } from '../contexts/SocketContext';
import { Activity } from 'lucide-react';

export function LiveMonitoringPage() {
  const { latestSensors, hardwareStatus } = useSocket();
  const cards = latestSensors?.cards || {};
  const isConnected = hardwareStatus?.hardwareConnected;

  // Filter for the 4 physical configured sensors only
  const configuredCards = ['ph', 'temperature', 'turbidity', 'tds']
    .map(k => cards[k])
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Water Quality Telemetry Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time physical sensor stream telemetry with EWMA anomaly detection bands
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-neon">Hatchery Rack 01 • Tank 01</span>
        </div>
      </div>

      {/* 4 Sensor Cards */}
      <SensorCards />

      {/* Detailed Diagnostics Table for 4 Configured Sensors */}
      <div className="glass-panel p-5 rounded-3xl border border-navy-700/80">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-neon" />
          <span>Configured Physical Probes Diagnostic Registry</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-navy-700 text-slate-400">
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Hardware Probe</th>
                <th className="py-2.5 px-3">Live Value</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Optimal Target</th>
                <th className="py-2.5 px-3">Acceptable Range</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">1h Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {configuredCards.map(c => (
                <tr key={c.key} className="hover:bg-navy-900/50">
                  <td className="py-2.5 px-3 font-semibold text-white">{c.label}</td>
                  <td className="py-2.5 px-3 text-slate-400">{c.hardwareSource || 'ESP32 Probe'}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-neon">
                    {isConnected && c.value !== null ? c.value : '--'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{c.unit}</td>
                  <td className="py-2.5 px-3 text-slate-300">{c.optimalMin} - {c.optimalMax}</td>
                  <td className="py-2.5 px-3 text-slate-400">{c.acceptableMin} - {c.acceptableMax}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'NORMAL' ? 'bg-status-normal/15 text-status-normal' :
                      c.status === 'WARNING' ? 'bg-status-warning/15 text-status-warning' :
                      c.status === 'CRITICAL' ? 'bg-status-critical/20 text-status-critical' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isConnected ? c.status : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{isConnected ? c.trend : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Trend Chart */}
      <WaterQualityTrends />

      {/* Phase 2 Future Sensors */}
      <FutureSensorsSection />
    </div>
  );
}
