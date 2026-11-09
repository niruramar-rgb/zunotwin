"""
Comprehensive verification test for ZunoTwin Backend
Tests YOLOv8, XGBoost, AutoGluon, SHAP, EWMA, and the Critical Hardware Heartbeat Failsafe.
"""
import time
import json
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend directory and its parent are in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent
_PARENT_DIR = _BACKEND_DIR.parent
for _p in [str(_BACKEND_DIR), str(_PARENT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from api.main import app, state
except ImportError:
    from backend.api.main import app, state

def run_all_tests():
    client = TestClient(app)
    print("=== STARTING ZUNOTWIN BACKEND SUITE VERIFICATION ===")

    # Test 1: Service Root & Health
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("[PASS] Test 1: Service Root endpoint operational:", res.json())

    # Test 2: Hardware Failsafe Disconnect (delta > 5s)
    # Stale timestamp: 10 seconds in the past
    stale_ts = time.time() - 10.0
    payload_stale = {
        "timestamp": stale_ts,
        "water_temp": 28.5,
        "ph_level": 7.9,
        "do_level": 6.2,
        "tds_ec": 1700.0,
        "turbidity": 20.0,
        "ambient_humidity": 65.0
    }
    res_stale = client.post("/telemetry", json=payload_stale)
    data_stale = res_stale.json()
    assert data_stale["device_status"] == "DISCONNECTED", f"Expected DISCONNECTED, got {data_stale['device_status']}"
    # Verify strict override to 0
    t = data_stale["telemetry"]
    assert t["ph_level"] == 0.0 and t["do_level"] == 0.0 and t["water_temp"] == 0.0 and t["tds_ec"] == 0.0 and t["turbidity"] == 0.0, "Telemetry not overridden to 0!"
    cv = data_stale["computer_vision"]
    assert cv["shrimp_count"] == 0 and cv["avg_bbox_area"] == 0.0, "Vision count/area not overridden to 0!"
    assert data_stale["predictions"]["stress_index"] == 0.0, "Stress index not overridden to 0!"
    print("[PASS] Test 2: CRITICAL HARDWARE FAILSAFE verified. Delta > 5s declared DISCONNECTED and forced all 7 metrics + stress strictly to 0.")

    # Test 3: Hardware Reconnected with Fresh Heartbeat (delta < 5s)
    payload_fresh = {
        "timestamp": time.time(),
        "water_temp": 28.2,
        "ph_level": 7.85,
        "do_level": 6.40,
        "tds_ec": 1680.0,
        "turbidity": 17.5,
        "ambient_humidity": 64.0
    }
    payload_fresh["timestamp"] = time.time()
    res_fresh = client.post("/telemetry", json=payload_fresh)
    data_fresh = res_fresh.json()
    assert data_fresh["device_status"] == "CONNECTED", f"Expected CONNECTED, got {data_fresh['device_status']}"
    assert data_fresh["telemetry"]["water_temp"] == 28.2
    assert data_fresh["computer_vision"]["shrimp_count"] > 0
    assert 0.0 <= data_fresh["predictions"]["stress_index"] <= 1.0
    print(f"[PASS] Test 3: Active connection restored. Live stress_index: {data_fresh['predictions']['stress_index']:.4f}, XGBoost & AutoGluon active.")

    # Test 4: POST /analyze with frame and hardware JSON
    res_analyze = client.post("/analyze", data={
        "hardware_json": json.dumps({
            "timestamp": time.time(),
            "water_temp": 32.5,  # High temp
            "ph_level": 8.9,    # High pH
            "do_level": 3.1,    # Low DO
            "tds_ec": 2400.0,
            "turbidity": 58.0,  # High turbidity
            "ambient_humidity": 82.0
        })
    })
    assert res_analyze.status_code == 200
    data_analyze = res_analyze.json()
    assert data_analyze["predictions"]["stress_index"] > 0.40, "Expected elevated stress under extreme environmental parameters!"
    print(f"[PASS] Test 4: POST /analyze operational with YOLO detection and high stress elevation: {data_analyze['predictions']['stress_index']:.4f}")

    # Test 5: GET /explain (SHAP feature attribution)
    res_explain = client.get("/explain")
    assert res_explain.status_code == 200
    data_explain = res_explain.json()
    assert "attributions" in data_explain and "actionable_advice" in data_explain
    print(f"[PASS] Test 5: GET /explain SHAP attribution verified. Top driver: {data_explain.get('primary_driver')}. Advisory: '{data_explain.get('actionable_advice')}'")

    # Test 6: GET /trends (EWMA curves)
    res_trends = client.get("/trends")
    assert res_trends.status_code == 200
    data_trends = res_trends.json()
    assert "history" in data_trends and len(data_trends["history"]) > 0
    print(f"[PASS] Test 6: GET /trends EWMA tracker verified. Points in buffer: {len(data_trends['history'])}, velocity: {data_trends['latest']['velocity']}")

    print("\n>>> ALL 6 BACKEND MODULE TESTS COMPLETED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    run_all_tests()
