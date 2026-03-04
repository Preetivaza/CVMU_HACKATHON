# 🚀 Road Damage Detection — Complete API Reference

> **ML Service:** `http://localhost:8000` (FastAPI)
> **Frontend Backend:** `http://localhost:3000/api` (Next.js)
> **Swagger Docs (ML):** `http://localhost:8000/docs`

---

## Architecture Overview & Authentication

```
Member 1 (AI Engine)          Member 2 (ML Service)           Member 3 (Frontend)
┌──────────────────┐    ┌──────────────────────────┐    ┌─────────────────────┐
│ extract_damage   │    │ FastAPI on Port 8000     │    │ Next.js on Port 3000│
│ _json.py         │───▶│                          │◀───│                     │
│ YOLO Detection   │    │ POST /api/v1/detections  │    │ /api/v1/detections  │
│ Output: JSON     │    │ POST /ml/clustering/run  │    │ /api/v1/clusters    │
└──────────────────┘    │ POST /ml/satellite/analyze│   │ /api/v1/analytics   │
                        │ POST /ml/risk/update-status│  │ /api/v1/map-data    │
                        │ GET  /ml/health          │    └─────────────────────┘
                        └──────────────────────────┘
```

### Authentication Rules 🛡️
The backend now enforces strict security rules across all endpoints:

1. **User JWT Authentication (Next.js)**
   * **Header:** `Authorization: Bearer <your_jwt_token>`
   * **Required for:** Almost all Next.js API endpoints (`/api/v1/clusters`, `/api/v1/detections`, `/api/v1/areas`, `/api/v1/roads`, `/api/v1/map-data`, `/api/v1/analytics/*`, `/api/upload/video`).
   * **Obtained via:** `POST /api/auth/login`

2. **Machine-to-Machine API Key (Automated Scripts & Services)**
   * **Header:** `x-api-key: <your_secret_api_key>` (Default: `member1-secret-key`)
   * **Required for:** 
     - Next.js Ingestion: `POST /api/v1/detections/bulk`
     - All ML Service endpoints (FastAPI): `POST /api/v1/detections/bulk`, `POST /ml/clustering/run`, `POST /ml/satellite/analyze`, `POST /ml/risk/*`

---

## 1. Authentication Endpoints (Next.js — Port 3000)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/auth/register` | None | Register a new user (`email`, `password`, `name`, `role`). Returns JWT. |
| POST | `/api/auth/login` | None | Login with `email` and `password`. Returns JWT token. |
| GET | `/api/auth/me` | **JWT** | Get current logged-in user profile. |
| PATCH | `/api/auth/me` | **JWT** | Update current user profile (`name`, etc). |

---

## 2. Detection Ingestion (AI Engine to Backend)

### 2.1 Next.js Bulk Ingestion (Member 1 Flat Format)
This is the primary way the AI python script pushes data to the database.

* **URL:** `POST http://localhost:3000/api/v1/detections/bulk`
* **Auth:** `x-api-key` header required
* **Body:**
```json
{
  "video_id": "test5.mp4",
  "model_version": "yolov8_v1",
  "detections": [
    {
      "video_id": "test5.mp4",
      "frame_id": 42,
      "timestamp": "0:00:01.680",
      "conditions": { "D40": 1 },
      "severity": "Critical",
      "damage_score": 8.41,
      "confidence_level": 0.84
    }
  ]
}
```

### 2.2 Direct ML Service Ingestion (GeoJSON Format)
* **URL:** `POST http://localhost:8000/api/v1/detections/bulk`
* **Auth:** `x-api-key` header required
* **Body:** GeoJSON Feature collection representation of the detections (used mostly internally or by advanced scripts with GPS).

---

## 3. Core Data Retrieval (Next.js — Port 3000)

All these endpoints **REQUIRE JWT Authentication** (`Authorization: Bearer <token>`).

