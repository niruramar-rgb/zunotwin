"""
ZunoTwin Aquaculture Synthetic Telemetry Generator
Generates realistic multi-modal aquaculture history dataset (2000 rows)
Mapping feature vector: [shrimp_count, avg_bbox_area, water_temp, ph_level, do_level, tds_ec, turbidity]
Target: continuous "stress_index" (0.0 to 1.0)
"""
import numpy as np
import pandas as pd
from pathlib import Path

def generate_aquaculture_dataset(n_samples: int = 2000, random_seed: int = 42) -> pd.DataFrame:
    np.random.seed(random_seed)

    # 1. Vision Features
    shrimp_count = np.random.choice([1, 2, 3, 4], size=n_samples, p=[0.10, 0.20, 0.35, 0.35])
    avg_bbox_area = np.random.uniform(2500.0, 11500.0, size=n_samples)

    # 2. Environmental Hardware Metrics across 3 operational distributions:
    # 60% nominal/healthy, 25% moderate warning, 15% acute stress
    regime = np.random.choice(['nominal', 'moderate', 'acute'], size=n_samples, p=[0.60, 0.25, 0.15])

    water_temp = np.zeros(n_samples)
    ph_level = np.zeros(n_samples)
    do_level = np.zeros(n_samples)
    tds_ec = np.zeros(n_samples)
    turbidity = np.zeros(n_samples)
    ambient_humidity = np.zeros(n_samples)

    for i in range(n_samples):
        r = regime[i]
        if r == 'nominal':
            water_temp[i] = np.random.normal(27.5, 0.8)
            ph_level[i] = np.random.normal(7.8, 0.25)
            do_level[i] = np.random.normal(6.5, 0.6)
            tds_ec[i] = np.random.normal(1650.0, 150.0)
            turbidity[i] = np.random.gamma(shape=2.5, scale=6.0)
            ambient_humidity[i] = np.random.normal(68.0, 5.0)
        elif r == 'moderate':
            water_temp[i] = np.random.choice([np.random.normal(30.2, 0.9), np.random.normal(23.5, 0.8)])
            ph_level[i] = np.random.choice([np.random.normal(8.6, 0.3), np.random.normal(6.9, 0.3)])
            do_level[i] = np.random.normal(4.2, 0.5)
            tds_ec[i] = np.random.choice([np.random.normal(2350.0, 200.0), np.random.normal(1100.0, 100.0)])
            turbidity[i] = np.random.normal(45.0, 8.0)
            ambient_humidity[i] = np.random.normal(78.0, 7.0)
        else: # acute
            water_temp[i] = np.random.choice([np.random.normal(33.5, 1.2), np.random.normal(21.0, 0.8)])
            ph_level[i] = np.random.choice([np.random.normal(9.2, 0.3), np.random.normal(6.2, 0.3)])
            do_level[i] = np.random.uniform(1.6, 3.4)  # Severe hypoxia
            tds_ec[i] = np.random.choice([np.random.normal(2900.0, 250.0), np.random.normal(850.0, 100.0)])
            turbidity[i] = np.random.uniform(55.0, 92.0) # High suspended solids
            ambient_humidity[i] = np.random.normal(86.0, 6.0)

    # Clipping bounds to physical sensor realities
    water_temp = np.clip(water_temp, 20.0, 36.5)
    ph_level = np.clip(ph_level, 5.8, 9.8)
    do_level = np.clip(do_level, 1.2, 9.5)
    tds_ec = np.clip(tds_ec, 600.0, 3500.0)
    turbidity = np.clip(turbidity, 4.0, 98.0)
    ambient_humidity = np.clip(ambient_humidity, 40.0, 99.0)

    # Mathematical programmatic formulation of stress_index
    # 1. Low dissolved oxygen (DO): Lethal trigger. Optimal > 5.5 mg/L.
    do_def = np.maximum(0.0, 5.5 - do_level)
    do_stress = np.where(do_def > 0, np.power(do_def / 4.2, 1.35), 0.0)

    # 2. Temperature deviation: Optimal 26.5 to 29.0 C
    temp_def = np.where(water_temp > 29.0, (water_temp - 29.0) / 7.0,
               np.where(water_temp < 26.0, (26.0 - water_temp) / 6.0, 0.0))
    temp_stress = np.maximum(0.0, temp_def) ** 1.3

    # 3. Abnormal pH: Optimal 7.5 to 8.2
    ph_dist = np.where(ph_level > 8.2, (ph_level - 8.2) / 1.5,
              np.where(ph_level < 7.5, (7.5 - ph_level) / 1.5, 0.0))
    ph_stress = np.maximum(0.0, ph_dist) ** 1.25

    # 4. Elevated turbidity: Optimal < 25 NTU. Gills clog above 40 NTU.
    turb_def = np.maximum(0.0, (turbidity - 28.0) / 65.0)
    turbidity_stress = turb_def ** 1.2

    # 5. TDS/EC osmotic strain: Optimal 1400 - 2000 ppm
    tds_def = np.where(tds_ec > 2100.0, (tds_ec - 2100.0) / 1300.0,
              np.where(tds_ec < 1300.0, (1300.0 - tds_ec) / 700.0, 0.0))
    tds_stress = np.maximum(0.0, tds_def)

    # 6. Vision biomass / clustering effect
    crowd_factor = np.where((shrimp_count >= 3) & (avg_bbox_area > 8500.0), 0.06, 0.0)

    # Weighted cumulative target
    raw_stress = (
        0.38 * do_stress +
        0.26 * temp_stress +
        0.20 * ph_stress +
        0.12 * turbidity_stress +
        0.04 * tds_stress +
        crowd_factor
    )

    # Add realistic stochastic perturbation (+/- 0.015)
    noise = np.random.normal(0.0, 0.015, size=n_samples)
    stress_index = np.clip(raw_stress + noise, 0.0, 1.0)

    df = pd.DataFrame({
        "shrimp_count": shrimp_count,
        "avg_bbox_area": np.round(avg_bbox_area, 2),
        "water_temp": np.round(water_temp, 2),
        "ph_level": np.round(ph_level, 2),
        "do_level": np.round(do_level, 2),
        "tds_ec": np.round(tds_ec, 2),
        "turbidity": np.round(turbidity, 2),
        "ambient_humidity": np.round(ambient_humidity, 2),
        "stress_index": np.round(stress_index, 4)
    })

    return df

def save_and_verify_dataset():
    out_dir = Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / "aquaculture_dataset.csv"
    dataset = generate_aquaculture_dataset(n_samples=2000)
    dataset.to_csv(csv_path, index=False)
    print(f"Generated {len(dataset)} synthetic aquaculture records saved to {csv_path}")
    print(dataset.describe())
    return csv_path

if __name__ == "__main__":
    save_and_verify_dataset()
