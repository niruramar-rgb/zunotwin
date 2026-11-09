"""
Exponentially Weighted Moving Average (EWMA) Trend Tracker for ZunoTwin
Tracks chronological stress index streams over time and computes rate-of-change trend vectors.
"""
import time
from typing import List, Dict, Any, Optional

class EWMATrendTracker:
    def __init__(self, alpha: float = 0.25, max_history: int = 60):
        """
        :param alpha: Smoothing factor between 0 and 1. Higher alpha = discounts older observations faster.
        :param max_history: Maximum historical data points kept in rolling buffer.
        """
        self.alpha = max(0.01, min(1.0, alpha))
        self.max_history = max_history
        self.current_ema: Optional[float] = None
        self.last_timestamp: Optional[float] = None
        self.velocity: float = 0.0  # Rate of change d(EMA)/dt per minute or second
        self.history: List[Dict[str, Any]] = []

    def update(self, raw_value: float, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Ingests a new raw stress_index observation and recalculates EWMA and rate-of-change.
        """
        now = timestamp if timestamp is not None else time.time()

        if self.current_ema is None:
            self.current_ema = raw_value
            self.velocity = 0.0
            dt = 1.0
        else:
            prev_ema = self.current_ema
            # Exponential moving average formula
            self.current_ema = (self.alpha * raw_value) + ((1.0 - self.alpha) * prev_ema)
            dt = max(0.1, (now - self.last_timestamp)) if self.last_timestamp else 1.0
            # Normalized rate-of-change per 10 seconds
            self.velocity = ((self.current_ema - prev_ema) / dt) * 10.0

        self.last_timestamp = now

        # Trend direction classification
        if self.velocity > 0.015:
            trend_direction = "RISING"
        elif self.velocity < -0.015:
            trend_direction = "FALLING"
        else:
            trend_direction = "STABLE"

        entry = {
            "timestamp": round(now, 2),
            "raw_value": round(raw_value, 4),
            "smoothed_value": round(self.current_ema, 4),
            "velocity": round(self.velocity, 5),
            "trend_direction": trend_direction
        }

        self.history.append(entry)
        if len(self.history) > self.max_history:
            self.history.pop(0)

        return entry

    def get_latest(self) -> Dict[str, Any]:
        if not self.history:
            return {
                "smoothed_value": 0.0,
                "velocity": 0.0,
                "trend_direction": "STABLE",
                "raw_value": 0.0,
                "timestamp": time.time()
            }
        return self.history[-1]

    def get_trend_curve(self) -> List[Dict[str, Any]]:
        """Returns the full chronological series for fl_chart plotting."""
        return list(self.history)

    def reset(self):
        """Resets the tracker (e.g. upon hardware disconnect)."""
        self.current_ema = 0.0
        self.velocity = 0.0
        self.history.clear()
        self.last_timestamp = None