| Method | Endpoint | Query Parameters | Description |
|--------|----------|------------------|-------------|
| GET | `/api/v1/detections` | `video_id`, `damage_type`, `processed` (bool), `limit`, `page` | List raw detections. |
| GET | `/api/v1/clusters` | `risk_level`, `status`, `min_risk_score`, `limit`, `page` | List DBSCAN clustered damage reports. |
| GET | `/api/v1/clusters/:id` | None | Get detailed view of one cluster. |
| PATCH| `/api/v1/clusters/:id` | Body: `{ "status": "in_progress", "notes": "..." }` | Update cluster repair status (pending/in_progress). |
| DELETE| `/api/v1/clusters/:id` | None | Delete a cluster. |
| GET | `/api/v1/map-data` | `zoom`, `min_lon`, `max_lon`, `min_lat`, `max_lat` | Returns Zoom-aware GeoJSON (Heatmap, Clusters, or Points). |
| GET | `/api/v1/areas` | `limit`, `page` | Returns administrative areas grids for macro viewing. |
| GET | `/api/v1/roads` | `limit`, `road_type`, `min_risk_score` | Returns road segments and their metadata. |
| GET | `/api/v1/analytics/monthly-trend` | `months` (int) | Trend graph data for detections and repairs over time. |
| GET | `/api/v1/analytics/priority-ranking` | `limit`, `status` | Top highly-critical risks for dashboard ranking. |

---

## 4. Video Uploads (Next.js — Port 3000)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/upload/video` | **JWT** | Upload a `.mp4` and optional `gps.csv` tracking file via `form-data`. |
| GET | `/api/upload/video` | **JWT** | List previous video upload sessions. |
| GET | `/api/upload/status/:id` | **JWT** | Check status (`uploaded`, `processing`, `completed`) |

---

## 5. ML Service Jobs (FastAPI — Port 8000)

All ML Service jobs run in the background. They **REQUIRE API KEY Authentication** (`x-api-key: <key>`).

### 5.1 Run DBSCAN Clustering
Groups raw detections into unified functional clusters based on geography and severity.
* **URL:** `POST /ml/clustering/run`
* **Body:** `{ "video_id": "test5.mp4", "force_recluster": false, "eps_meters": 10.0, "min_samples": 3 }`

### 5.2 Satellite Aging Analysis
Triggers a Google Earth Engine analysis for an existing cluster to calculate the Aging Index of the road surface.
* **URL:** `POST /ml/satellite/analyze`
* **Body:** `{ "cluster_id": "CLUSTER_ID", "coordinates": [77.209, 28.613], "radius_meters": 50 }`

### 5.3 Risk Score Management
* **Calculate All Risk:** `POST /ml/risk/calculate` body `{ "recalculate_all": true }`
* **Update Aging (Manual bypass):** `POST /ml/risk/update-aging` body `{ "cluster_id": "ID", "aging_index": 0.5 }`
* **Close Loop / Update ML Repair Status:** `POST /ml/risk/update-status` body `{ "cluster_id": "ID", "status": "repaired", "notes": "Done" }`. Setting status to `repaired` resets the ML calculated risk score to `0.0`.

---

## 6. Smart Data Masking (Authority Geofencing)

Handled securely at the Next.js **Frontend Query Layer**:

| Role           | Data Access |
|----------------|-------------|
| `admin`     | 100% of all risks across all areas. |
| `operator`  | Can primarily view and dispatch based on region. |
| *Future Scopes*| Geographic restrictions `geometry.$geoWithin: user_authority_polygon` |

---

## 7. Business Rules to Remember

1. **Risk Recalculation:** Risk score is a normalized 0.0 - 1.0 curve.
   * `Critical` ≥ 0.85 🔴
   * `High` ≥ 0.70 🟠
   * `Medium` ≥ 0.50 🟡
   * `Low` < 0.50 🟢
2. **Cluster Lifecycle:** Raw detections have `processed: false`. Running DBSCAN binds them to a cluster, marking them `processed: true`.
3. **Repairs:** When a cluster is marked `repaired` via `PATCH /api/v1/clusters/:id` or POST to the ML service, the system logically zeros out its risk score and resolves it on the map.
