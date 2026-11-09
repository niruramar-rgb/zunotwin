import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Clock, Filter, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export function WaterQualityTrends() {
  const { selectedTank } = useSocket();
  const [period, setPeriod] = useState('24h');
  const [activeParam, setActiveParam] = useState('ph');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  const parameterConfigs = {
    ph: { label: 'pH Level', unit: 'pH', color: '#00F2FE', domain: [6.5, 9.5], decimals: 2 },
    temperature: { label: 'Water Temp', unit: '°C', color: '#38BDF8', domain: [20, 36], decimals: 1 },
    turbidity: { label: 'Turbidity', unit: 'NTU', color: '#00D2BA', domain: [0, 80], decimals: 1 },
    tds: { label: 'TDS (ppm)', unit: 'ppm', color: '#0072FF', domain: [800, 3000], decimals: 0 }
  };

  const currentCfg = parameterConfigs[activeParam] || parameterConfigs.ph;

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      setLoading(true);
      try {
        const res = await api.getSensorHistory(selectedTank, period);
        if (isMounted && res.success && res.data) {
          // Format points for recharts
          const formatted = res.data.data.map(pt => ({
            timestamp: pt.timestamp,
            timeLabel: new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateLabel: new Date(pt.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            val: pt[activeParam] !== null && pt[activeParam] !== undefined ? Number(pt[activeParam].toFixed(currentCfg.decimals)) : null
          }));
          setHistoryData(formatted);
        }
      } catch (err) {
        console.warn('[WaterQualityTrends] Error loading history:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistory();
    return () => { isMounted = false; };
  }, [selectedTank, period, activeParam]);

  const periods = ['1h', '6h', '12h', '24h', '7d'];

  return (
    <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 flex flex-col justify-between">
      {/* Header Controls: Parameter selector & Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentCfg.color }}></span>
            <span>Historical Telemetry Trends</span>
            <span className="text-xs font-normal text-slate-400">({currentCfg.label})</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Real persisted sensor readings ({historyData.length} samples loaded)
          </p>
        </div>

        {/* Time Period Filter Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-navy-900 border border-navy-700/80">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                period === p
                  ? 'bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Parameter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {Object.entries(parameterConfigs).map(([k, cfg]) => (
          <button
            key={k}
            onClick={() => setActiveParam(k)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeParam === k
                ? 'bg-navy-800 text-white border border-slate-500 shadow-sm'
                : 'bg-navy-900/60 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 w-full">
        {historyData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${activeParam}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentCfg.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={currentCfg.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#16234D" opacity={0.6} />
              
              <XAxis 
                dataKey="timeLabel" 
                stroke="#607D8B" 
                fontSize={11} 
                tickLine={false}
              />
              
              <YAxis 
                domain={currentCfg.domain} 
                stroke="#607D8B" 
                fontSize={11} 
                tickLine={false}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-2.5 rounded-xl bg-navy-950/95 border border-navy-700 shadow-xl text-xs font-mono">
                        <p className="text-slate-400 text-[10px]">{data.dateLabel} • {data.timeLabel}</p>
                        <p className="font-bold text-white text-sm mt-0.5" style={{ color: currentCfg.color }}>
                          {data.val !== null ? `${data.val} ${currentCfg.unit}` : 'Missing Interval'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="val"
                stroke={currentCfg.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${activeParam})`}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            {loading ? 'Loading historical data...' : 'No historical data recorded for this period.'}
          </div>
        )}
      </div>
    </div>
  );
}
