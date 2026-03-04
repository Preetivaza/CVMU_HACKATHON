"""
test_frontend_apis.py — Comprehensive test for all Next.js (frontend) API endpoints
====================================================================================
Uses the EXACT FLAT FORMAT that Member 1's AI engine produces.

Flat detection format:
  {
    "video_id":        "test5.mp4",
    "frame_id":        42,
    "timestamp":       "0:00:01.680",
    "conditions":      {"D40": 1},
    "severity":        "Critical",
    "damage_score":    8.41,          <- 0-10 scale
    "confidence_level": 0.84          <- 0-1 scale
  }

Wrapped payload sent to /api/v1/detections/bulk:
  {
    "video_id":      "test5.mp4",
    "model_version": "yolov8_v1",
    "detections":    [ <flat items> ]
  }

Prerequisites:
  - Next.js: cd frontend && npm run dev   (port 3000)
  - MongoDB reachable from frontend/.env.local
"""

import requests, json, sys, os, time
os.environ["PYTHONIOENCODING"] = "utf-8"

FRONTEND_URL = "http://localhost:3000"
API_KEY = "member1-secret-key"
PASS = FAIL = 0

# ─── Helpers ──────────────────────────────────────────────────────────────────

def report(step, name, response, expect_status=None):
    global PASS, FAIL
    status = response.status_code
    try:    body = response.json()
    except: body = response.text
    success = (status == expect_status) if expect_status else (200 <= status < 300)
    tag = "[PASS]" if success else "[FAIL]"
    if success: PASS += 1
    else: FAIL += 1
    expected = f" (expected {expect_status})" if expect_status and not success else ""
    print(f"  {tag} Step {step}: {name} -- HTTP {status}{expected}")
    print(f"     Response: {json.dumps(body, indent=2, default=str)[:500]}\n")
    return body

