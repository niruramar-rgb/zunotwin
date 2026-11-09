"""
Chronological trend tracker for smooth chart visualization of EWMA curves.
"""
from typing import List, Dict, Any, Optional
import time

class EWMATrendTracker:
    def __init__(self, alpha: float = 0.25, max_history: int = 60):
        self.alpha = max(0.01, min(1.0, alpha))
        self.max_history = max_history
        self.current_ema: Optional[float] = None
        self.last_timestamp: Optional[float] = None
        self.velocity: float = 0.0
        self.history: List[Dict[str, Any]] = []

    def update(self, raw_value: float, timestamp: Optional[float] = None) -> Dict[str, Any]:
        now = timestamp if timestamp is not None else time.time()

        if self.current_ema is None:
            self.current_ema = raw_value
            self.velocity = 0.0
            dt = 1.0
        else:
            prev_ema = self.current_ema
            self.current_ema = (self.alpha * raw_value) + ((1.0 - self.alpha) * prev_ema)
            dt = max(0.1, (now - self.last_timestamp)) if self.last_timestamp else 1.0
            self.velocity = ((self.current_ema - prev_ema) / dt) * 10.0

        self.last_timestamp = now

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
        return list(self.history)
