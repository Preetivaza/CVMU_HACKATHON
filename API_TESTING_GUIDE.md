# RDD — Complete Postman API Testing Guide

## Setup

### Prerequisites
Both services must be running:
```
Terminal 1:  cd d:\nextjs\RDD\ml-service && venv\Scripts\activate && uvicorn app.main:app --port 8000 --reload
Terminal 2:  cd d:\nextjs\RDD\frontend  && npm run dev
```

### Import Postman Collection
**File → Import** → select `d:\nextjs\RDD\RDD_Postman_Collection.json`

This sets up collection variables automatically: `NEXTJS=http://localhost:3000`, `ML=http://localhost:8000`, `TOKEN`, `API_KEY`, `VIDEO_ID`, `CLUSTER_ID`.

---

## API Flow (Execute in This Order)

```
[1] Health Check  →  [2] Register  →  [3] Login (saves token)
  →  [4] Ingest Detections  →  [5] Run Clustering (saves cluster_id)
  →  [6] Risk / Satellite   →  [7] Dashboard Queries
```

---

## 0 — Health Checks

### 0.1 ML Service Health
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8000/ml/health` |
| Auth | None |

**Expected Response (HTTP 200):**
```json
{ "status": "healthy", "database": "connected" }
```

### 0.2 ML Swagger UI
Open in browser: `http://localhost:8000/docs`

---

## 1 — Authentication (Next.js — port 3000)

### 1.1 Register
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:3000/api/auth/register` |
| Header | `Content-Type: application/json` |

**Body:**
```json
{
  "email":    "admin@rdd.test",
  "password": "Admin1234!",
  "name":     "Road Admin",
  "role":     "admin"
}
```

> Roles: `admin` | `operator` | `viewer`

**Expected (HTTP 201):**
```json
{
  "message": "User registered successfully",
  "user": { "id": "...", "email": "admin@rdd.test", "name": "Road Admin", "role": "admin" },
  "token": "eyJhbGci..."
}
```

### 1.2 Login ⭐ (run this first — saves token)
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:3000/api/auth/login` |
| Header | `Content-Type: application/json` |

**Body:**
```json
{
  "email":    "admin@rdd.test",
  "password": "Admin1234!"
}
```

**Expected (HTTP 200):**
```json
{
  "message": "Login successful",
  "token":   "eyJhbGci...",
  "user":    { "id": "...", "email": "admin@rdd.test", "role": "admin" }
}
```

> **Copy the `token` value** → paste into the `TOKEN` collection variable.  
> The Postman collection does this automatically via a test script.

**Error cases:**

| Scenario | Status |
|----------|--------|
| Wrong password | `401` `{ "error": "Invalid credentials" }` |
| Email not found | `401` |
| Missing fields | `400` |

### 1.3 Get My Profile
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:3000/api/auth/me` |
| Header | `Authorization: Bearer {{TOKEN}}` |

**Expected (HTTP 200):**
```json
{
  "user": { "id": "...", "email": "admin@rdd.test", "name": "Road Admin", "role": "admin", "last_login": "2025-01-15T10:00:00Z" }
}
```

### 1.4 Update Profile
| Field | Value |
|-------|-------|
| Method | `PATCH` |
| URL | `http://localhost:3000/api/auth/me` |
| Header | `Authorization: Bearer {{TOKEN}}` · `Content-Type: application/json` |

**Body:**
```json
{ "name": "Updated Name" }
```

---

## 2 — Video Upload (Optional — Next.js port 3000)

### 2.1 Upload Video File
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:3000/api/upload/video` |
| Header | `Authorization: Bearer {{TOKEN}}` |
| Body | `form-data` |

**Form fields:**

| Key | Type | Value |
|-----|------|-------|
| `video` | File | Select `.mp4` dashcam file |
| `gps` | File | *(Optional)* CSV with columns: `timestamp,latitude,longitude,speed` |

**Expected (HTTP 201):**
```json
{
  "message": "Video uploaded successfully",
  "video_id": "upload_test5",
  "status": "uploaded"
}
```

### 2.2 List All Uploads
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:3000/api/upload/video` |

