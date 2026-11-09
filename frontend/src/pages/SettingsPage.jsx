import React, { useState } from 'react';
import { Settings, Save, Cpu, Sliders, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export function SettingsPage() {
  const { hardwareStatus } = useSocket();
  const [savedMsg, setSavedMsg] = useState(false);

  const [thresholdsState, setThresholdsState] = useState({
    species: 'Litopenaeus vannamei (Pacific White Shrimp)',
    stage: 'Post-Larvae (PL10-PL20)',
    phMin: 7.5,
    phMax: 8.5,
    tempMin: 26.0,
    tempMax: 32.0,
    turbMax: 40.0,
    tdsMin: 1200,
    tdsMax: 2400,
    salMin: 15.0,
    salMax: 30.0,
    ammoniaMax: 0.10,
    doMin: 5.0,
    baudRate: 115200,
    heartbeatTimeout: 5.0,
    mqttEnabled: false
  });

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Platform & Hardware Configuration</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure species-specific aquaculture biological thresholds, COM port parameters, and failsafe timing
          </p>
        </div>

        {savedMsg && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-normal/20 text-status-normal border border-status-normal/40 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Species & Stage */}
        <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-2 text-cyan-neon">
            <Sliders className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Aquaculture Species Target</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Target Shrimp Species</label>
              <input
                type="text"
                value={thresholdsState.species}
                onChange={e => setThresholdsState({ ...thresholdsState, species: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-cyan-neon"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Hatchery Life Stage</label>
              <input
                type="text"
                value={thresholdsState.stage}
                onChange={e => setThresholdsState({ ...thresholdsState, stage: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-cyan-neon"
              />
            </div>
          </div>
        </div>

        {/* 2. Biological Water Thresholds */}
        <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-2 text-cyan-neon">
            <Shield className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Acceptable Parameter Limits (Litopenaeus vannamei PL)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">pH Range (Min - Max)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={thresholdsState.phMin}
                  onChange={e => setThresholdsState({ ...thresholdsState, phMin: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  step="0.1"
                  value={thresholdsState.phMax}
                  onChange={e => setThresholdsState({ ...thresholdsState, phMax: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Water Temp °C (Min - Max)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={thresholdsState.tempMin}
                  onChange={e => setThresholdsState({ ...thresholdsState, tempMin: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  step="0.5"
                  value={thresholdsState.tempMax}
                  onChange={e => setThresholdsState({ ...thresholdsState, tempMax: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Ammonia NH3 Limit (mg/L)</label>
              <input
                type="number"
                step="0.01"
                value={thresholdsState.ammoniaMax}
                onChange={e => setThresholdsState({ ...thresholdsState, ammoniaMax: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Turbidity Max (NTU)</label>
              <input
                type="number"
                step="1"
                value={thresholdsState.turbMax}
                onChange={e => setThresholdsState({ ...thresholdsState, turbMax: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">TDS Range (ppm)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholdsState.tdsMin}
                  onChange={e => setThresholdsState({ ...thresholdsState, tdsMin: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  value={thresholdsState.tdsMax}
                  onChange={e => setThresholdsState({ ...thresholdsState, tdsMax: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Dissolved Oxygen Min (mg/L)</label>
              <input
                type="number"
                step="0.1"
                value={thresholdsState.doMin}
                onChange={e => setThresholdsState({ ...thresholdsState, doMin: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* 3. Hardware & Serial Communication */}
        <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-2 text-cyan-neon">
            <Cpu className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Hardware Bridge & Serial Communication</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Detected USB Port</label>
              <input
                type="text"
                readOnly
                value={hardwareStatus.portName || 'No physical COM port active'}
                className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-800 text-cyan-neon font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Serial Baud Rate</label>
              <input
                type="number"
                value={thresholdsState.baudRate}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-800 text-slate-300"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Heartbeat Failsafe (s)</label>
              <input
                type="number"
                step="0.5"
                value={thresholdsState.heartbeatTimeout}
                onChange={e => setThresholdsState({ ...thresholdsState, heartbeatTimeout: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Configuration Changes</span>
        </button>
      </form>
    </div>
  );
}
