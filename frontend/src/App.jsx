import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NotificationDrawer } from './components/NotificationDrawer';
import { HardwareSimulatorModal } from './components/HardwareSimulatorModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ZunoLogo } from './components/ZunoLogo';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { CameraAIPage } from './pages/CameraAIPage';
import { DiseaseMonitoringPage } from './pages/DiseaseMonitoringPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function AuthenticatedApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigateToPage={setActivePage} />;
      case 'digital-twin':
        return <DigitalTwinPage />;
      case 'monitoring':
        return <LiveMonitoringPage />;
      case 'camera-ai':
        return <CameraAIPage />;
      case 'disease':
        return <DiseaseMonitoringPage />;
      case 'calibration':
        return <CalibrationPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigateToPage={setActivePage} />;
    }
  };

  return (
    <SocketProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#050814] text-slate-100">
        {/* Collapsible Sidebar Navigation */}
        <Sidebar
          activePage={activePage}
          onSelectPage={setActivePage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main View Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header */}
          <Header 
            onToggleNotifications={() => setIsNotificationOpen(true)}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
          />

          {/* Dynamic Page Content with Scroll */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ErrorBoundary title="View Rendering Recovery">
              {renderPage()}
            </ErrorBoundary>
          </main>
        </div>

        {/* Notification Drawer Modal */}
        <NotificationDrawer 
          isOpen={isNotificationOpen} 
          onClose={() => setIsNotificationOpen(false)} 
        />

        {/* Hardware Simulation Bench Modal */}
        <HardwareSimulatorModal 
          isOpen={isSimulatorOpen} 
          onClose={() => setIsSimulatorOpen(false)} 
        />
      </div>
    </SocketProvider>
  );
}

function MainRoot() {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  // Loading Splash Screen
  if (isLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#050814] text-white">
        <ZunoLogo size="xl" showTagline={true} showVersion={true} className="animate-pulse" />
        <div className="mt-8 flex items-center gap-2 font-mono text-xs text-cyan-neon">
          <div className="w-3.5 h-3.5 border-2 border-cyan-neon border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Aquaculture Telemetry Node...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Users: Render Login or Registration
  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => setAuthView('register')} />;
  }

  // Authenticated Operators: Render Dashboard
  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainRoot />
    </AuthProvider>
  );
}
