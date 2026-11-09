import React from 'react';
import { HatcheryTank3D } from '../three/HatcheryTank3D';
import { useSocket } from '../contexts/SocketContext';
import { Box, Layers, Cpu, Activity, Droplets } from 'lucide-react';

export function DigitalTwinPage() {
  const { latestSensors, hardwareStatus, equipmentList } = useSocket();
  const isConnected = hardwareStatus?.hardwareConnected;
  const aerator = equipmentList.find(e => e.type === 'aerator');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Cyber-Physical 3D Digital Twin</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time WebGL tank simulation reflecting live physical sensors and actuator states
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
            isConnected ? 'bg-status-normal/10 border-status-normal/40 text-status-normal' : 'bg-status-critical/15 border-status-critical/40 text-status-critical'
          }`}>
            {isConnected ? 'LIVE 3D SYNCHRONIZED' : 'PHYSICAL HARDWARE DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Main 3D Stage */}
      <div className="h-[520px]">
        <HatcheryTank3D />
      </div>

      {/* Digital Twin Specifications & Multi-tank Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center gap-2 text-cyan-neon mb-2">
            <Box className="w-4 h-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Mesh Specifications</h4>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-300 font-mono">
            <li>• Geometry: Cylindrical High-Density Polyethylene / Acrylic</li>
            <li>• Diameter: 4.5 meters • Height: 1.8 meters</li>
            <li>• Water Capacity: 25,000 Liters</li>
            <li>• Bubble Physics: Eulerian Point Vector Advection</li>
          </ul>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center gap-2 text-cyan-neon mb-2">
            <Droplets className="w-4 h-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Shader Dynamics</h4>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-300 font-mono">
            <li>• Turbidity Shader: Real-time opacity & scatter shift</li>
            <li>• Aeration Wave Speed: {aerator?.state === 'ON' ? '1.8x (High Agitation)' : '0.8x (Passive Flow)'}</li>
            <li>• Critical Alert Tint: Automatic crimson transition</li>
          </ul>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-navy-700/80">
          <div className="flex items-center gap-2 text-cyan-neon mb-2">
            <Layers className="w-4 h-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Multi-Tank Topology</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tank 01 is currently monitored via ESP32 Node 001. Architecture is designed to instantiate Tanks 02–08 dynamically upon adding MQTT or Serial node configurations.
          </p>
        </div>
      </div>
    </div>
  );
}
