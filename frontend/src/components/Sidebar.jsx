import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Box, 
  Camera, 
  AlertTriangle, 
  Cpu, 
  Settings,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Sliders
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { ShrimpIcon } from './ShrimpIcon';
import { ZunoLogo } from './ZunoLogo';

export function Sidebar({ activePage, onSelectPage, collapsed, onToggleCollapse }) {
  const { activeAlerts } = useSocket();
  const { user, logout } = useAuth();
  const alertCount = activeAlerts.filter(a => !a.acknowledged).length;

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'digital-twin', label: 'Digital Twin', icon: Box },
    { id: 'monitoring', label: 'Water Quality', icon: Activity },
    { id: 'camera-ai', label: 'Live Camera', icon: Camera },
    { id: 'disease', label: 'Disease Monitoring', icon: ShieldAlert },
    { id: 'calibration', label: 'Calibration', icon: Sliders },
    { id: 'alerts', label: 'Alerts & Events', icon: AlertTriangle, badge: alertCount },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside className={`glass-panel border-r border-navy-700/80 flex flex-col justify-between py-5 z-20 shrink-0 transition-all duration-300 ${
      collapsed ? 'w-20 px-2.5' : 'w-64 px-4'
    }`}>
      <div>
        {/* Top Brand Area */}
        <div className={`pb-5 border-b border-navy-800 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {collapsed ? (
            <ZunoLogo size="sm" iconOnly={true} />
          ) : (
            <div className="flex items-center gap-2">
              <ZunoLogo size="sm" iconOnly={true} />
              <div>
                <span className="text-sm font-bold text-white tracking-wide">ZUNO TWIN</span>
                <p className="text-[10px] text-cyan-neon font-mono">Hatchery AIoT</p>
              </div>
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg bg-navy-900/80 hover:bg-navy-800 text-slate-400 hover:text-white border border-navy-700/80 transition-colors hidden lg:flex"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Items List */}
        <nav className="mt-5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-2xl text-xs font-semibold transition-all ${
                  collapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-neon/20 to-aquablue/10 text-white border border-cyan-neon/40 shadow-neon-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-neon' : 'text-slate-400'}`} />
                  {!collapsed && <span className="tracking-wide">{item.label}</span>}
                </div>

                {!collapsed && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-critical/20 border border-status-critical/40 text-status-critical font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Firmware Tag & Logout */}
      <div className="space-y-3 pt-4 border-t border-navy-800">
        {!collapsed && (
          <div className="p-3 rounded-2xl bg-navy-900/80 border border-navy-800 text-[11px] font-mono">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Firmware</span>
              <span className="text-cyan-neon">v1.2-ESP32</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-normal" />
              <span>115,200 Baud / UART</span>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center rounded-2xl text-xs font-semibold text-slate-400 hover:text-status-critical hover:bg-status-critical/10 border border-transparent transition-colors ${
            collapsed ? 'justify-center p-3' : 'justify-start gap-2.5 px-3.5 py-2.5'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
