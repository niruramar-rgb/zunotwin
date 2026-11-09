import React from 'react';
import { EquipmentPanel } from '../components/EquipmentPanel';
import { Cpu, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export function EquipmentPage() {
  const { hardwareStatus } = useSocket();
  const isConnected = hardwareStatus?.hardwareConnected;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Hatchery Equipment & Automation Console</h2>
          <p className="text-xs text-slate-400 mt-1">
            Verified physical relay control (ESP32 GPIO 15), safety cycle times, and automated environmental rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
            isConnected ? 'bg-status-normal/10 border-status-normal/40 text-status-normal' : 'bg-status-critical/15 border-status-critical/40 text-status-critical'
          }`}>
            {isConnected ? 'RELAY BUS READY' : 'ACTUATORS ISOLATED'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Control Panel */}
        <div className="lg:col-span-7">
          <EquipmentPanel />
        </div>

        {/* Right: Automation Rules & Safety Protocol */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel p-5 rounded-2xl border border-navy-700/80">
            <div className="flex items-center gap-2 text-cyan-neon mb-3">
              <Zap className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Active Automation Rules</h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-navy-900/80 border border-navy-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">RULE-01: Auto Hypoxia Mitigation</span>
                  <span className="text-[10px] text-status-normal bg-status-normal/10 px-1.5 py-0.2 rounded border border-status-normal/30">ENABLED</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Trigger <strong>Main Aerator</strong> ON when Dissolved Oxygen drops &lt; 4.5 mg/L or pH exceeds 8.8. Reverts OFF when DO &gt; 6.5 mg/L.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-900/80 border border-navy-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">RULE-02: Thermal Stabilization</span>
                  <span className="text-[10px] text-status-normal bg-status-normal/10 px-1.5 py-0.2 rounded border border-status-normal/30">ENABLED</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Engage <strong>Immersion Heater</strong> ON when Water Temp drops &lt; 26.0 °C. Shuts OFF at 29.0 °C.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-900/80 border border-navy-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">RULE-03: Stale Data Interlock</span>
                  <span className="text-[10px] text-cyan-neon bg-cyan-neon/10 px-1.5 py-0.2 rounded border border-cyan-neon/30">FAILSAFE</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  If hardware heartbeat timeout &gt; 5.0 seconds, all automated actuation is immediately locked to prevent incorrect intervention on stale sensor values.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-navy-700/80">
            <div className="flex items-center gap-2 text-status-warning mb-2">
              <ShieldCheck className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Actuator Safety Protocol</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              All physical relay triggers require active hardware connection feedback. Rapid toggling is suppressed by a mandatory 15-second minimum cycle time (hysteresis) to prevent motor burnout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
