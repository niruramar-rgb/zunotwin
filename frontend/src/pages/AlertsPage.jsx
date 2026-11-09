import React, { useState, useEffect } from 'react';
import { AlertsPanel } from '../components/AlertsPanel';
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export function AlertsPage() {
  const { selectedTank } = useSocket();
  const [allAlerts, setAllAlerts] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAllAlerts() {
      setLoading(true);
      try {
        const res = await api.getAlerts(selectedTank, true);
        if (res.success && res.data) {
          setAllAlerts(res.data);
        }
      } catch (_) {}
      finally {
        setLoading(false);
      }
    }
    loadAllAlerts();
  }, [selectedTank]);

  const filtered = allAlerts.filter(a => {
    if (filterSeverity === 'CRITICAL') return a.severity === 'CRITICAL';
    if (filterSeverity === 'WARNING') return a.severity === 'WARNING';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Aquaculture Alert & Event Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Audited history of water-quality threshold breaches, hardware drops, and intervention logs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Alerts Panel */}
        <div className="lg:col-span-5">
          <AlertsPanel />
        </div>

        {/* Right: Comprehensive Alert Log Table */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-navy-700/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Historical Alert Log ({filtered.length})</h3>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-navy-900 border border-navy-700">
              {['ALL', 'CRITICAL', 'WARNING'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    filterSeverity === s
                      ? 'bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-navy-700 text-slate-400 sticky top-0 bg-navy-900/90">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Parameter</th>
                  <th className="py-2.5 px-3">Measured</th>
                  <th className="py-2.5 px-3">Threshold</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-navy-900/50">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(a.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.severity === 'CRITICAL' ? 'bg-status-critical/20 text-status-critical border border-status-critical/40' :
                        'bg-status-warning/20 text-status-warning border border-status-warning/40'
                      }`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-semibold capitalize">{a.parameter?.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 font-bold text-cyan-neon">{a.value ?? '--'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{a.threshold ?? '--'}</td>
                    <td className="py-2.5 px-3">
                      {a.acknowledged ? (
                        <span className="text-status-normal font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Acked</span>
                        </span>
                      ) : (
                        <span className="text-status-critical font-medium">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