**Query Params (all optional):**

| Param | Example | Notes |
|-------|---------|-------|
| `page` | `1` | |
| `limit` | `10` | |
| `status` | `uploaded` | `uploaded` \| `processing` \| `completed` \| `failed` |

### 2.3 Get Upload Status
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:3000/api/upload/status/{{VIDEO_ID}}` |

---

## 3 — Ingest Detections from AI Engine (Next.js port 3000)

This is what Member 1's `extract_damage_json.py` sends automatically.

### 3.1 Ingest Detections — Member 1 Flat Format ⭐
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:3000/api/v1/detections/bulk` |
| Header | `Content-Type: application/json` · `x-api-key: {{API_KEY}}` |

**Body (wrapped flat format):**
```json
{
  "video_id":      "test5.mp4",
  "model_version": "yolov8_v1",
  "detections": [
    {
      "video_id":         "test5.mp4",
      "frame_id":         42,
      "timestamp":        "0:00:01.680",
      "conditions":       { "D40": 1 },
      "severity":         "Critical",
      "damage_score":     8.41,
      "confidence_level": 0.84
    },
    {
      "video_id":         "test5.mp4",
      "frame_id":         67,
      "timestamp":        "0:00:02.680",
      "conditions":       { "D40": 1 },
      "severity":         "Critical",
      "damage_score":     8.18,
      "confidence_level": 0.82
    },
    {
      "video_id":         "test5.mp4",
      "frame_id":         95,
      "timestamp":        "0:00:03.800",
      "conditions":       { "D00": 1 },
      "severity":         "High",
      "damage_score":     6.32,
      "confidence_level": 0.73
    },
    {
      "video_id":         "test5.mp4",
      "frame_id":         120,
      "timestamp":        "0:00:04.800",
      "conditions":       { "D40": 1 },
      "severity":         "High",
      "damage_score":     5.92,
      "confidence_level": 0.69
    },
    {
      "video_id":         "test5.mp4",
      "frame_id":         145,
      "timestamp":        "0:00:05.800",
      "conditions":       { "D20": 1 },
      "severity":         "Medium",
      "damage_score":     3.45,
      "confidence_level": 0.58
    }
  ]
}
```

**Field Reference:**

| Field | Type | Scale | Notes |
|-------|------|-------|-------|
| `video_id` | string | — | Filename or upload ID |
| `frame_id` | int | — | Video frame number |
| `timestamp` | string | — | `"H:MM:SS.mmm"` from video start |
| `conditions` | object | — | `{ "D40": 1 }` — see D-code table below |
| `severity` | string | — | `Critical` \| `High` \| `Medium` \| `Low` |
| `damage_score` | float | **0 – 10** | Auto-normalised to 0–1 by backend |
| `confidence_level` | float | **0 – 1** | Direct YOLO confidence score |

**D-Code → Damage Type mapping:**

| `conditions` key | Stored `damage_type` |
|-----------------|----------------------|
| `D00` | `crack` (longitudinal) |
| `D10` | `crack` (transverse) |
| `D20` | `crack` (alligator) |
| `D40` | `pothole` |
| `Repair` | `patch` |

**Expected (HTTP 201):**
```json
{
  "message":        "Detections received successfully",
  "video_id":       "test5.mp4",
  "inserted_count":  5,
  "skipped_count":   0,
  "format_detected": "Flat (Member 1)"
}
```

**Error cases:**

| Scenario | Status |
|----------|--------|
| No `video_id` | `400 { "error": "video_id is required" }` |
| Empty detections array | `400` |
| All detections invalid | `400 { "validation_errors": [...] }` |

> **Bare array format also accepted** (video_id taken from first item):
> ```json
> [ { "video_id":"test5.mp4", "frame_id":1, "conditions":{"D40":1}, "damage_score":8.0, "confidence_level":0.80 } ]
> ```

