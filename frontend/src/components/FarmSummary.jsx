import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Cpu, 
  Camera, 
  TrendingUp,
  BrainCircuit,
  Info
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export function FarmSummary() {
  const { latestSensors, hardwareStatus, equipmentList, activeAlerts } = useSocket();
  const isHardwareConnected = hardwareStatus?.hardwareConnected;
  const cards = latestSensors?.cards || {};

  // Compute real water quality index based on valid sensor readings
  let validCount = 0;
  let criticalCount = 0;
  let warningCount = 0;

  Object.values(cards).forEach(c => {
    if (c.value !== null && c.status !== 'UNAVAILABLE') {
      validCount++;
      if (c.status === 'CRITICAL') criticalCount++;
      else if (c.status === 'WARNING') warningCount++;
    }
  });

  let waterQualityScore = null;
  let overallCondition = 'UNAVAILABLE';
  if (isHardwareConnected && validCount > 0) {
    waterQualityScore = Math.max(0, 100 - (criticalCount * 30 + warningCount * 12));
    overallCondition = criticalCount > 0 ? 'CRITICAL RISK' : (warningCount > 0 ? 'WARNING ADVISORY' : 'OPTIMAL CONDITIONS');
  }

  const activeEquipCount = equipmentList.filter(e => e.state === 'ON').length;
  const pendingAlertCount = activeAlerts.filter(a => !a.acknowledged).length;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-navy-700/80">
      <div className="flex items-center justify-between pb-3 border-b border-navy-800 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-neon" />
          <h3 className="text-sm font-bold text-white tracking-wide">Hatchery Biomass & Farm Health Summary</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Post-Larvae PL12 Stage</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1: Water Quality Index */}
        <div className="p-3.5 rounded-xl bg-navy-900/90 border border-navy-700/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Water Quality Index</span>
            <ShieldCheck className="w-4 h-4 text-cyan-neon" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {waterQualityScore !== null ? `${waterQualityScore}%` : 'Not Available'}
          </div>
          <p className={`text-[10px] font-semibold mt-1 ${
            criticalCount > 0 ? 'text-status-critical' : (warningCount > 0 ? 'text-status-warning' : 'text-status-normal')
          }`}>
            {overallCondition}
          </p>
        </div>

        {/* Metric 2: Active Bio-Alerts */}
        <div className="p-3.5 rounded-xl bg-navy-900/90 border border-navy-700/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Active Alerts</span>
            <AlertTriangle className="w-4 h-4 text-status-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {pendingAlertCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {pendingAlertCount === 0 ? 'All parameters nominal' : 'Action required'}
          </p>
        </div>

        {/* Metric 3: Equipment Automation */}
        <div className="p-3.5 rounded-xl bg-navy-900/90 border border-navy-700/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Equipment Active</span>
            <Cpu className="w-4 h-4 text-aquablue" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {isHardwareConnected ? `${activeEquipCount} / ${equipmentList.length}` : 'Offline'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">
            {isHardwareConnected ? 'Auto-failover active' : 'Relays disconnected'}
          </p>
        </div>

        {/* Metric 4: AI Disease Risk Prediction */}
        <div className="p-3.5 rounded-xl bg-navy-900/90 border border-navy-700/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">AI Disease Model</span>
            <BrainCircuit className="w-4 h-4 text-cyan-neon" />
          </div>
          <div className="text-sm font-bold font-mono text-cyan-neon mt-1 truncate" title="In Development">
            In Development
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate" title="Requires histopathology labelled dataset">
            Awaiting farm histopathology data
          </p>
        </div>
      </div>
    </div>
  );
}
