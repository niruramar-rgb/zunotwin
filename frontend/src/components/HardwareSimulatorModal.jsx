import React, { useState } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  Play, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export function HardwareSimulatorModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('nominal');
  const [customValues, setCustomValues] = useState({
    ph: 8.0,
    temperature: 28.5,
    turbidity: 22.0,
    tds: 1680.0,
    salinity: 24.0,
    ammonia: 0.02,
    dissolved_oxygen: 6.5
  });
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen) return null;

  const handleInject = async (selectedMode) => {
    setStatusMsg('Injecting test fixture...');
    try {
      const res = await api.simulateTelemetry(selectedMode || mode, customValues);
      if (res.success) {
        setStatusMsg(`Successfully injected ${selectedMode || mode.toUpperCase()} test fixture!`);
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-cyan-neon/40 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-neon" />
            <h2 className="text-base font-bold text-white">Hardware Simulation Test Bench</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 my-4 rounded-xl bg-cyan-neon/10 border border-cyan-neon/30 text-xs text-cyan-neon leading-relaxed">
          <strong>Notice:</strong> Test fixtures allow verifying alert thresholds, 3D digital twin reactions, and equipment failover without physical probes attached. All data is explicitly stamped as <code>test_fixture_simulation</code>.
        </div>

        {/* Preset Modes */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <button
            onClick={() => { setMode('nominal'); handleInject('nominal'); }}
            className={`p-3 rounded-xl border text-center transition-all ${
              mode === 'nominal'
                ? 'bg-status-normal/20 border-status-normal text-status-normal shadow-sm'
                : 'bg-navy-900 border-navy-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-status-normal" />
            <span className="text-xs font-bold block">Nominal State</span>
            <span className="text-[10px] text-slate-400">All Optimal</span>
          </button>

          <button
            onClick={() => { setMode('warning'); handleInject('warning'); }}
            className={`p-3 rounded-xl border text-center transition-all ${
              mode === 'warning'
                ? 'bg-status-warning/20 border-status-warning text-status-warning shadow-sm'
                : 'bg-navy-900 border-navy-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-status-warning" />
            <span className="text-xs font-bold block">Warning State</span>
            <span className="text-[10px] text-slate-400">Sub-Optimal</span>
          </button>

          <button
            onClick={() => { setMode('critical'); handleInject('critical'); }}
            className={`p-3 rounded-xl border text-center transition-all ${
              mode === 'critical'
                ? 'bg-status-critical/20 border-status-critical text-status-critical shadow-sm'
                : 'bg-navy-900 border-navy-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <ShieldAlert className="w-4 h-4 mx-auto mb-1 text-status-critical" />
            <span className="text-xs font-bold block">Critical State</span>
            <span className="text-[10px] text-slate-400">Hypoxia / NH3</span>
          </button>
        </div>

        {statusMsg && (
          <div className="mb-4 p-2.5 rounded-lg bg-navy-900 text-xs font-mono text-cyan-neon border border-navy-700 text-center">
            {statusMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-navy-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300"
          >
            Close Bench
          </button>
          <button
            onClick={() => handleInject(mode)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs flex items-center gap-1.5 shadow-neon-cyan"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Inject Telemetry Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
