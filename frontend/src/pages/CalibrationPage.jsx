import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  FlaskConical, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  Trash2, 
  Info, 
  Zap, 
  ShieldCheck, 
  Thermometer, 
  Activity,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export function CalibrationPage() {
  const { hardwareStatus, sensorSummary } = useSocket();
  const [activeSensor, setActiveSensor] = useState('ph'); // 'ph' | 'tds' | 'turbidity'
  const [calibrations, setCalibrations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Current live hardware measurements
  const liveCards = sensorSummary?.cards || {};
  const currentWaterTemp = liveCards.temperature?.value || 25.0;

  // Form states
  // pH 2-point / 3-point form
  const [phPoints, setPhPoints] = useState([
    { standard: 7.00, voltage: 1.65, label: 'Neutral Buffer (pH 7.00)' },
    { standard: 4.00, voltage: 1.98, label: 'Acidic Buffer (pH 4.00)' }
  ]);
  const [phNotes, setPhNotes] = useState('');

  // TDS form
  const [tdsStandard, setTdsStandard] = useState(342); // 342 ppm NaCl
  const [tdsVoltage, setTdsVoltage] = useState(1.42);
  const [tdsNotes, setTdsNotes] = useState('');

  // Turbidity form
  const [turbPoints, setTurbPoints] = useState([
    { standard: 0, voltage: 3.85, label: 'Clear Water Standard (0 NTU)' },
    { standard: 100, voltage: 2.90, label: 'Formazin Standard (100 NTU)' }
  ]);
  const [turbNotes, setTurbNotes] = useState('');

  const loadCalibrations = async () => {
    setIsLoading(true);
    try {
      const res = await api.getCalibrations();
      if (res.success && res.data) {
        setCalibrations(res.data);
      }
    } catch (err) {
      console.warn('Failed to load calibrations:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalibrations();
  }, []);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Helper to capture current hardware voltage into form
  const captureCurrentVoltage = (setter, index = null) => {
    let volt = null;
    if (activeSensor === 'ph') {
      volt = liveCards.ph?.voltage;
    } else if (activeSensor === 'tds') {
      volt = liveCards.tds?.voltage;
    } else if (activeSensor === 'turbidity') {
      volt = liveCards.turbidity?.voltage;
    }

    if (volt === null || volt === undefined) {
      showFeedback('error', `No active hardware voltage available for ${activeSensor.toUpperCase()}. Ensure ESP32 is connected.`);
      return;
    }

    if (index !== null) {
      setter(prev => {
        const copy = [...prev];
        copy[index].voltage = Number(volt.toFixed(3));
        return copy;
      });
    } else {
      setter(Number(volt.toFixed(3)));
    }
    showFeedback('success', `Captured live hardware reading: ${volt.toFixed(3)}V`);
  };

  // Save pH calibration
  const handleSavePH = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.calibratePH(phPoints, 'Operator', phNotes);
      if (res.success) {
        showFeedback('success', 'pH probe calibrated successfully! Live telemetry is now converted with active coefficients.');
        await loadCalibrations();
      }
    } catch (err) {
      showFeedback('error', `pH calibration failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save TDS calibration
  const handleSaveTDS = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.calibrateTDS(tdsStandard, tdsVoltage, currentWaterTemp, 'Operator', tdsNotes);
      if (res.success) {
        showFeedback('success', 'TDS probe calibrated successfully! Telemetry is now calculated with temperature compensation.');
        await loadCalibrations();
      }
    } catch (err) {
      showFeedback('error', `TDS calibration failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Turbidity calibration
  const handleSaveTurbidity = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.calibrateTurbidity(turbPoints, 'Operator', turbNotes);
      if (res.success) {
        showFeedback('success', 'Turbidity probe calibrated successfully! Live readings are now converted to NTU.');
        await loadCalibrations();
      }
    } catch (err) {
      showFeedback('error', `Turbidity calibration failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset calibration
  const handleReset = async (sensorKey) => {
    if (!window.confirm(`Reset ${sensorKey.toUpperCase()} sensor back to uncalibrated raw ADC mode?`)) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.resetCalibration(sensorKey);
      if (res.success) {
        showFeedback('success', `${sensorKey.toUpperCase()} reset to raw uncalibrated mode.`);
        await loadCalibrations();
      }
    } catch (err) {
      showFeedback('error', `Reset failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentCal = calibrations[activeSensor] || {};

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-navy-800 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-cyan-neon" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Sensor Calibration Laboratory
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon font-mono font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              PERSISTENT COEFFICIENTS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Calibrate physical ESP32 analog probes using certified chemical buffer standards and reference solutions. Coefficients are stored persistently in SQLite and survive system restarts.
          </p>
        </div>

        <button
          onClick={loadCalibrations}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-850 text-cyan-neon text-xs font-semibold border border-navy-700/80 flex items-center gap-1.5 transition-all shadow-sm hover:border-cyan-neon/50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reload Profiles</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-status-normal/10 border-status-normal/40 text-status-normal shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
            : 'bg-status-critical/10 border-status-critical/40 text-status-critical shadow-[0_0_15px_rgba(239,68,68,0.15)]'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sensor Selection Navigation Tabs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'ph', label: 'pH Electrode (GPIO 32)', unit: 'pH', icon: Activity },
          { key: 'tds', label: 'TDS / Salinity (GPIO 34)', unit: 'ppm', icon: Zap },
          { key: 'turbidity', label: 'Turbidity Optical (GPIO 35)', unit: 'NTU', icon: Layers }
        ].map(s => {
          const isSelected = activeSensor === s.key;
          const calObj = calibrations[s.key];
          const isCal = calObj?.isCalibrated;

          return (
            <button
              key={s.key}
              onClick={() => setActiveSensor(s.key)}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-navy-900/90 border-cyan-neon shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                  : 'bg-navy-950/60 border-navy-800/80 hover:border-navy-700 hover:bg-navy-900/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-4 h-4 ${isSelected ? 'text-cyan-neon' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  isCal 
                    ? 'bg-status-normal/15 text-status-normal border border-status-normal/30' 
                    : 'bg-navy-800 text-slate-400 border border-navy-700'
                }`}>
                  {isCal ? 'CALIBRATED' : 'UNCALIBRATED'}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{s.label}</div>
              <div className="text-xs text-slate-400 mt-1 font-mono">Output: {s.unit}</div>
            </button>
          );
        })}
      </div>

      {/* Live Probe Diagnostics & Active Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live Hardware Telemetry Monitor */}
        <div className="p-4 rounded-2xl glass-panel border border-cyan-neon/30 bg-navy-950/70 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 font-mono">LIVE HARDWARE PROBE</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              hardwareStatus?.hardwareConnected
                ? 'bg-status-normal/15 text-status-normal border border-status-normal/30'
                : 'bg-status-critical/15 text-status-critical border border-status-critical/30'
            }`}>
              {hardwareStatus?.hardwareConnected ? 'ESP32 ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono mt-3">
            <div className="flex justify-between text-slate-400">
              <span>Port:</span>
              <span className="text-white font-bold">{hardwareStatus?.portName || 'None'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Raw ADC:</span>
              <span className="text-cyan-neon font-bold">
                {activeSensor === 'ph' ? (liveCards.ph?.rawADC ?? '—') :
                 activeSensor === 'tds' ? (liveCards.tds?.rawADC ?? '—') :
                 (liveCards.turbidity?.rawADC ?? '—')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Measured Voltage:</span>
              <span className="text-cyan-neon font-bold">
                {activeSensor === 'ph' ? (liveCards.ph?.voltage ? `${liveCards.ph.voltage} V` : '—') :
                 activeSensor === 'tds' ? (liveCards.tds?.voltage ? `${liveCards.tds.voltage} V` : '—') :
                 (liveCards.turbidity?.voltage ? `${liveCards.turbidity.voltage} V` : '—')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Water Temp:</span>
              <span className="text-white">{currentWaterTemp.toFixed(1)} °C</span>
            </div>
          </div>
        </div>

        {/* Active Calibration Profile Summary */}
        <div className="p-4 rounded-2xl glass-panel border border-navy-700/80 bg-navy-950/70 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 font-mono">ACTIVE COEFFICIENT PROFILE</span>
            {currentCal.isCalibrated && (
              <button
                onClick={() => handleReset(activeSensor)}
                disabled={isSaving}
                className="px-2.5 py-1 rounded-lg bg-status-critical/15 hover:bg-status-critical/25 text-status-critical border border-status-critical/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset to Uncalibrated</span>
              </button>
            )}
          </div>

          {currentCal.isCalibrated ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono mt-3">
              <div className="p-2.5 rounded-xl bg-navy-900/60 border border-navy-800">
                <span className="text-slate-400 text-[10px] block">METHOD</span>
                <span className="text-cyan-neon font-bold">{currentCal.method}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-navy-900/60 border border-navy-800">
                <span className="text-slate-400 text-[10px] block">SLOPE (m)</span>
                <span className="text-white font-bold">{currentCal.slope?.toFixed(4) ?? '—'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-navy-900/60 border border-navy-800">
                <span className="text-slate-400 text-[10px] block">OFFSET (b)</span>
                <span className="text-white font-bold">{currentCal.offset?.toFixed(4) ?? '—'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-navy-900/60 border border-navy-800">
                <span className="text-slate-400 text-[10px] block">TEMP COMP</span>
                <span className="text-status-normal font-bold">
                  {currentCal.tempCompEnabled ? 'ACTIVE (25°C)' : 'DISABLED'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-navy-900/40 border border-navy-800 text-xs text-slate-400 mt-2 flex items-center gap-2.5">
              <Info className="w-4 h-4 text-cyan-neon flex-shrink-0" />
              <span>
                Sensor is currently operating in <strong>uncalibrated raw mode</strong>. Values are reported as raw ADC readings without scientific conversions to prevent inaccurate aquaculture decisions.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Calibration Form Stage */}
      <div className="glass-panel p-6 rounded-3xl border border-navy-700/80 bg-navy-950/80 space-y-6 shadow-xl">
        {/* pH Sensor Form */}
        {activeSensor === 'ph' && (
          <form onSubmit={handleSavePH} className="space-y-6">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-neon">
                <FlaskConical className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">pH Buffer Calibration (2-Point Nernst Method)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Reference Temperature: 25.0 °C</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Submerge probe in certified buffer solutions sequentially. Rinse with distilled water and pat dry between points. Ensure measured voltage stabilizes before recording.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phPoints.map((pt, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{pt.label}</span>
                    <button
                      type="button"
                      onClick={() => captureCurrentVoltage(setPhPoints, idx)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-neon/10 hover:bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Capture Live Voltage</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-400 block mb-1">Standard pH</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pt.standard}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setPhPoints(prev => {
                            const copy = [...prev];
                            copy[idx].standard = val;
                            return copy;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-cyan-neon font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Measured Voltage (V)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={pt.voltage}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setPhPoints(prev => {
                            const copy = [...prev];
                            copy[idx].voltage = val;
                            return copy;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-cyan-neon focus:outline-none focus:border-cyan-neon font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-mono">Technician Notes / Buffer Batch ID</label>
              <input
                type="text"
                placeholder="e.g., Hanna Instruments Certified Buffer Lot #4928"
                value={phNotes}
                onChange={(e) => setPhNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-xs text-white focus:outline-none focus:border-cyan-neon"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Calculating & Saving...' : 'Save pH Calibration Coefficients'}</span>
            </button>
          </form>
        )}

        {/* TDS Sensor Form */}
        {activeSensor === 'tds' && (
          <form onSubmit={handleSaveTDS} className="space-y-6">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-neon">
                <Zap className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">TDS / EC Standard Calibration</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Temp Compensation: Active (2.0%/°C)</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Submerge the TDS probe into a known reference solution (e.g., 342 ppm NaCl calibration solution or 1413 µS/cm standard). Water temperature is continuously tracked from the DS18B20 probe to compute thermal correction.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-3">
                <label className="text-xs font-bold text-white block">Certified Reference Standard</label>
                <div className="text-xs font-mono">
                  <label className="text-slate-400 block mb-1">Standard TDS (ppm)</label>
                  <input
                    type="number"
                    value={tdsStandard}
                    onChange={(e) => setTdsStandard(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-white font-bold focus:outline-none focus:border-cyan-neon"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Common standards: 342 ppm (NaCl) or 1000 ppm</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Measured Probe Voltage</label>
                  <button
                    type="button"
                    onClick={() => captureCurrentVoltage(setTdsVoltage)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-neon/10 hover:bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Capture Live</span>
                  </button>
                </div>
                <div className="text-xs font-mono">
                  <label className="text-slate-400 block mb-1">Voltage (V)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={tdsVoltage}
                    onChange={(e) => setTdsVoltage(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-cyan-neon font-bold focus:outline-none focus:border-cyan-neon"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Compensated at live temp {currentWaterTemp.toFixed(1)}°C</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-mono">Reference Standard Solution Batch / Brand</label>
              <input
                type="text"
                placeholder="e.g., Apera Instruments 1413 µS/cm Calibration Solution"
                value={tdsNotes}
                onChange={(e) => setTdsNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-xs text-white focus:outline-none focus:border-cyan-neon"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Calculating & Saving...' : 'Save TDS Calibration Coefficients'}</span>
            </button>
          </form>
        )}

        {/* Turbidity Sensor Form */}
        {activeSensor === 'turbidity' && (
          <form onSubmit={handleSaveTurbidity} className="space-y-6">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-neon">
                <Layers className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Turbidity Optical Calibration (2-Point NTU)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">SEN0189 Optical Sensor</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Optical turbidity probes output higher voltage in clean water and lower voltage in turbid water. Record voltage in distilled water (0 NTU) followed by a known Formazin reference standard.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {turbPoints.map((pt, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{pt.label}</span>
                    <button
                      type="button"
                      onClick={() => captureCurrentVoltage(setTurbPoints, idx)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-neon/10 hover:bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Capture Live Voltage</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-400 block mb-1">Standard NTU</label>
                      <input
                        type="number"
                        step="1"
                        value={pt.standard}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTurbPoints(prev => {
                            const copy = [...prev];
                            copy[idx].standard = val;
                            return copy;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-cyan-neon font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Measured Voltage (V)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={pt.voltage}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTurbPoints(prev => {
                            const copy = [...prev];
                            copy[idx].voltage = val;
                            return copy;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-cyan-neon focus:outline-none focus:border-cyan-neon font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-mono">Technician Notes / Standard Lot</label>
              <input
                type="text"
                placeholder="e.g., Formazin 100 NTU Standard Lot #8812"
                value={turbNotes}
                onChange={(e) => setTurbNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-xs text-white focus:outline-none focus:border-cyan-neon"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Calculating & Saving...' : 'Save Turbidity Calibration Coefficients'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
