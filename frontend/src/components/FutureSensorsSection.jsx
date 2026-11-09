import React from 'react';
import { Cpu, Layers } from 'lucide-react';

export function FutureSensorsSection() {
  const futureSensors = [
    {
      key: 'salinity',
      name: 'Salinity',
      unit: 'ppt',
      plannedProbe: 'Industrial RS485 Modbus Toroidal Conductivity Probe',
      integrationStage: 'Hardware Integration Pending (Phase 2)',
      description: 'Pending installation of high-salinity inductive sensor to prevent electrode polarization in brackish conditions.'
    },
    {
      key: 'alkalinity',
      name: 'Total Alkalinity',
      unit: 'mg/L CaCO3',
      plannedProbe: 'Automated Photometric Micro-Titration Cartridge',
      integrationStage: 'Hardware Integration Pending (Phase 2)',
      description: 'Pending optical buffering reagent analyzer for monitoring carbonate equilibrium and pH stability.'
    },
    {
      key: 'ammonia',
      name: 'Total Ammonia Nitrogen (TAN / NH3)',
      unit: 'mg/L',
      plannedProbe: 'Potentiometric Ion Selective Electrode (ISE)',
      integrationStage: 'Hardware Integration Pending (Phase 2)',
      description: 'Pending un-ionized toxic ammonia ion sensor with automatic temperature/pH dissociation compensation.'
    }
  ];

  return (
    <div className="p-5 rounded-3xl bg-navy-950/60 border border-navy-800/80 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-navy-800/80 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-navy-900 border border-navy-700 flex items-center justify-center text-slate-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 tracking-wide">
              Sensor Expansion (Coming Next)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Unconfigured physical probe categories reserved for Phase 2 hardware integration.
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-navy-900/80 border border-navy-700 text-[11px] font-mono text-slate-400 self-start sm:self-auto">
          3 Probes Pending Hardware
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {futureSensors.map((sensor) => (
          <div
            key={sensor.key}
            className="p-4 rounded-2xl bg-navy-900/40 border border-dashed border-navy-700/60 text-slate-400 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  {sensor.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-navy-950 border border-navy-700 text-slate-400">
                  Not Configured
                </span>
              </div>

              {/* Disabled Value Display */}
              <div className="my-3 py-3 rounded-xl bg-navy-950/40 border border-navy-800/50 text-center">
                <div className="text-2xl font-mono font-bold text-slate-600 tracking-widest">
                  — —
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Target Unit: {sensor.unit}
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                {sensor.description}
              </p>
            </div>

            {/* Hardware Status Tag */}
            <div className="pt-3 border-t border-navy-800/60 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate" title={sensor.plannedProbe}>
                {sensor.plannedProbe}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