### 3.2 Ingest via ML Service Direct (GeoJSON format)
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:8000/api/v1/detections/bulk` |
| Header | `Content-Type: application/json` · `x-api-key: {{API_KEY}}` |

**Body (GeoJSON Feature format):**
```json
{
  "video_id":      "test5.mp4",
  "model_version": "yolov8_v1",
  "detections": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [77.2090, 28.6139] },
      "properties": {
        "video_id":                "test5.mp4",
        "damage_type":             "pothole",
        "confidence":              0.84,
        "bbox_area_ratio":         0.15,
        "normalized_acceleration": 0.0,
        "severity_score":          0.84,
        "confidence_level":        "high",
        "vehicle_speed":           40,
        "possible_duplicate":      false,
        "model_version":           "yolov8_v1"
      }
    }
  ]
}
```

### 3.3 List Detections
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/detections` |
| Header | `Authorization: Bearer {{TOKEN}}` |

**Query Params (all optional):**

| Param | Example | Notes |
|-------|---------|-------|
| `video_id` | `test5.mp4` | Filter by video |
| `damage_type` | `pothole` | `pothole` \| `crack` \| `patch` \| `depression` \| `other` |
| `min_confidence` | `0.7` | 0–1 |
| `max_confidence` | `1.0` | 0–1 |
| `processed` | `false` | Unclustered only |
| `page` | `1` | |
| `limit` | `20` | Max 100 |
| `lat` | `28.6139` | Near-point geo filter |
| `lon` | `77.2090` | (requires lat) |
| `radius` | `500` | Metres (default 1000) |

**Example URL:**
```
GET http://localhost:3000/api/v1/detections?video_id=test5.mp4&damage_type=pothole&limit=20
```

**Expected (HTTP 200):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "_id": "...",
      "type": "Feature",
      "geometry": null,
      "properties": {
        "video_id":      "test5.mp4",
        "frame_id":      42,
        "damage_type":   "pothole",
        "confidence":    0.84,
        "severity_score": 0.841,
        "severity_label": "Critical",
        "raw_conditions": { "D40": 1 },
        "raw_damage_score": 8.41
      },
      "processed": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

## 4 — ML Clustering (ML Service — port 8000)

> Run this **after** Step 3. Requires at least 3 nearby detections to form a cluster.

### 4.1 Run DBSCAN Clustering ⭐
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8000/ml/clustering/run` |
| Header | `Content-Type: application/json` · `x-api-key: {{API_KEY}}` |

**Body:**
```json
{
  "video_id":       "test5.mp4",
  "force_recluster": false
}
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `video_id` | string | — | Process detections from this video only |
| `force_recluster` | bool | `false` | Re-run even if already clustered |
| `eps_meters` | float | `10.0` | DBSCAN radius in metres |
| `min_samples` | int | `3` | Min detections to form a cluster |

> If the 5 test detections don't have GPS coordinates (flat format stores `geometry: null`), send via ML service direct (Step 3.2) which includes GPS, or add `eps_meters: 999` for testing.

**Expected (HTTP 200):**
```json
{
  "status":              "completed",
  "clusters_created":    1,
  "detections_processed": 5,
  "message":             "Clustering completed. Created 1 new clusters."
}
```

### 4.2 Trigger Clustering via Next.js (proxy)
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:3000/api/v1/clusters` |
| Header | `Content-Type: application/json` |
| Body | Same as 4.1 |

---

## 5 — Clusters (Next.js — port 3000)

### 5.1 List All Clusters ⭐ (saves cluster_id)
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/clusters` |
| Header | `Authorization: Bearer {{TOKEN}}` |

**Query Params (all optional):**

| Param | Example | Notes |
|-------|---------|-------|
| `risk_level` | `Critical` | `Critical` \| `High` \| `Medium` \| `Low` |
| `status` | `pending` | `pending` \| `in_progress` \| `repaired` |
| `min_risk_score` | `0.7` | 0–1 |
| `limit` | `20` | |
| `page` | `1` | |
| `min_lon` / `max_lon` | `77.0` / `78.0` | Bounding box filter |
| `min_lat` / `max_lat` | `28.0` / `29.0` | |

**Example URL:**
```
GET http://localhost:3000/api/v1/clusters?risk_level=Critical&limit=10
```

