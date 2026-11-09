const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('zuno_token');

  const headers = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody.error || errBody.message || `HTTP ${res.status} on ${endpoint}`;
      
      // Handle expired session or unauthorized access
      if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/register')) {
        localStorage.removeItem('zuno_token');
        localStorage.removeItem('zuno_user');
        window.dispatchEvent(new CustomEvent('zuno-unauthorized'));
      }

      throw new Error(message);
    }

    return await res.json();
  } catch (err) {
    if (!endpoint.includes('/status')) {
      console.warn(`[API] Error on ${endpoint}:`, err.message);
    }
    throw err;
  }
}

export const api = {
  // Authentication Endpoints
  async login(email, password) {
    return request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  },

  async register(fullName, email, password, confirmPassword) {
    return request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, confirmPassword })
    });
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('zuno_token');
    localStorage.removeItem('zuno_user');
  },

  async getMe() {
    return request('/api/auth/me');
  },

  // Sensors & Telemetry
  async getLatestSensors(tankId = 'tank-01') {
    return request(`/api/sensors/latest?tankId=${tankId}`);
  },

  async getLatestTelemetry(tankId = 'tank-01') {
    return request(`/api/telemetry/latest?tankId=${tankId}`);
  },

  async getSensorHistory(tankId = 'tank-01', period = '24h') {
    return request(`/api/sensors/history?tankId=${tankId}&period=${period}`);
  },

  async getHardwareStatus() {
    return request('/api/device/status');
  },

  async getAvailablePorts() {
    return request('/api/device/ports');
  },

  async selectPort(port) {
    return request('/api/device/port', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port })
    });
  },

  async sendAeratorDirect(state) {
    return request('/api/aerator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
  },

  async simulateTelemetry(mode = 'nominal', values = {}) {
    return request('/api/sensors/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, values })
    });
  },

  // Alerts
  async getAlerts(tankId = null, showAll = false) {
    const q = new URLSearchParams();
    if (tankId) q.append('tankId', tankId);
    if (showAll) q.append('all', 'true');
    return request(`/api/alerts?${q.toString()}`);
  },

  async acknowledgeAlert(alertId) {
    return request(`/api/alerts/${alertId}/ack`, { method: 'POST' });
  },

  async acknowledgeAllAlerts(tankId = null) {
    return request('/api/alerts/ack-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tankId })
    });
  },

  // Equipment & Actuators
  async getEquipment(tankId = null) {
    const q = tankId ? `?tankId=${tankId}` : '';
    return request(`/api/equipment${q}`);
  },

  async sendEquipmentCommand(deviceId, state) {
    return request(`/api/equipment/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, source: 'UI_DASHBOARD' })
    });
  },

  async setEquipmentMode(deviceId, mode) {
    return request(`/api/equipment/${deviceId}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
  },

  async emergencyStop(tankId = null) {
    return request('/api/equipment/emergency-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tankId })
    });
  },

  // Digital Twin
  async getDigitalTwinState(tankId = 'tank-01') {
    return request(`/api/digital-twin/state?tankId=${tankId}`);
  },

  // AI & Models
  async getModelsStatus() {
    return request('/api/models/status');
  },

  async predictRisk(features = null) {
    return request('/api/models/predict-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features || {})
    });
  },

  async getShapExplanation() {
    return request('/api/models/explain');
  },

  // Camera & Disease Monitoring
  async getCameraStatus() {
    return request('/api/camera/status');
  },

  async getCameraRecords() {
    return request('/api/camera/records');
  },

  async uploadCameraFrame(file) {
    const formData = new FormData();
    formData.append('frame', file);
    return request('/api/camera/upload', {
      method: 'POST',
      body: formData
    });
  },

  async updateCameraReview(recordId, status, notes = '') {
    return request(`/api/camera/review/${recordId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
  },

  async triggerGroupAlert(distinctShrimp, evidenceFilenames = [], tankId = 'tank-01') {
    return request('/api/camera/group-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distinctShrimp, evidenceFilenames, tankId })
    });
  },

  async setCameraStreamConfig(streamType, streamUrl = '') {
    return request('/api/camera/stream-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamType, streamUrl })
    });
  },

  // Reports
  async getWaterQualityReport(tankId = 'tank-01', hours = 24) {
    return request(`/api/reports/water-quality?tankId=${tankId}&hours=${hours}`);
  },

  getCsvExportUrl(tankId = 'tank-01', hours = 24) {
    return `${API_BASE}/api/reports/export-csv?tankId=${tankId}&hours=${hours}`;
  },

  // Sensor Calibration
  async getCalibrations() {
    return request('/api/calibration');
  },

  async getCalibration(sensorKey) {
    return request(`/api/calibration/${sensorKey}`);
  },

  async calibratePH(points, user = 'Operator', notes = '') {
    return request('/api/calibration/ph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, user, notes })
    });
  },

  async calibrateTDS(standardPpm, voltage, waterTempC = 25.0, user = 'Operator', notes = '') {
    return request('/api/calibration/tds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standardPpm, voltage, waterTempC, user, notes })
    });
  },

  async calibrateTurbidity(points, user = 'Operator', notes = '') {
    return request('/api/calibration/turbidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, user, notes })
    });
  },

  async resetCalibration(sensorKey) {
    return request(`/api/calibration/${sensorKey}`, {
      method: 'DELETE'
    });
  },

  // AI Shrimp Disease Detection
  async getDiseaseStatus() {
    return request('/api/disease/status');
  },

  async getDiseaseHistory(limit = 20) {
    return request(`/api/disease/history?limit=${limit}`);
  },

  async analyzeDiseaseImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    return request('/api/disease/analyze', {
      method: 'POST',
      body: formData
    });
  },

  // Black Spot / Shell Lesion Specialized Detection
  async getBlackSpotStatus() {
    return request('/api/disease/black-spot/status');
  },

  async analyzeBlackSpotImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    return request('/api/disease/analyze-black-spot', {
      method: 'POST',
      body: formData
    });
  },

  async triggerDiseaseAlert(count = 3, disease = 'Black Spot Disease', specimens = null) {
    return request('/api/disease/trigger-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, disease, specimens })
    });
  }
};
