const sensorService = require('./sensorService');
const automationService = require('./automationService');
const alertService = require('./alertService');
const deviceRegistry = require('../hardware/deviceRegistry');
const env = require('../config/env');

class DigitalTwinService {
  async getTankState(tankId = env.DEFAULT_TANK_ID) {
    const hwStatus = deviceRegistry.getStatus();
    const isConnected = hwStatus.hardwareConnected;

    const sensorSummary = await sensorService.getLatestCardSummary(tankId);
    const equipmentList = await automationService.getEquipmentList(tankId);
    const activeAlerts = await alertService.getActiveAlerts(tankId, 10);

    const aerator = equipmentList.find(e => e.type === 'aerator');
    const pump = equipmentList.find(e => e.type === 'water_pump');
    const heater = equipmentList.find(e => e.type === 'heater');

    // Calculate water clarity factor based on turbidity (1.0 = crystal clear, 0.2 = murky)
    const turb = sensorSummary.cards.turbidity?.value;
    let clarityFactor = 0.9;
    if (turb !== null && !isNaN(turb)) {
      clarityFactor = Math.max(0.15, Math.min(1.0, 1.0 - (turb / 120.0)));
    }

    // Determine water quality health score (0 - 100%)
    let criticalCount = 0;
    let warningCount = 0;
    let validCount = 0;
    for (const key in sensorSummary.cards) {
      const card = sensorSummary.cards[key];
      if (card.value !== null) {
        validCount++;
        if (card.status === 'CRITICAL') criticalCount++;
        else if (card.status === 'WARNING') warningCount++;
      }
    }

    let healthIndex = null;
    let overallStatus = 'UNAVAILABLE';
    if (isConnected && validCount > 0) {
      healthIndex = Math.max(0, 100 - (criticalCount * 30 + warningCount * 12));
      overallStatus = criticalCount > 0 ? 'CRITICAL' : (warningCount > 0 ? 'WARNING' : 'OPTIMAL');
    }

    return {
      tankId,
      tankName: 'Hatchery Tank 01',
      geometry: {
        type: 'CYLINDRICAL',
        diameterMeters: 4.5,
        heightMeters: 1.8,
        nominalVolumeLiters: 25000
      },
      connection: {
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
        lastUpdated: sensorSummary.lastTimestamp,
        hardwarePort: hwStatus.portName,
        failReason: hwStatus.failReason
      },
      waterQuality: {
        overallStatus,
        healthIndex,
        clarityFactor,
        cards: sensorSummary.cards
      },
      equipmentState: {
        aeratorActive: isConnected && aerator?.state === 'ON',
        pumpActive: isConnected && pump?.state === 'ON',
        heaterActive: isConnected && heater?.state === 'ON',
        list: equipmentList
      },
      alerts: activeAlerts.map(a => ({
        id: a.id,
        severity: a.severity,
        parameter: a.parameter,
        message: a.message
      })),
      digitalTwinMeshParams: {
        waterWaveSpeed: isConnected ? (aerator?.state === 'ON' ? 1.6 : 0.8) : 0.0,
        bubbleDensity: isConnected && aerator?.state === 'ON' ? 250 : 0,
        waterColorHex: criticalCount > 0 ? '#ff5252' : (clarityFactor < 0.5 ? '#26a69a' : '#00e5ff'),
        ambientGlow: isConnected ? '#00e5ff' : '#ff1744'
      }
    };
  }
}

module.exports = new DigitalTwinService();
