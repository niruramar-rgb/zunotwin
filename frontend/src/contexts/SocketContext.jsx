import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [latestSensors, setLatestSensors] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState({
    hardwareConnected: false,
    deviceStatus: 'DISCONNECTED',
    portName: null,
    lastHeartbeat: 0,
    dataAgeSeconds: null,
    isStale: true,
    availablePorts: []
  });
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedTank, setSelectedTank] = useState('tank-01');
  const [aeratorCommandState, setAeratorCommandState] = useState({
    status: 'IDLE', // 'IDLE' | 'SENDING' | 'ACKNOWLEDGED' | 'FAILED' | 'TIMEOUT'
    lastCommand: null,
    timestamp: 0,
    error: null
  });

  // Initial data load
  const refreshData = useCallback(async () => {
    try {
      const [sensorRes, alertsRes, equipRes, hwRes] = await Promise.allSettled([
        api.getLatestSensors(selectedTank),
        api.getAlerts(selectedTank),
        api.getEquipment(selectedTank),
        api.getHardwareStatus()
      ]);

      if (sensorRes.status === 'fulfilled' && sensorRes.value.success) {
        setLatestSensors(sensorRes.value.data);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.success) {
        setActiveAlerts(alertsRes.value.data);
      }
      if (equipRes.status === 'fulfilled' && equipRes.value.success) {
        setEquipmentList(equipRes.value.data);
      }
      if (hwRes.status === 'fulfilled' && hwRes.value.success) {
        setHardwareStatus(hwRes.value.data);
      }
    } catch (e) {
      console.warn('[SocketProvider] Initial fetch notice:', e.message);
    }
  }, [selectedTank]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Send Aerator Command (ON / OFF) with clear state handling
  const sendAerator = async (targetState) => {
    setAeratorCommandState({
      status: 'SENDING',
      lastCommand: `AERATOR_${targetState}`,
      timestamp: Date.now(),
      error: null
    });

    try {
      const res = await api.sendAeratorDirect(targetState);
      if (res.success) {
        setAeratorCommandState({
          status: 'ACKNOWLEDGED',
          lastCommand: res.command,
          timestamp: res.timestamp || Date.now(),
          error: null
        });

        // Update local equipment state
        setEquipmentList(prev => prev.map(eq =>
          eq.deviceId === 'aerator_01'
            ? { ...eq, state: targetState, verified: Boolean(res.acknowledged), lastUpdated: Date.now() }
            : eq
        ));

        // Reset to IDLE after 3.5 seconds
        setTimeout(() => {
          setAeratorCommandState(s => (s.status === 'ACKNOWLEDGED' ? { ...s, status: 'IDLE' } : s));
        }, 3500);

        return res;
      } else {
        throw new Error(res.error || 'Command rejected by backend');
      }
    } catch (err) {
      setAeratorCommandState({
        status: 'FAILED',
        lastCommand: `AERATOR_${targetState}`,
        timestamp: Date.now(),
        error: err.message
      });
      throw err;
    }
  };

  // Switch or select COM port
  const selectPort = async (portPath) => {
    try {
      const res = await api.selectPort(portPath);
      await refreshData();
      return res;
    } catch (err) {
      console.error('[SocketProvider] Port selection failed:', err.message);
      throw err;
    }
  };

  // Socket.IO lifecycle
  useEffect(() => {
    const s = io(SOCKET_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000
    });

    s.on('connect', () => {
      console.log('[Socket.IO] Connected to backend real-time hub');
      setSocketConnected(true);
    });

    s.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from backend');
      setSocketConnected(false);
    });

    s.on('initial-state', (data) => {
      if (data.sensors) setLatestSensors(data.sensors);
      if (data.hardware) setHardwareStatus(data.hardware);
      if (data.alerts) setActiveAlerts(data.alerts);
      if (data.equipment) setEquipmentList(data.equipment);
    });

    s.on('sensor-reading', (payload) => {
      if (payload.cards) {
        setLatestSensors(payload.cards);
      }
      if (payload.deviceStatus) {
        setHardwareStatus(payload.deviceStatus);
      }
    });

    s.on('hardware-status', (status) => {
      setHardwareStatus(status);
    });

    s.on('alert-created', (newAlert) => {
      setActiveAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
    });

    s.on('alert-resolved', (info) => {
      setActiveAlerts((prev) => prev.filter((a) => !(a.tankId === info.tankId && a.parameter === info.parameter)));
    });

    s.on('equipment-status', (updatedEq) => {
      setEquipmentList((prev) =>
        prev.map((item) =>
          item.deviceId === updatedEq.device_id
            ? { ...item, state: updatedEq.state, mode: updatedEq.mode, lastUpdated: updatedEq.last_updated }
            : item
        )
      );
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        socketConnected,
        latestSensors,
        hardwareStatus,
        activeAlerts,
        setActiveAlerts,
        equipmentList,
        setEquipmentList,
        selectedTank,
        setSelectedTank,
        refreshData,
        sendAerator,
        aeratorCommandState,
        selectPort
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}