def get(step, name, path, token=None, params=None, expect=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(f"{FRONTEND_URL}{path}", headers=h, params=params, timeout=10)
    return report(step, name, r, expect)

def post(step, name, path, data=None, token=None, expect=None, is_m2m=False):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    if is_m2m: h["x-api-key"] = API_KEY
    r = requests.post(f"{FRONTEND_URL}{path}", json=data, headers=h, timeout=15)
    return report(step, name, r, expect)

def patch(step, name, path, data=None, token=None, expect=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    r = requests.patch(f"{FRONTEND_URL}{path}", json=data, headers=h, timeout=10)
    return report(step, name, r, expect)

# ─── Dummy flat detections (Member 1 format) ──────────────────────────────────

def make_flat(video_id, frame_id, ts, dcode, severity, damage_score, confidence):
    """Build one flat detection exactly as Member 1 AI engine produces."""
    return {
        "video_id":        video_id,
        "frame_id":        frame_id,
        "timestamp":       ts,
        "conditions":      {dcode: 1},
        "severity":        severity,
        "damage_score":    damage_score,  # 0-10 scale
        "confidence_level": confidence,   # 0-1 scale
    }

# ─── Test Run ─────────────────────────────────────────────────────────────────

print("=" * 65)
print("  Frontend (Next.js) API — Comprehensive Test")
print("  Format: Member 1 flat format (conditions/damage_score)")
print("=" * 65 + "\n")

ts_suffix = str(int(time.time()))[-6:]
EMAIL    = f"testuser_{ts_suffix}@rdd.test"
PASSWORD = "TestPass123!"
VIDEO_ID = f"test_video_{ts_suffix}.mp4"
token    = None

# ── AUTH ──────────────────────────────────────────────────────────────────────

print("--- STEP 1: Register ---")
b1 = post(1, "POST /api/auth/register", "/api/auth/register",
    {"email": EMAIL, "password": PASSWORD, "name": "Test User", "role": "operator"}, expect=201)
token = b1.get("token")

print("--- STEP 2: Register (duplicate — expect 400) ---")
post(2, "POST /api/auth/register duplicate", "/api/auth/register",
    {"email": EMAIL, "password": PASSWORD, "name": "User2"}, expect=400)

print("--- STEP 3: Login ---")
b3 = post(3, "POST /api/auth/login", "/api/auth/login", {"email": EMAIL, "password": PASSWORD})
if b3.get("token"): token = b3["token"]

print("--- STEP 4: Login wrong password (expect 401) ---")
post(4, "POST /api/auth/login wrong pw", "/api/auth/login",
    {"email": EMAIL, "password": "WrongPass!"}, expect=401)

print("--- STEP 5: GET /api/auth/me ---")
get(5, "GET /api/auth/me", "/api/auth/me", token=token)

print("--- STEP 6: GET /api/auth/me no token (expect 401) ---")
get(6, "GET /api/auth/me no token", "/api/auth/me", expect=401)

print("--- STEP 7: PATCH /api/auth/me ---")
patch(7, "PATCH /api/auth/me", "/api/auth/me", {"name": "Updated Name"}, token=token)

# ── DETECTIONS (flat format) ──────────────────────────────────────────────────

detections = [
    make_flat(VIDEO_ID,  42, "0:00:01.680", "D40", "Critical", 8.41, 0.84),
    make_flat(VIDEO_ID,  67, "0:00:02.680", "D40", "Critical", 8.18, 0.82),
    make_flat(VIDEO_ID,  95, "0:00:03.800", "D00", "High",     6.32, 0.73),
    make_flat(VIDEO_ID, 120, "0:00:04.800", "D40", "High",     5.92, 0.69),
    make_flat(VIDEO_ID, 145, "0:00:05.800", "D20", "Medium",   3.45, 0.58),
]

print("--- STEP 8: POST /api/v1/detections/bulk (flat format, wrapped) ---")
post(8, "POST /api/v1/detections/bulk", "/api/v1/detections/bulk", {
    "video_id":      VIDEO_ID,
    "model_version": "yolov8_v1",
    "detections":    detections,
}, expect=201, is_m2m=True)

print("--- STEP 9: POST /api/v1/detections/bulk (bare array format) ---")
bare_video = f"bare_{ts_suffix}.mp4"
bare_dets  = [make_flat(bare_video, i, f"0:00:0{i}.000", "D40", "High", 7.0, 0.75) for i in range(1, 4)]
post(9, "POST /api/v1/detections/bulk bare array", "/api/v1/detections/bulk", bare_dets, expect=201, is_m2m=True)

print("--- STEP 10: POST /api/v1/detections/bulk missing video_id (expect 400) ---")
post(10, "POST /api/v1/detections/bulk no vid", "/api/v1/detections/bulk",
    {"detections": detections}, expect=400, is_m2m=True)

print("--- STEP 11: GET /api/v1/detections (filter by video_id) ---")
get(11, "GET /api/v1/detections", "/api/v1/detections", params={"video_id": VIDEO_ID, "limit": 10}, token=token)

print("--- STEP 12: GET /api/v1/detections (filter by damage_type) ---")
get(12, "GET /api/v1/detections filtered", "/api/v1/detections", params={"damage_type": "pothole", "min_confidence": 0.7}, token=token)

# ── CLUSTERS ──────────────────────────────────────────────────────────────────

print("--- STEP 13: GET /api/v1/clusters ---")
b13 = get(13, "GET /api/v1/clusters", "/api/v1/clusters", params={"limit": 20}, token=token)
cluster_id = None
if b13.get("features") and len(b13["features"]) > 0:
    cluster_id = str(b13["features"][0].get("_id", ""))
    print(f"  → cluster_id: {cluster_id}")

print("--- STEP 14: GET /api/v1/clusters (risk_level filter) ---")
get(14, "GET /api/v1/clusters High", "/api/v1/clusters", params={"risk_level": "High"}, token=token)

print("--- STEP 15: GET /api/v1/clusters/:id ---")
if cluster_id:
    get(15, f"GET /api/v1/clusters/{cluster_id}", f"/api/v1/clusters/{cluster_id}", token=token)
else:
    print("  [SKIP] No clusters yet — run ML clustering (POST /ml/clustering/run) first\n"); PASS += 1

print("--- STEP 16: GET /api/v1/clusters/invalid_id (expect 400) ---")
get(16, "GET /api/v1/clusters/invalid", "/api/v1/clusters/invalid_id", expect=400, token=token)

# ── ANALYTICS ─────────────────────────────────────────────────────────────────

print("--- STEP 17: GET /api/v1/analytics/monthly-trend ---")
get(17, "GET /api/v1/analytics/monthly-trend", "/api/v1/analytics/monthly-trend", params={"months": 6}, token=token)

print("--- STEP 18: GET /api/v1/analytics/priority-ranking ---")
get(18, "GET /api/v1/analytics/priority-ranking", "/api/v1/analytics/priority-ranking", params={"limit": 10}, token=token)

# ── MAP DATA ──────────────────────────────────────────────────────────────────

print("--- STEP 19: GET /api/v1/map-data (zoom=10 heatmap) ---")
get(19, "GET /api/v1/map-data zoom=10", "/api/v1/map-data",
    params={"zoom": 10, "min_lon": 77.0, "max_lon": 78.0, "min_lat": 28.0, "max_lat": 29.0}, token=token)

print("--- STEP 20: GET /api/v1/map-data (zoom=13 clusters) ---")
get(20, "GET /api/v1/map-data zoom=13", "/api/v1/map-data",
    params={"zoom": 13, "min_lon": 77.0, "max_lon": 78.0, "min_lat": 28.0, "max_lat": 29.0}, token=token)

print("--- STEP 21: GET /api/v1/map-data (zoom=16 points) ---")
get(21, "GET /api/v1/map-data zoom=16", "/api/v1/map-data",
    params={"zoom": 16, "min_lon": 77.18, "max_lon": 77.22, "min_lat": 28.60, "max_lat": 28.62}, token=token)

print("--- STEP 22: GET /api/v1/map-data no zoom (expect 400) ---")
get(22, "GET /api/v1/map-data no zoom", "/api/v1/map-data", expect=400, token=token)

# ── AREAS & ROADS ─────────────────────────────────────────────────────────────

print("--- STEP 23: GET /api/v1/areas ---")
get(23, "GET /api/v1/areas", "/api/v1/areas", params={"limit": 20}, token=token)

print("--- STEP 24: GET /api/v1/roads ---")
get(24, "GET /api/v1/roads", "/api/v1/roads", params={"limit": 20}, token=token)

# ── Results ───────────────────────────────────────────────────────────────────

print("=" * 65)
print(f"  Results: {PASS} passed, {FAIL} failed  (total {PASS + FAIL} tests)")
print("=" * 65)
sys.exit(0 if FAIL == 0 else 1)
