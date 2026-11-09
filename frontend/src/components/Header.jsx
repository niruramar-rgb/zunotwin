import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Bell, 
  User, 
  Clock, 
  Layers, 
  LogOut, 
  SlidersHorizontal,
  ChevronDown,
  Menu,
  Cpu,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { ZunoLogo } from './ZunoLogo';

export function Header({ 
  onToggleNotifications, 
  onOpenSimulator, 
  onToggleSidebar,
  sidebarCollapsed 
}) {
  const { 
    hardwareStatus, 
    latestSensors, 
    selectedTank, 
    setSelectedTank, 
    activeAlerts,
    selectPort,
    refreshData
  } = useSocket();
  const { user, logout } = useAuth();
  const [dataAge, setDataAge] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [portModalOpen, setPortModalOpen] = useState(false);
  const [isSwitchingPort, setIsSwitchingPort] = useState(false);

  // Compute live seconds elapsed since last telemetry reading
  useEffect(() => {
    const interval = setInterval(() => {
      if (latestSensors?.lastTimestamp && hardwareStatus?.hardwareConnected) {
        const sec = Math.max(0, Math.round((Date.now() - latestSensors.lastTimestamp) / 1000));
        setDataAge(sec);
      } else {
        setDataAge(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [latestSensors, hardwareStatus]);

  const isConnected = hardwareStatus?.hardwareConnected && !hardwareStatus?.isStale;
  const isStale = dataAge !== null && dataAge > 10;
  const unreadAlerts = activeAlerts.filter(a => !a.acknowledged).length;

  const handleSelectPort = async (portPath) => {
    setIsSwitchingPort(true);
    try {
      await selectPort(portPath);
      setPortModalOpen(false);
    } catch (e) {
      alert(`Port selection failed: ${e.message}`);
    } finally {
      setIsSwitchingPort(false);
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 glass-panel border-b border-navy-700/80 flex items-center justify-between z-30 sticky top-0 backdrop-blur-xl">
      {/* Left: Sidebar Toggle & Brand Logo */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl bg-navy-900/80 hover:bg-navy-850 text-slate-300 hover:text-cyan-neon border border-navy-700/80 transition-colors focus:outline-none"
          title="Toggle Navigation Sidebar"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <ZunoLogo size="sm" showVersion={true} showTagline={false} />

        {/* Tank Selector */}
        <div className="ml-4 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900/90 border border-navy-700/80">
          <Layers className="w-3.5 h-3.5 text-cyan-neon" />
          <span className="text-xs text-slate-400 font-medium">Tank:</span>
          <select 
            value={selectedTank} 
            onChange={(e) => setSelectedTank(e.target.value)}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            <option value="tank-01" className="bg-navy-900 text-white">Tank 01 — Larviculture Core</option>
            <option value="tank-02" className="bg-navy-900 text-slate-400" disabled>Tank 02 — (Future Rack)</option>
            <option value="tank-03" className="bg-navy-900 text-slate-400" disabled>Tank 03 — (Future Rack)</option>
          </select>
        </div>
      </div>

      {/* Right: Connectivity Status, Data Age, Alerts & Operator Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Hardware Status Button (Click to configure COM Port) */}
        <button
          onClick={() => setPortModalOpen(true)}
          title="Click to view or switch ESP32 USB COM Port"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all hover:scale-[1.02] cursor-pointer ${
            isConnected
              ? 'bg-status-normal/10 border-status-normal/40 text-status-normal shadow-[0_0_12px_rgba(0,230,118,0.2)]'
              : 'bg-status-critical/15 border-status-critical/50 text-status-critical shadow-[0_0_12px_rgba(255,23,68,0.2)]'
          }`}
        >
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-status-normal animate-pulse" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="font-bold">ESP32 ONLINE ({hardwareStatus?.portName || 'COM13'})</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-status-critical" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="font-bold">ESP32 OFFLINE</span>
            </>
          )}
        </button>

        {/* Data Freshness Timestamp */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {dataAge === null || !isConnected ? (
            <span className="text-slate-500 font-medium">No live stream</span>
          ) : isStale ? (
            <span className="text-status-warning font-semibold">Stale: {dataAge}s ago</span>
          ) : (
            <span className="text-slate-300">Updated {dataAge}s ago</span>
          )}
        </div>

        {/* Alerts Bell Drawer Button */}
        <button
          onClick={onToggleNotifications}
          className="relative p-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon border border-navy-700/80 transition-colors"
          title="Open Alerts Center"
          aria-label="Open Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-critical text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadAlerts}
            </span>
          )}
        </button>

        {/* Hardware Simulator Toggle */}
        <button
          onClick={onOpenSimulator}
          className="p-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 text-slate-400 hover:text-cyan-neon border border-navy-700/80 transition-colors hidden sm:flex"
          title="Hardware Simulator Bench"
          aria-label="Hardware Simulator"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* User Profile & Logout Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl bg-navy-900/90 hover:bg-navy-850 border border-navy-700 text-left transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-neon to-aquablue p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-navy-950 rounded-[6px] flex items-center justify-center text-cyan-neon">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-xs font-bold text-white truncate max-w-[100px]">
                {user?.fullName || 'Operator'}
              </div>
              <div className="text-[10px] text-cyan-neon font-mono uppercase tracking-wider">
                {user?.role || 'OPERATOR'}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* User Profile Flyout Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-navy-950 border border-navy-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-navy-800">
                <p className="text-xs font-bold text-white">{user?.fullName || 'Aquaculture Operator'}</p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email || 'operator@zunotwin.ai'}</p>
                <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-cyan-neon/15 text-cyan-neon text-[9px] font-mono font-semibold">
                  STATION OPERATOR
                </span>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-status-critical hover:bg-status-critical/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COM Port Selector Modal */}
      {portModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-navy-950 border border-navy-700 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-neon" />
                <h3 className="text-sm font-bold text-white">ESP32 Hardware COM Port Setup</h3>
              </div>
              <button
                onClick={() => setPortModalOpen(false)}
                className="p-1 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="text-xs text-slate-300">
                Current Active Port: <strong className="text-cyan-neon font-mono">{hardwareStatus?.portName || 'None'}</strong>
              </div>

              <div className="text-xs text-slate-400">
                Status: <span className={isConnected ? 'text-status-normal font-semibold' : 'text-status-critical font-semibold'}>
                  {isConnected ? 'ONLINE (115200 baud)' : 'OFFLINE / DISCONNECTED'}
                </span>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Detected Serial Ports:</span>
                  <button
                    onClick={refreshData}
                    className="flex items-center gap-1 text-[11px] text-cyan-neon hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {hardwareStatus?.availablePorts && hardwareStatus.availablePorts.length > 0 ? (
                    hardwareStatus.availablePorts.map((p) => {
                      const isCurrent = p.path === hardwareStatus.portName;
                      return (
                        <div
                          key={p.path}
                          onClick={() => handleSelectPort(p.path)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-cyan-neon/15 border-cyan-neon/50 text-white'
                              : 'bg-navy-900 hover:bg-navy-850 border-navy-700 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs">{p.path}</span>
                              {p.isEsp32 && (
                                <span className="px-1.5 py-0.2 rounded bg-cyan-neon/20 text-cyan-neon text-[9px] font-mono font-bold">
                                  ESP32 UART
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate max-w-[260px] mt-0.5">
                              {p.manufacturer || 'USB Serial Device'}
                            </p>
                          </div>

                          {isCurrent ? (
                            <Check className="w-4 h-4 text-cyan-neon" />
                          ) : (
                            <button
                              disabled={isSwitchingPort}
                              className="text-[11px] px-2 py-1 rounded bg-navy-800 hover:bg-navy-700 text-slate-300"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 text-xs text-slate-400 text-center">
                      No USB COM ports detected. Check USB cable connection.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-800 text-[11px] text-slate-400 space-y-1">
                <p>• <strong>Baud Rate:</strong> 115200</p>
                <p>• <strong>Telemetry:</strong> Real JSON & Structured blocks (~2s interval)</p>
                <p>• <strong>Ownership:</strong> Ensure Arduino Serial Monitor is closed</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-navy-800">
              <button
                onClick={() => setPortModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
