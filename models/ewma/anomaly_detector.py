"""
EWMA Statistical Anomaly Detector for Aquaculture Sensor Time Series
Implements Exponentially Weighted Moving Average with dynamic Upper & Lower Control Limits (UCL / LCL),
warm-up periods, per-sensor configuration, rate-of-change velocity, and persistent deviation tracking.
"""
import math
import time
from typing import Dict, Any, List, Optional

class SensorEWMAState:
    def __init__(self, key: str, alpha: float = 0.25, control_limit_k: float = 3.0, warmup_points: int = 10):
        self.key = key
        self.alpha = max(0.01, min(1.0, alpha))
        self.k = control_limit_k
        self.warmup_points = warmup_points
        
        self.sample_count = 0
        self.ewma_mean: Optional[float] = None
        self.ewma_var: float = 0.0
        self.last_value: Optional[float] = None
        self.last_timestamp: Optional[float] = None
        self.velocity: float = 0.0  # d(EWMA)/dt rate of change
        self.history: List[Dict[str, Any]] = []
        self.max_history = 100

    def update(self, val: Optional[float], timestamp: Optional[float] = None) -> Dict[str, Any]:
        now = timestamp if timestamp is not None else time.time()
        
        # Missing data handling: do not fabricate or alter EWMA on missing samples
        if val is None or math.isnan(val):
            return {
                "key": self.key,
                "status": "UNAVAILABLE",
                "value": None,
                "ewma": self.ewma_mean,
                "ucl": None,
                "lcl": None,
                "is_anomaly": False,
                "severity": "NORMAL",
                "velocity": self.velocity,
                "timestamp": now
            }

        self.sample_count += 1

        if self.ewma_mean is None:
            self.ewma_mean = val
            self.ewma_var = 1.0  # Initial baseline variance
            self.velocity = 0.0
            dt = 1.0
        else:
            prev_mean = self.ewma_mean
            dt = max(0.1, (now - self.last_timestamp)) if self.last_timestamp else 1.0
            # EWMA recurrence
            self.ewma_mean = (self.alpha * val) + ((1.0 - self.alpha) * prev_mean)
            # Incremental variance estimator
            diff = val - prev_mean
            self.ewma_var = (1.0 - self.alpha) * (self.ewma_var + self.alpha * (diff ** 2))
            # Normalized rate-of-change per 10 seconds
            self.velocity = ((self.ewma_mean - prev_mean) / dt) * 10.0

        self.last_value = val
        self.last_timestamp = now

        # Compute dynamic control limits
        std_dev = math.sqrt(max(0.0001, self.ewma_var))
        # Exact finite-sample EWMA variance adjustment factor
        adjustment = math.sqrt((self.alpha / (2.0 - self.alpha)) * (1.0 - (1.0 - self.alpha) ** (2 * self.sample_count)))
        sigma_limits = self.k * std_dev * adjustment

        ucl = self.ewma_mean + sigma_limits
        lcl = self.ewma_mean - sigma_limits

        # Evaluate statistical anomaly only after warm-up
        is_warm = self.sample_count >= self.warmup_points
        is_anomaly = False
        severity = "NORMAL"

        if is_warm:
            effective_sigma = max(0.001, std_dev * adjustment)
            if val > ucl:
                is_anomaly = True
                deviation = (val - ucl) / effective_sigma
                severity = "CRITICAL_DEVIATION" if deviation > 0.5 else "WATCH"
            elif val < lcl:
                is_anomaly = True
                deviation = (lcl - val) / effective_sigma
                severity = "CRITICAL_DEVIATION" if deviation > 0.5 else "WATCH"

        # Trend direction
        if self.velocity > 0.05:
            trend = "RISING"
        elif self.velocity < -0.05:
            trend = "FALLING"
        else:
            trend = "STABLE"

        entry = {
            "key": self.key,
            "status": "ACTIVE",
            "value": round(val, 3),
            "ewma": round(self.ewma_mean, 3),
            "ucl": round(ucl, 3) if is_warm else None,
            "lcl": round(lcl, 3) if is_warm else None,
            "is_anomaly": is_anomaly,
            "severity": severity,
            "velocity": round(self.velocity, 4),
            "trend": trend,
            "sample_count": self.sample_count,
            "is_warmed_up": is_warm,
            "timestamp": round(now, 2)
        }

        self.history.append(entry)
        if len(self.history) > self.max_history:
            self.history.pop(0)

        return entry

class AquacultureEWMAEngine:
    def __init__(self, alpha: float = 0.25):
        self.sensors = {
            "ph": SensorEWMAState("ph", alpha=alpha, control_limit_k=2.8, warmup_points=5),
            "temperature": SensorEWMAState("temperature", alpha=alpha, control_limit_k=3.0, warmup_points=5),
            "turbidity": SensorEWMAState("turbidity", alpha=alpha, control_limit_k=3.2, warmup_points=5),
            "tds": SensorEWMAState("tds", alpha=alpha, control_limit_k=3.0, warmup_points=5),
            "salinity": SensorEWMAState("salinity", alpha=alpha, control_limit_k=2.8, warmup_points=5),
            "alkalinity": SensorEWMAState("alkalinity", alpha=alpha, control_limit_k=2.8, warmup_points=5),
            "ammonia": SensorEWMAState("ammonia", alpha=0.35, control_limit_k=2.5, warmup_points=5)
        }

    def process_vector(self, measurements: Dict[str, Optional[float]], timestamp: Optional[float] = None) -> Dict[str, Any]:
        results = {}
        for key, tracker in self.sensors.items():
            val = measurements.get(key)
            results[key] = tracker.update(val, timestamp)
        return results

    def get_curve(self, key: str) -> List[Dict[str, Any]]:
        tracker = self.sensors.get(key)
        return list(tracker.history) if tracker else []
