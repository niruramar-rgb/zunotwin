import React, { useState } from 'react';
import { 
  Power, 
  Cpu, 
  RotateCw, 
  Flame, 
  Filter, 
  Utensils, 
  Wind,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';

export function EquipmentPanel() {
  const { 
    equipmentList, 
    setEquipmentList, 
    hardwareStatus, 
    selectedTank,
    sendAerator,
    aeratorCommandState
  } = useSocket();
  const [loadingDevice, setLoadingDevice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const isHardwareConnected = hardwareStatus?.hardwareConnected && !hardwareStatus?.isStale;

  const getEquipmentIcon = (type) => {
    switch (type) {
      case 'aerator': return Wind;
      case 'water_pump': return RotateCw;
      case 'heater': return Flame;
      case 'filter': return Filter;
      case 'feeder': return Utensils;
      default: return Cpu;
    }
  };

  const handleToggleState = async (deviceId, currentState) => {
    setActionError(null);
    const targetState = currentState === 'ON' ? 'OFF' : 'ON';
    setLoadingDevice(deviceId);

    try {
      if (deviceId === 'aerator_01') {
        // Direct ESP32 aerator command pathway
        await sendAerator(targetState);
      } else {
        const res = await api.sendEquipmentCommand(deviceId, targetState);
        if (res.success) {
          setEquipmentList(prev => prev.map(eq => 
            eq.deviceId === deviceId ? { ...eq, state: targetState, verified: res.verified } : eq
          ));
        }
      }
    } catch (err) {
      setActionError(`Command failed: ${err.message}`);
    } finally {
      setLoadingDevice(null);
    }
  };

  const handleToggleMode = async (deviceId, currentMode) => {
    const targetMode = currentMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    try {
      const res = await api.setEquipmentMode(deviceId, targetMode);
      if (res.success) {
        setEquipmentList(prev => prev.map(eq => 
          eq.deviceId === deviceId ? { ...eq, mode: targetMode } : eq
        ));
      }
    } catch (err) {
      setActionError(`Failed to set mode: ${err.message}`);
    }
  };

  const handleEmergencyStop = async () => {
    if (!window.confirm('EMERGENCY STOP: Immediately halt all active actuators and turn OFF physical aerator relay?')) {
      return;
    }

    try {
      if (isHardwareConnected) {
        await sendAerator('OFF');
      }
      const res = await api.emergencyStop(selectedTank);
      if (res.success) {
        setEquipmentList(prev => prev.map(eq => ({ ...eq, state: 'OFF' })));
      }
    } catch (err) {
      setActionError(`Emergency Stop failed: ${err.message}`);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-navy-700/80 flex flex-col justify-between">
      {/* Title Bar & Emergency Stop */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-neon" />
            <h3 className="text-sm font-bold text-white tracking-wide">Actuator Control & Relay Telemetry</h3>
          </div>

          <button
            onClick={handleEmergencyStop}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-status-critical/15 hover:bg-status-critical/25 border border-status-critical/40 text-status-critical text-xs font-bold transition-all shadow-sm hover:shadow-neon-red"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>E-STOP</span>
          </button>
        </div>

        {/* Error / Alert banner */}
        {actionError && (
          <div className="mt-2.5 p-2 rounded-xl bg-status-critical/15 border border-status-critical/40 text-[11px] text-status-critical flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-white hover:underline text-[10px] ml-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Equipment List Grid */}
        <div className="my-3 space-y-2.5">
          {equipmentList.map((device) => {
            const Icon = getEquipmentIcon(device.type);
            const isAerator = device.deviceId === 'aerator_01';
            const isOn = device.state === 'ON';
            const isUnknown = device.state === 'UNKNOWN' || !isHardwareConnected;
            const isLoading = loadingDevice === device.deviceId || (isAerator && aeratorCommandState.status === 'SENDING');

            // Acknowledgement pill for aerator
            let ackBadge = null;
            if (isAerator) {
              if (aeratorCommandState.status === 'SENDING') {
                ackBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono animate-pulse flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>Transmitting...</span>
                  </span>
                );
              } else if (aeratorCommandState.status === 'ACKNOWLEDGED') {
                ackBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-status-normal/15 text-status-normal border border-status-normal/30 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>ESP32 ACK</span>
                  </span>
                );
              } else if (aeratorCommandState.status === 'FAILED') {
                ackBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-status-critical/15 text-status-critical border border-status-critical/30 font-mono flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Command Failed</span>
                  </span>
                );
              }
            }

            return (
              <div
                key={device.deviceId}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isOn 
                    ? 'bg-navy-900/90 border-cyan-neon/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]' 
                    : 'bg-navy-950/60 border-navy-800/80 hover:border-navy-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    isOn 
                      ? 'bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon' 
                      : 'bg-navy-900 border-navy-700 text-slate-500'
                  }`}>
                    <Icon className={`w-4 h-4 ${isOn ? 'animate-pulse' : ''}`} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{device.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono font-medium ${
                        device.mode === 'AUTO' 
                          ? 'bg-aquablue/15 text-aquablue border-aquablue/30' 
                          : 'bg-navy-800 text-slate-300 border-navy-700'
                      }`}>
                        {device.mode}
                      </span>
                      {ackBadge}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">
                        Relay: <strong className={isOn ? 'text-status-normal' : (isUnknown ? 'text-slate-500' : 'text-slate-400')}>
                          {isUnknown ? 'OFFLINE' : (isOn ? 'ENERGIZED (ON)' : 'DE-ENERGIZED (OFF)')}
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="text-[10px] text-slate-500">
                        {isAerator ? 'ESP32 GPIO 15' : (device.verified ? 'Hardware Verified' : 'Auxiliary Pump')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Controls: Mode Switch & Toggle Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleMode(device.deviceId, device.mode)}
                    className="px-2 py-1 rounded bg-navy-900 hover:bg-navy-800 border border-navy-700 text-[11px] font-mono text-slate-300 hover:text-white"
                    title="Toggle AUTO/MANUAL mode"
                  >
                    {device.mode}
                  </button>

                  <button
                    onClick={() => handleToggleState(device.deviceId, device.state)}
                    disabled={isLoading || !isHardwareConnected}
                    title={!isHardwareConnected ? 'Hardware is OFFLINE: Controls disabled for safety' : 'Toggle power'}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all ${
                      isOn
                        ? 'bg-status-critical/15 hover:bg-status-critical/25 border-status-critical/40 text-status-critical'
                        : 'bg-status-normal/15 hover:bg-status-normal/25 border-status-normal/40 text-status-normal'
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isLoading ? '...' : (isOn ? 'STOP' : 'START')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Notice & Motor Wire Isolation Alert */}
      <div className="pt-2.5 border-t border-navy-800/80 space-y-1.5">
        <div className="flex items-start gap-1.5 text-[10px] text-amber-400/90 font-mono">
          <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
          <span>
            <strong>Safety Isolation Notice:</strong> Motor wire is disconnected from metal terminal for hardware verification. Relay triggers safely without high-voltage motor energization.
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Relay: GPIO 15 (Active LOW)</span>
          <span>Commands: AERATOR_ON / AERATOR_OFF</span>
        </div>
      </div>
    </div>
  );
}
