import React from 'react';
import { X, Bell, AlertCircle, AlertTriangle, CheckCheck, Clock } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';

export function NotificationDrawer({ isOpen, onClose }) {
  const { activeAlerts, setActiveAlerts, selectedTank } = useSocket();

  if (!isOpen) return null;

  const handleAckAll = async () => {
    try {
      await api.acknowledgeAllAlerts(selectedTank);
      setActiveAlerts([]);
    } catch (_) {}
  };

  const handleAck = async (id) => {
    try {
      await api.acknowledgeAlert(id);
      setActiveAlerts(prev => prev.filter(a => a.id !== id));
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md h-full glass-panel border-l border-navy-700 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-neon" />
              <h2 className="text-base font-bold text-white">Notifications & Alerts</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-neon/15 text-cyan-neon border border-cyan-neon/30">
                {activeAlerts.length}
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-navy-850 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {activeAlerts.length > 0 && (
            <div className="pt-3 flex justify-end">
              <button
                onClick={handleAckAll}
                className="text-xs text-cyan-neon hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Acknowledge All</span>
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3 max-h-[75vh] overflow-y-auto pr-1">
            {activeAlerts.length > 0 ? (
              activeAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-status-critical/10 border-status-critical/40 text-slate-100'
                      : 'bg-status-warning/10 border-status-warning/40 text-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {alert.severity === 'CRITICAL' ? (
                        <AlertCircle className="w-4 h-4 text-status-critical shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-navy-950/80">
                            {alert.severity}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {alert.parameter?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAck(alert.id)}
                      className="px-2 py-1 rounded bg-navy-900 border border-navy-700 text-[10px] text-slate-300 hover:text-white shrink-0"
                    >
                      Ack
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No active notifications or alerts.
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-navy-800 text-[11px] text-slate-500 font-mono text-center">
          ZUNO TWIN Notification Dispatcher
        </div>
      </div>
    </div>
  );
}