**Expected (HTTP 200):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "_id": "682abc...",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [77.2091, 28.6139] },
      "properties": {
        "video_id":            "test5.mp4",
        "detection_count":     3,
        "damage_types":        ["pothole"],
        "avg_severity":        0.84,
        "avg_confidence":      0.83,
        "final_risk_score":    0.91,
        "risk_level":          "Critical",
        "aging_index":         0.1,
        "repair_status":       "pending",
        "radius_meters":       8.5
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

> **Copy `_id`** from the first feature → paste into `CLUSTER_ID` collection variable.

### 5.2 Get Cluster by ID
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/clusters/{{CLUSTER_ID}}` |
| Header | `Authorization: Bearer {{TOKEN}}` |

**Expected (HTTP 200):** Single cluster object with full details.

| Error | Status |
|-------|--------|
| Invalid ID format | `400 { "error": "Invalid cluster ID" }` |
| Not found | `404` |

### 5.3 Update Cluster Repair Status
| Method | `PATCH` |
|--------|---------|
| URL | `http://localhost:3000/api/v1/clusters/{{CLUSTER_ID}}` |
| Header | `Content-Type: application/json` |

**Body:**
```json
{
  "status": "in_progress",
  "notes":  "Repair crew dispatched on 2025-03-04"
}
```

Valid `status` values: `pending` | `in_progress` | `repaired`

### 5.4 Delete Cluster
| Method | `DELETE` |
|--------|----------|
| URL | `http://localhost:3000/api/v1/clusters/{{CLUSTER_ID}}` |

---

## 6 — Satellite Analysis & Risk (ML Service — port 8000)

### 6.1 Satellite Status Check
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:8000/ml/satellite/status` |
| Header | `x-api-key: {{API_KEY}}` |

```json
{ "status": "running", "gee_connected": false, "message": "Satellite service is running." }
```

### 6.2 Run Satellite Aging Analysis
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:8000/ml/satellite/analyze` |
| Header | `Content-Type: application/json` · `x-api-key: {{API_KEY}}` |

**Body:**
```json
{
  "cluster_id":     "{{CLUSTER_ID}}",
  "coordinates":    [77.2090, 28.6139],
  "radius_meters":  50
}
```

> Requires a valid GEE service account. Use Step 6.3 as a manual workaround if GEE is not configured.

**Expected success (HTTP 200):**
```json
{
  "status":        "completed",
  "cluster_id":    "{{CLUSTER_ID}}",
  "aging_index":   0.35,
  "analysis_date": "2025-03-04T02:59:08",
  "message":       "6-Month Sentinel-1 & Sentinel-2 analysis completed successfully"
}
```

### 6.3 Manually Set Aging Index (workaround without GEE)
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:8000/ml/risk/update-aging` |
| Header | `Content-Type: application/json` · `x-api-key: {{API_KEY}}` |

**Body:**
```json
{
  "cluster_id":  "{{CLUSTER_ID}}",
  "aging_index":  0.45
}
```

`aging_index` range: `0.0` (new road) → `1.0` (severely aged)

**Expected (HTTP 200):**
```json
{
  "status":          "updated",
  "cluster_id":      "{{CLUSTER_ID}}",
  "new_risk_score":  0.88,
  "risk_level":      "Critical",
  "message":         "Aging index updated and risk recalculated"
}
```

### 6.4 Recalculate Risk — All Clusters
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:8000/ml/risk/calculate` |
| Header | `Content-Type: application/json` |

**Body:**
```json
{ "recalculate_all": true }
```

**Or specific clusters:**
```json
{
  "cluster_ids":    ["{{CLUSTER_ID}}"],
  "recalculate_all": false
}
```

**Expected (HTTP 200):**
```json
{ "status": "completed", "clusters_updated": 1, "message": "Risk recalculation complete" }
```

### 6.5 Update Repair Status (ML Service)
| Method | `POST` |
|--------|--------|
| URL | `http://localhost:8000/ml/risk/update-status` |
| Header | `Content-Type: application/json` |

**Body — mark in progress:**
```json
{
  "cluster_id": "{{CLUSTER_ID}}",
  "status":     "in_progress",
  "notes":      "Crew dispatched"
}
```

**Body — mark repaired:**
```json
{
  "cluster_id": "{{CLUSTER_ID}}",
  "status":     "repaired",
  "notes":      "Road fully resurfaced"
}
```

When `status = repaired` → risk_score resets to `0.0`, risk_level becomes `"Low"`.

---

## 7 — Dashboard Queries (Next.js — port 3000)

### 7.1 Map Data (zoom-aware)

| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/map-data` |
| Header | `Authorization: Bearer {{TOKEN}}` |

**Required query params:**

| Param | Type | Description |
|-------|------|-------------|
| `zoom` | int | Map zoom level |
| `min_lon` | float | Bounding box |
| `max_lon` | float | Bounding box |
| `min_lat` | float | Bounding box |
| `max_lat` | float | Bounding box |

**Zoom level behaviour:**

| Zoom | Mode | Returns |
|------|------|---------|
| ≤ 12 | Heatmap | Grid area cells with area-level damage summaries |
| 12–15 | Clusters | Cluster circles with risk scores |
| ≥ 15 | Points | Individual detection points |

**Example URLs:**
```
# Heatmap (wide view)
GET http://localhost:3000/api/v1/map-data?zoom=10&min_lon=77.0&max_lon=78.0&min_lat=28.0&max_lat=29.0

# Cluster circles (city level)
GET http://localhost:3000/api/v1/map-data?zoom=13&min_lon=77.1&max_lon=77.3&min_lat=28.5&max_lat=28.7

# Individual points (street level)
GET http://localhost:3000/api/v1/map-data?zoom=16&min_lon=77.18&max_lon=77.22&min_lat=28.60&max_lat=28.62
```

### 7.2 Monthly Trend
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/analytics/monthly-trend` |

| Param | Example | Notes |
|-------|---------|-------|
| `months` | `6` | How many months back |

**Expected (HTTP 200):**
```json
{
  "trend": [
    { "month": "2024-09", "total": 12, "pothole": 8, "crack": 4 },
    { "month": "2024-10", "total": 18, "pothole": 11, "crack": 7 }
  ]
}
```

### 7.3 Priority Ranking
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/analytics/priority-ranking` |

| Param | Example | Notes |
|-------|---------|-------|
| `limit` | `10` | |
| `status` | `pending` | `pending` \| `in_progress` |

### 7.4 Areas (Heatmap Grid)
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/areas` |

| Param | Example |
|-------|---------|
| `limit` | `50` |
| `page` | `1` |

### 7.5 Roads
| Method | `GET` |
|--------|-------|
| URL | `http://localhost:3000/api/v1/roads` |

| Param | Example | Notes |
|-------|---------|-------|
| `limit` | `20` | |
| `road_type` | `highway` | `highway` \| `primary` \| `secondary` \| `local` |
| `min_risk_score` | `0.5` | |

---

## Quick Error Reference

| Error | HTTP | Cause |
|-------|------|-------|
| `"video_id is required"` | 400 | Detections payload missing video_id |
| `"Invalid payload"` | 400 | Body format not recognised |
| `"Invalid cluster ID"` | 400 | ID is not a 24-char hex MongoDB ObjectId |
| `"Unauthorized"` | 401 | Missing or expired JWT token / Invalid API Key |
| `"Not found"` | 404 | Cluster/resource doesn't exist |
| Connection refused | — | Service not running (check terminals) |
| Clustering skipped | — | Less than 3 detections near each other |

---

## Run AI Engine on Video

```bash
cd d:\nextjs\RDD\ai-detection

# Edit extract_damage_json.py:
# Set VIDEO_PATH = "test5.mp4"  (must be in same folder)
# Set EXPORT_TO_API = True

python extract_damage_json.py
```

The script will:
1. Process video with `best.pt` YOLO model
2. Save `test5_damage_report.json`
3. Auto-POST to `http://localhost:3000/api/v1/detections/bulk`

Then run Step 4 (clustering) to generate clusters from the detections.
