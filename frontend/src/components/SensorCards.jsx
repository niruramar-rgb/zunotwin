import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
  Clock, 
  WifiOff,
  Activity,
  Info,
  Sliders,
  ShieldCheck,
  ZapOff
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';

/**
 * Embedded SVG Sparkline Graph using real stored readings from SQLite
 */
function Sparkline({ data, param, color = '#00F2FE', height = 36, width = 120 }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-9 w-full flex items-center justify-center text-[10px] text-slate-500 font-mono">
        No Historical Data
      </div>
    );
  }

  const values = data.map(d => d[param]).filter(v => v !== null && v !== undefined && !isNaN(v));
  if (values.length < 2) {
    return (
      <div className="h-9 w-full flex items-center justify-center text-[10px] text-slate-500 font-mono">
        Telemetry Buffering
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 4;
  const graphHeight = height - padding * 2;
  const graphWidth = width;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * graphWidth;
    const y = height - padding - ((val - min) / range) * graphHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const firstX = 0;
  const lastX = graphWidth;
  const bottomY = height;
  const areaPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;

  return (
    <svg viewBox={`0 0 ${graphWidth} ${height}`} className="w-full h-9 overflow-visible">
      <defs>
        <linearGradient id={`grad-${param}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${param})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function SensorCards() {
  const { latestSensors, hardwareStatus, selectedTank } = useSocket();
  const [historyData, setHistoryData] = useState([]);
  const [dataAge, setDataAge] = useState(null);

  const cards = latestSensors?.cards || {};
  const rawData = latestSensors?.rawTelemetry || {};
  const isHardwareConnected = hardwareStatus?.hardwareConnected && !hardwareStatus?.isStale;

  // Sensor definitions: 2 Calibrated Sensors + 4 Uncalibrated Real Probes
  const realSensors = [
    {
      key: 'temperature',
      label: 'Water Temperature',
      calibrated: true,
      unit: '°C',
      probe: 'DS18B20 OneWire (GPIO 23)',
      decimals: 1,
      accentColor: '#38BDF8',
      historyKey: 'temperature'
    },
    {
      key: 'humidity',
      label: 'Ambient Air Humidity',
      calibrated: true,
      unit: '%',
      probe: 'DHT11 Sensor (GPIO 4)',
      decimals: 1,
      accentColor: '#00F2FE',
      historyKey: 'humidity'
    },
    {
      key: 'ph',
      label: 'pH Probe (Raw ADC)',
      calibrated: false,
      unit: 'ADC',
      probe: 'Analog pH Module (GPIO 32)',
      rawAdcKey: 'ph_raw_adc',
      voltageKey: 'ph_voltage',
      accentColor: '#00D2BA'
    },
    {
      key: 'turbidity',
      label: 'Turbidity Sensor (Raw ADC)',
      calibrated: false,
      unit: 'ADC',
      probe: 'Optical Sensor (GPIO 35)',
      rawAdcKey: 'turbidity_raw_adc',
      voltageKey: 'turbidity_voltage',
      accentColor: '#F59E0B'
    },
    {
      key: 'tds',
      label: 'TDS Sensor (Raw ADC)',
      calibrated: false,
      unit: 'ADC',
      probe: 'Analog TDS Meter (GPIO 34)',
      rawAdcKey: 'tds_raw_adc',
      voltageKey: 'tds_voltage',
      accentColor: '#3B82F6'
    },
    {
      key: 'dissolved_oxygen',
      label: 'Dissolved Oxygen (Raw ADC)',
      calibrated: false,
      unit: 'ADC',
      probe: 'Galvanic DO Sensor (GPIO 33)',
      rawAdcKey: 'do_raw_adc',
      voltageKey: 'do_voltage',
      accentColor: '#10B981'
    }
  ];

  // Fetch real stored historical points from SQLite for sparklines
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        const res = await api.getSensorHistory(selectedTank || 'tank-01', '12h');
        if (isMounted && res.success && res.data?.data) {
          setHistoryData(res.data.data);
        }
      } catch (_) {}
    }
    loadHistory();
    const interval = setInterval(loadHistory, 15000); // Refresh sparkline every 15s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedTank]);

  // Compute live seconds elapsed since last reading
  useEffect(() => {
    const timer = setInterval(() => {
      if (latestSensors?.lastTimestamp && isHardwareConnected) {
        const sec = Math.max(0, Math.round((Date.now() - latestSensors.lastTimestamp) / 1000));
        setDataAge(sec);
      } else {
        setDataAge(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [latestSensors, isHardwareConnected]);

  return (
    <div className="space-y-4">
      {/* 6 Real Sensor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {realSensors.map((def) => {
          const card = cards[def.key] || {};
          const isStale = dataAge !== null && dataAge > 10;
          const isLive = isHardwareConnected && !isStale;

          // Determine values
          let displayVal = null;
          let subText = null;
          let statusText = 'OFFLINE';
          let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
          let borderClass = 'border-navy-700/80';
          let statusIcon = <WifiOff className="w-3 h-3" />;

          if (!isLive) {
            statusText = isStale ? `STALE (${dataAge}s)` : 'OFFLINE';
            badgeClass = isStale 
              ? 'bg-status-warning/15 text-status-warning border-status-warning/30' 
              : 'bg-status-critical/15 text-status-critical border-status-critical/30';
            borderClass = isStale ? 'border-status-warning/40' : 'border-status-critical/30';
            statusIcon = isStale ? <Clock className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />;
          } else if (card.calibrated && card.value !== null && card.value !== undefined) {
            // Calibrated sensor (either native DS18B20/DHT11 or actively calibrated probe via Lab)
            const val = card.value;
            displayVal = `${val.toFixed(def.decimals)} ${card.unit || def.unit}`;
            borderClass = 'border-navy-700/80 hover:border-cyan-neon/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]';

            if (card.status === 'CRITICAL') {
              statusText = 'CRITICAL';
              badgeClass = 'bg-status-critical/20 text-status-critical border-status-critical/50';
              borderClass = 'border-status-critical/60 animate-pulse';
              statusIcon = <AlertCircle className="w-3 h-3" />;
            } else if (card.status === 'WARNING') {
              statusText = 'WARNING';
              badgeClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
              borderClass = 'border-status-warning/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]';
              statusIcon = <AlertTriangle className="w-3 h-3" />;
            } else {
              statusText = card.calibrationProfile?.isCalibrated ? 'CALIBRATED' : 'OPTIMAL';
              badgeClass = 'bg-status-normal/15 text-status-normal border-status-normal/40';
              borderClass = 'border-navy-700/80 hover:border-cyan-neon/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]';
              statusIcon = <CheckCircle2 className="w-3 h-3" />;
            }

            const rawVoltStr = card.voltage !== null && card.voltage !== undefined ? ` • ${card.voltage}V` : '';
            subText = card.acceptableMin !== undefined 
              ? `Safe: ${card.acceptableMin} – ${card.acceptableMax} ${card.unit || def.unit}`
              : `Calibrated${rawVoltStr}`;
          } else {
            // Uncalibrated raw sensor (pH, Turbidity, TDS, DO without calibration profile)
            // Displays Raw ADC and Voltage
            const rawAdc = card.rawADC !== undefined ? card.rawADC : rawData[def.rawAdcKey];
            const voltage = card.voltage !== undefined ? card.voltage : rawData[def.voltageKey];

            if (rawAdc !== null && rawAdc !== undefined) {
              displayVal = `${rawAdc}`;
              subText = voltage !== null ? `${voltage.toFixed(3)} V` : 'Signal active';

              if (rawAdc === 0) {
                statusText = 'OPEN CKT (0V)';
                badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
                borderClass = 'border-navy-700';
                statusIcon = <ZapOff className="w-3 h-3" />;
              } else if (rawAdc > 4050) {
                statusText = 'RAIL HIGH';
                badgeClass = 'bg-status-warning/15 text-status-warning border-status-warning/30';
                borderClass = 'border-status-warning/30';
                statusIcon = <AlertTriangle className="w-3 h-3" />;
              } else {
                statusText = 'RAW ADC LIVE';
                badgeClass = 'bg-cyan-neon/15 text-cyan-neon border-cyan-neon/30';
                borderClass = 'border-navy-700/80 hover:border-cyan-neon/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]';
                statusIcon = <Activity className="w-3 h-3" />;
              }
            } else {
              statusText = 'WAITING';
              badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
              subText = 'No ADC frame';
              statusIcon = <Clock className="w-3 h-3" />;
            }
          }

          return (
            <div
              key={def.key}
              className={`p-3.5 rounded-2xl glass-panel transition-all duration-200 flex flex-col justify-between ${borderClass}`}
            >
              <div>
                {/* Header: Label & Status Badge */}
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 truncate max-w-[120px]" title={def.label}>
                      {def.label}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]" title={def.probe}>
                      {def.probe}
                    </p>
                  </div>

                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border shrink-0 ${badgeClass}`}>
                    {statusIcon}
                    <span>{statusText}</span>
                  </div>
                </div>

                {/* Primary Reading Display */}
                <div className="my-2.5 text-center">
                  {isLive && displayVal !== null ? (
                    <div>
                      <div className="text-2xl font-extrabold tracking-tight text-white font-mono">
                        {displayVal}
                      </div>
                      <div className="text-[11px] font-mono text-cyan-neon/90 font-semibold mt-0.5">
                        {subText}
                      </div>
                    </div>
                  ) : (
                    <div className="py-1">
                      <div className="text-lg font-mono font-bold text-slate-500 tracking-wider">
                        {isLive ? 'WAITING' : 'OFFLINE'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isLive ? 'Reading telemetry' : 'Hardware Disconnected'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Calibration & Science Status Tag */}
                <div className="p-1.5 rounded-lg bg-navy-950/70 border border-navy-800/80 text-[10px] font-mono flex items-center justify-between">
                  <span className="text-slate-400">Class:</span>
                  <span className={def.calibrated ? 'text-status-normal font-semibold' : 'text-amber-400 font-semibold'}>
                    {def.calibrated ? 'CALIBRATED' : 'UNCALIBRATED'}
                  </span>
                </div>
              </div>

              {/* Card Footer: Telemetry Freshness */}
              <div className="mt-2.5 pt-2 border-t border-navy-800/70 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                  <span>
                    {isLive && dataAge !== null ? `${dataAge}s ago` : 'Stale/Offline'}
                  </span>
                </span>
                <span className="text-slate-400 font-medium">
                  {def.calibrated ? 'Physical SI' : 'Raw Millivolts'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scientific Calibration & Thresholds Documentation Bar */}
      <div className="px-4 py-2.5 rounded-2xl bg-navy-950/60 border border-navy-800/80 text-xs text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-neon shrink-0" />
          <span>
            <strong>Hardware Calibration Notice:</strong> DS18B20 water temperature and DHT11 ambient humidity provide calibrated physical SI units. pH, Dissolved Oxygen, TDS, and Turbidity are raw ADC readings (0–4095, 0–3.3V) pending physical chemical buffer titration.
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1 text-status-normal">
            <span className="w-2 h-2 rounded-full bg-status-normal" />
            <span>Temp Safe: 24.0–32.0°C</span>
          </span>
          <span className="text-slate-400">•</span>
          <span>115200 Baud Live Telemetry</span>
        </div>
      </div>
    </div>
  );
}
