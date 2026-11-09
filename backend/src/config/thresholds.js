/**
 * Aquaculture Water Quality Thresholds
 * Default calibrated for Pacific White Shrimp (Litopenaeus vannamei) Hatchery Post-Larvae (PL).
 * Fully configurable at runtime via API or database settings.
 */

module.exports = {
  species: 'Litopenaeus vannamei (Pacific White Shrimp)',
  stage: 'Post-Larvae (PL10-PL20)',
  parameters: {
    ph: {
      name: 'pH',
      unit: 'pH',
      minAcceptable: 7.5,
      maxAcceptable: 8.5,
      optimalMin: 7.8,
      optimalMax: 8.3,
      warningLow: 7.2,
      warningHigh: 8.8,
      criticalLow: 6.8,
      criticalHigh: 9.2,
      step: 0.1,
      advice: {
        low: 'Low pH increases hydrogen sulfide toxicity. Buffer with calcium carbonate (CaCO3) or sodium bicarbonate.',
        high: 'High pH accelerates unionized ammonia (NH3) toxicity. Provide water exchange or aeration.'
      }
    },
    temperature: {
      name: 'Water Temperature',
      unit: '°C',
      minAcceptable: 26.0,
      maxAcceptable: 32.0,
      optimalMin: 28.0,
      optimalMax: 30.5,
      warningLow: 24.0,
      warningHigh: 33.0,
      criticalLow: 20.0,
      criticalHigh: 35.0,
      step: 0.5,
      advice: {
        low: 'Sub-optimal temperature lowers shrimp metabolism, digestion, and immune defense. Activate tank heater.',
        high: 'Elevated water temperature increases respiration and reduces dissolved oxygen saturation. Activate cooling / shade.'
      }
    },
    turbidity: {
      name: 'Turbidity',
      unit: 'NTU',
      minAcceptable: 10.0,
      maxAcceptable: 40.0,
      optimalMin: 15.0,
      optimalMax: 30.0,
      warningLow: 5.0,
      warningHigh: 60.0,
      criticalLow: 0.0,
      criticalHigh: 90.0,
      step: 1.0,
      advice: {
        low: 'Water too clear indicates insufficient planktonic blooms or sterile conditions.',
        high: 'High turbidity indicates organic silt, excess feed, or clay suspension. Activate mechanical filtration.'
      }
    },
    tds: {
      name: 'Total Dissolved Solids (TDS)',
      unit: 'ppm',
      minAcceptable: 1200.0,
      maxAcceptable: 2400.0,
      optimalMin: 1500.0,
      optimalMax: 2000.0,
      warningLow: 900.0,
      warningHigh: 2700.0,
      criticalLow: 600.0,
      criticalHigh: 3200.0,
      step: 50.0,
      advice: {
        low: 'Low ionic strength hampers osmoregulation and exoskeleton mineralization. Remineralize with marine salts.',
        high: 'Excess TDS disrupts ionic balance and osmoregulatory capacity.'
      }
    },
    salinity: {
      name: 'Salinity',
      unit: 'ppt',
      minAcceptable: 15.0,
      maxAcceptable: 30.0,
      optimalMin: 20.0,
      optimalMax: 28.0,
      warningLow: 10.0,
      warningHigh: 34.0,
      criticalLow: 5.0,
      criticalHigh: 38.0,
      step: 0.5,
      advice: {
        low: 'Rapid salinity drop causes osmotic stress and molting mortality in hatchery PLs.',
        high: 'High salinity induces osmotic stress and retards growth rates. Add freshwater gradually.'
      }
    },
    alkalinity: {
      name: 'Total Alkalinity',
      unit: 'mg/L CaCO3',
      minAcceptable: 120.0,
      maxAcceptable: 200.0,
      optimalMin: 140.0,
      optimalMax: 180.0,
      warningLow: 100.0,
      warningHigh: 220.0,
      criticalLow: 80.0,
      criticalHigh: 260.0,
      step: 5.0,
      advice: {
        low: 'Low alkalinity destabilizes pH buffer capacity, causing dangerous diurnal pH swings. Add sodium bicarbonate.',
        high: 'High alkalinity may lead to mineral precipitation and calcification.'
      }
    },
    ammonia: {
      name: 'Total Ammonia Nitrogen (NH3/NH4+)',
      unit: 'mg/L',
      minAcceptable: 0.0,
      maxAcceptable: 0.10,
      optimalMin: 0.0,
      optimalMax: 0.05,
      warningLow: 0.0,
      warningHigh: 0.25,
      criticalLow: 0.0,
      criticalHigh: 0.50,
      step: 0.01,
      advice: {
        low: 'Normal nominal state.',
        high: 'Ammonia is acutely toxic to shrimp gill lamellae and hemolymph. Perform 20% water exchange and aerate aggressively.'
      }
    },
    dissolved_oxygen: {
      name: 'Dissolved Oxygen (DO)',
      unit: 'mg/L',
      minAcceptable: 5.0,
      maxAcceptable: 9.0,
      optimalMin: 6.0,
      optimalMax: 8.0,
      warningLow: 4.2,
      warningHigh: 12.0,
      criticalLow: 3.0,
      criticalHigh: 15.0,
      step: 0.1,
      advice: {
        low: 'Hypoxia danger! Shrimp will suffocate or exhibit acute stress. Engage emergency aerator pump immediately.',
        high: 'Super-saturation may cause gas bubble disease in post-larvae.'
      }
    },
    humidity: {
      name: 'Ambient Air Humidity',
      unit: '%',
      minAcceptable: 50.0,
      maxAcceptable: 88.0,
      optimalMin: 60.0,
      optimalMax: 82.0,
      warningLow: 45.0,
      warningHigh: 92.0,
      criticalLow: 30.0,
      criticalHigh: 97.0,
      step: 1.0,
      advice: {
        low: 'Low ambient humidity drives rapid surface evaporation and tank salinity drift. Increase ambient misting.',
        high: 'Saturated air creates condensation risks on electronics and structural surfaces. Increase ventilation.'
      }
    }
  }
};
