import requests
import json
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

BASE_URL = "http://localhost:8000"
VIDEO_ID = "e2e_test_002"
API_KEY = "member1-secret-key"
PASS = 0
FAIL = 0

def report(step, name, response):
    global PASS, FAIL
    status = response.status_code
    try:
        body = response.json()
    except Exception:
        body = response.text
    if 200 <= status < 300:
        PASS += 1
        print(f"  [PASS] Step {step}: {name} -- HTTP {status}")
    else:
        FAIL += 1
        print(f"  [FAIL] Step {step}: {name} -- HTTP {status}")
    print(f"     Response: {json.dumps(body, indent=2, default=str)}")
    print()
    return body

print("=" * 60)
print("  Road Damage ML Service -- E2E API Test")
print("=" * 60)
print()

# Step 1
print("--- Step 1: Health Check ---")
try:
    r = requests.get(f"{BASE_URL}/ml/health", headers={"x-api-key": API_KEY}, timeout=5)
    report(1, "GET /ml/health", r)
except Exception as e:
    FAIL += 1
    print(f"  [FAIL] Step 1: {e}")
    print()

# Step 2
print("--- Step 2: Ingest Detections ---")
payload = {
    "video_id": VIDEO_ID,
    "model_version": "yolov8-custom-v1",
    "detections": [
        {
            "geometry": {"type": "Point", "coordinates": [77.2090, 28.6139]},
            "properties": {
                "damage_type": "pothole",
                "confidence": 0.95,
                "bbox_area_ratio": 0.15,
                "normalized_acceleration": 0.4,
                "severity_score": 0.8
            }
        },
        {
            "geometry": {"type": "Point", "coordinates": [77.2091, 28.6140]},
            "properties": {
                "damage_type": "pothole",
                "confidence": 0.88,
                "bbox_area_ratio": 0.12,
                "normalized_acceleration": 0.3,
                "severity_score": 0.75
            }
        },
        {
            "geometry": {"type": "Point", "coordinates": [77.2092, 28.6138]},
            "properties": {
                "damage_type": "crack",
                "confidence": 0.72,
                "bbox_area_ratio": 0.08,
                "normalized_acceleration": 0.2,
                "severity_score": 0.5
            }
        }
    ]
}
try:
    r = requests.post(f"{BASE_URL}/api/v1/detections/bulk", json=payload, headers={"x-api-key": API_KEY}, timeout=10)
    report(2, "POST /api/v1/detections/bulk", r)
except Exception as e:
    FAIL += 1
    print(f"  [FAIL] Step 2: {e}")
    print()

# Step 3
print("--- Step 3: DBSCAN Clustering ---")
try:
    r = requests.post(f"{BASE_URL}/ml/clustering/run",
                       json={"video_id": VIDEO_ID, "force_recluster": True}, headers={"x-api-key": API_KEY}, timeout=15)
    body3 = report(3, "POST /ml/clustering/run", r)
except Exception as e:
    FAIL += 1
    print(f"  [FAIL] Step 3: {e}")
    print()
    body3 = {}

# Get cluster_id
cluster_id = None
print("--- Finding cluster_id ---")
try:
    r = requests.get(f"http://localhost:3000/api/v1/detections?video_id={VIDEO_ID}&processed=true&limit=1", timeout=5) # Not protected in this E2E script context since E2E assumes no token
    det_body = r.json()
    if det_body.get("detections") and len(det_body["detections"]) > 0:
        cid = det_body["detections"][0].get("cluster_id")
        if cid:
            cluster_id = cid
            print(f"  Found cluster_id: {cluster_id}")
        else:
            print("  No cluster_id on detection")
    else:
        print("  No processed detections found")
except Exception as e:
    print(f"  Error finding cluster: {e}")
print()

# Step 4
print("--- Step 4: Satellite Aging ---")
if cluster_id:
    try:
        r = requests.post(f"{BASE_URL}/ml/satellite/analyze",
                           json={"cluster_id": cluster_id, "coordinates": [77.2090, 28.6139]}, headers={"x-api-key": API_KEY}, timeout=30)
        report(4, "POST /ml/satellite/analyze", r)
    except Exception as e:
        FAIL += 1
        print(f"  [FAIL] Step 4: {e}")
        print()
else:
    print("  [SKIP] No cluster_id")
    print()

# Step 5
print("--- Step 5: Repair Status ---")
if cluster_id:
    try:
        r = requests.post(f"{BASE_URL}/ml/risk/update-status",
                           json={"cluster_id": cluster_id, "status": "repaired", "notes": "Fixed by E2E test."}, headers={"x-api-key": API_KEY}, timeout=10)
        report(5, "POST /ml/risk/update-status", r)
    except Exception as e:
        FAIL += 1
        print(f"  [FAIL] Step 5: {e}")
        print()
else:
    print("  [SKIP] No cluster_id")
    print()

print("=" * 60)
print(f"  Results: {PASS} passed, {FAIL} failed")
print("=" * 60)
sys.exit(0 if FAIL == 0 else 1)
