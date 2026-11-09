import React from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  CheckCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';

export function AlertsPanel() {
  const { activeAlerts, setActiveAlerts, selectedTank } = useSocket();

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      alert(`Failed to acknowledge alert: ${err.message}`);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await api.acknowledgeAllAlerts(selectedTank);
      setActiveAlerts([]);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  };

  const unacknowledged = activeAlerts.filter(a => !a.acknowledged);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 flex flex-col justify-between">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-status-warning" />
          <h3 className="text-sm font-bold text-white tracking-wide">Live Aquaculture Alerts</h3>
          {unacknowledged.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-critical/20 text-status-critical border border-status-critical/30">
              {unacknowledged.length} Active
            </span>
          )}
        </div>

        {unacknowledged.length > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-neon" />
            <span>Ack All</span>
          </button>
        )}
      </div>

      {/* Alert Feed */}
      <div className="my-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {unacknowledged.length > 0 ? (
          unacknowledged.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const timeAgo = Math.round((Date.now() - alert.timestamp) / 1000);

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCritical
                    ? 'bg-status-critical/10 border-status-critical/40'
                    : 'bg-status-warning/10 border-status-warning/35'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {isCritical ? (
                      <AlertCircle className="w-4 h-4 text-status-critical shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                          isCritical
                            ? 'bg-status-critical/20 text-status-critical border-status-critical/40'
                            : 'bg-status-warning/20 text-status-warning border-status-warning/40'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs font-bold text-white capitalize">
                          {alert.parameter?.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 mt-1">
                        {alert.message}
                      </p>

                      {alert.resolution_step && (
                        <div className="mt-2 text-[11px] text-cyan-neon flex items-start gap-1 bg-navy-950/60 p-2 rounded-lg border border-navy-800">
                          <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
                          <span><strong>Action:</strong> {alert.resolution_step}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-2.5 py-1 rounded bg-navy-900 hover:bg-navy-800 border border-navy-700 text-[11px] font-medium text-slate-300 hover:text-white shrink-0 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
            <CheckCircle className="w-8 h-8 text-status-normal/40 mb-1" />
            <p className="text-slate-400 font-medium">All Parameters Within Safe Operating Limits</p>
            <p className="text-[11px] text-slate-500 mt-0.5">No unacknowledged biological or water quality alerts.</p>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-navy-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>Target: Pacific White Shrimp (PL12)</span>
        <span>Cooldown: 3m Hysteresis</span>
      </div>
    </div>
  );
}
