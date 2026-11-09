import React from 'react';
import { SensorCards } from '../components/SensorCards';
import { HatcheryTank3D } from '../three/HatcheryTank3D';
import { WaterQualityTrends } from '../charts/WaterQualityTrends';
import { CameraAIPanel } from '../components/CameraAIPanel';
import { AlertsPanel } from '../components/AlertsPanel';
import { EquipmentPanel } from '../components/EquipmentPanel';
import { FutureSensorsSection } from '../components/FutureSensorsSection';

export function DashboardPage({ onNavigateToPage }) {
  return (
    <div className="space-y-6">
      {/* 1. Four Configured Physical Sensors Header Row */}
      <section>
        <SensorCards />
      </section>

      {/* 2. Main Central Focus: 3D Cyber-Physical Digital Twin + Telemetry Trends */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-7">
          <HatcheryTank3D />
        </div>
        <div className="xl:col-span-5 flex flex-col">
          <WaterQualityTrends />
        </div>
      </section>

      {/* 3. Secondary Operational Grid: Live Camera, Active Alerts & Equipment */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CameraAIPanel onOpenDiseaseView={() => onNavigateToPage && onNavigateToPage('disease')} />
        <AlertsPanel />
        <EquipmentPanel />
      </section>

      {/* 4. Future Sensors Expansion (Phase 2 Probes - Clearly Separated) */}
      <section>
        <FutureSensorsSection />
      </section>
    </div>
  );
}
