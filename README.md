# Road Damage Detection & Risk Mapping System - Backend Design

## System Architecture Overview

```
Frontend (React/Next.js)         Member 1 (AI Detection - Separate)
       |                                    |
       | Video Upload                       | Detection Results
       v                                    v
  Next.js API  <-------- Standard Contract -------->
       |
       v
  MongoDB (video_uploads, raw_detections, clusters, areas, roads)
       |
       v
  FastAPI ML Service (Clustering, Satellite, Risk Engine)
```

---

## Phase 1: Project Structure & Database Schema Design

### 1.1 Project Directory Structure (JavaScript - No TypeScript)
```
RDD/
├── frontend/                    # Next.js App (React JS - No TypeScript)
│   ├── src/
│   │   ├── app/                 # App Router (JavaScript)
│   │   │   ├── api/             # API Routes (Next.js Backend)
│   │   │   │   ├── auth/        # Authentication endpoints
│   │   │   │   ├── upload/      # Video upload for demo
│   │   │   │   ├── detections/  # Detection CRUD
│   │   │   │   ├── clusters/    # Cluster management
│   │   │   │   ├── areas/       # Area/heatmap data
│   │   │   │   ├── roads/       # Road risk data
│   │   │   │   └── analytics/   # Analytics endpoints
│   │   │   └── (pages)/         # Frontend pages (.jsx files)
│   │   ├── components/          # React components (.jsx)
│   │   ├── lib/
│   │   │   ├── db.js            # MongoDB connection
│   │   │   ├── auth.js          # JWT auth utilities
│   │   │   └── services/        # Business logic services
│   │   └── utils/               # Helper functions
│   ├── public/
│   │   └── uploads/             # Temporary video storage
│   ├── jsconfig.json            # JS path aliases
│   └── package.json
│
├── ml-service/                  # FastAPI ML Microservice
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── routers/
│   │   │   ├── clustering.py    # DBSCAN clustering endpoint
│   │   │   ├── satellite.py     # Satellite aging analysis
│   │   │   └── risk.py          # Risk calculation
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # ML business logic
│   │   ├── models/              # ML model loaders
│   │   └── core/                # Config, dependencies
│   ├── requirements.txt
│   └── .env                     # Environment variables
│
├── .env.local                   # Next.js environment variables
└── README.md
```

**Note: No Docker - Run services manually:**
- MongoDB: Install locally or use MongoDB Atlas
- Next.js: `npm run dev` (port 3000)
- FastAPI: `uvicorn app.main:app --reload` (port 8000)

---

## Phase 2: Member 1 Integration Contract (Standard Interface)

This defines the standard contract between your system (Member 2) and Member 1's AI Detection Engine.

### 2.1 Video Upload Input (What Member 1 Needs from Demo)

When user uploads video from frontend for demo, your system provides:

```javascript
// POST /api/upload/video - Response to Member 1
{
  "video_id": "upload_abc123",
  "video_url": "/uploads/video_abc123.mp4",  // or cloud storage URL
  "gps_data": [                               // If GPS file provided
    {
      "timestamp": "2025-01-02T12:30:00Z",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "speed": 42
    }
  ],
  "accelerometer_data": [                    // If accelerometer file provided
    {
      "timestamp": "2025-01-02T12:30:00Z",
      "x": 0.12,
      "y": -0.05,
      "z": 0.98
    }
  ],
  "metadata": {
    "uploaded_at": "2025-01-02T12:30:00Z",
    "file_size": 52428800,
    "duration_seconds": 120,
    "fps": 30
  }
}
```

### 2.2 Detection Output (What Member 1 Sends Back)

Member 1's AI engine processes video and sends detections via:

```javascript
// POST /api/v1/detections/bulk - From Member 1
{
  "video_id": "upload_abc123",
  "model_version": "yolov8m_v1",
  "detections": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [77.2090, 28.6139]  // [longitude, latitude]
      },
      "properties": {
        "frame_id": 210,
        "timestamp": "2025-01-02T12:30:07Z",
        "damage_type": "pothole",          // pothole | crack | patch | depression | other
        "confidence": 0.91,                 // 0-1
        "bbox_area_ratio": 0.18,            // Bounding box area / frame area (0-1)
        "normalized_acceleration": 0.72,    // Shock intensity from accelerometer (0-1)
        "severity_score": 0.87,             // Calculated: confidence * bbox_area * acceleration
        "confidence_level": "high",         // low (<0.5) | medium (0.5-0.8) | high (>0.8)
        "vehicle_speed": 42,                // km/h
        "possible_duplicate": false         // If same damage detected in consecutive frames
      }
    }
  ]
}
```

---

## Phase 3: MongoDB Collections Schema

### 3.1 Collection: `video_uploads` (Demo Upload Tracking)
```javascript
{
  _id: ObjectId,
  video_id: String,                   // Unique identifier
  original_filename: String,
  storage_path: String,               // Local path or cloud URL
  file_size: Number,                  // bytes
  duration_seconds: Number,
  fps: Number,
  status: "uploaded" | "processing" | "completed" | "failed",
  gps_data: [{                        // Optional GPS track
    timestamp: Date,
    latitude: Number,
    longitude: Number,
    speed: Number
  }],
  accelerometer_data: [{              // Optional accelerometer data
    timestamp: Date,
    x: Number,
    y: Number,
    z: Number
  }],
  processing_result: {
    total_frames: Number,
    processed_frames: Number,
    detections_count: Number,
    processing_time_seconds: Number
  },
  uploaded_by: ObjectId,              // User reference
  created_at: Date,
  updated_at: Date
}
// Index: { video_id: 1 }, { status: 1 }
```

### 3.2 Collection: `users`
```javascript
{
  _id: ObjectId,
  email: String,                    // unique
  password_hash: String,
  name: String,
  role: "admin" | "operator" | "viewer",
  authority_zone: {                 // Optional - for zone-based filtering
    type: "Polygon",
    coordinates: [[[lon, lat], ...]]
  },
  created_at: Date,
  updated_at: Date
}
// Index: { email: 1 }
```

### 3.3 Collection: `raw_detections` (from Member 1)
```javascript
{
  _id: ObjectId,
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [longitude, latitude]  // GeoJSON format [lon, lat]
  },
  properties: {
    video_id: String,
    frame_id: Number,
    timestamp: Date,
    damage_type: "pothole" | "crack" | "patch" | "depression" | "other",
    confidence: Number,               // 0-1
    bbox_area_ratio: Number,          // 0-1
    normalized_acceleration: Number,  // 0-1
    severity_score: Number,           // 0-1
    confidence_level: "low" | "medium" | "high",
    vehicle_speed: Number,            // km/h
    possible_duplicate: Boolean,
    model_version: String
  },
  cluster_id: ObjectId | null,        // Reference to cluster
  processed: Boolean,                 // Has been clustered
  created_at: Date
}
// Index: { geometry: "2dsphere" }, { "properties.timestamp": 1 }
```

### 3.4 Collection: `clusters`
```javascript
{
  _id: ObjectId,
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  properties: {
    detection_ids: [ObjectId],        // References to raw_detections
    points_count: Number,
    radius_meters: Number,
    avg_severity: Number,             // 0-1
    avg_confidence: Number,           // 0-1
    damage_types: {                   // Count by type
      pothole: Number,
      crack: Number,
      // ...
    },
    aging_index: Number | null,       // 0-1 from satellite analysis
    final_risk_score: Number,         // 0-1
    risk_level: "Low" | "Medium" | "High" | "Critical",
    repeat_count: Number,             // Times detected in same location
    status: "pending" | "scheduled" | "in_progress" | "repaired" | "verified",
    repair_history: [{
      status: String,
      changed_by: ObjectId,           // User reference
      changed_at: Date,
      notes: String
    }]
  },
  road_id: ObjectId | null,           // Reference to road segment
  area_id: ObjectId | null,           // Reference to area grid
  first_detected: Date,
  last_detected: Date,
  created_at: Date,
  updated_at: Date
}
// Index: { geometry: "2dsphere" }, { "properties.final_risk_score": -1 }
```

### 3.5 Collection: `areas` (Grid cells for heatmap)
```javascript
{
  _id: ObjectId,
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[[lon1, lat1], [lon2, lat2], ...]]  // Grid cell boundary
  },
  properties: {
    grid_id: String,                  // e.g., "h3_index" or custom grid ID
    cluster_ids: [ObjectId],          // Clusters in this area
    cluster_count: Number,
    avg_risk_score: Number,           // 0-1
    risk_level: "Low" | "Medium" | "High" | "Critical",
    month: String,                    // "YYYY-MM" for time-series
    total_detections: Number
  },
  created_at: Date,
  updated_at: Date
}
// Index: { geometry: "2dsphere" }, { "properties.month": 1 }
```

### 3.6 Collection: `roads`
```javascript
{
  _id: ObjectId,
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [[lon1, lat1], [lon2, lat2], ...]
  },
  properties: {
    road_name: String,
    road_type: "highway" | "arterial" | "collector" | "local",
    osm_id: String | null,            // OpenStreetMap reference
    cluster_ids: [ObjectId],
    cluster_count: Number,
    avg_risk_score: Number,           // 0-1
    risk_level: "Low" | "Medium" | "High" | "Critical",
    length_meters: Number,
    authority_zone: String            // For filtering
  },
  created_at: Date,
  updated_at: Date
}
// Index: { geometry: "2dsphere" }, { "properties.avg_risk_score": -1 }
```

### 3.7 Collection: `satellite_analysis`
```javascript
{
  _id: ObjectId,
  geometry: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  properties: {
    cluster_id: ObjectId,
    aging_index: Number,              // 0-1
    analysis_date: Date,
    image_date: Date,                 // Sentinel-2 image capture date
    image_id: String,                 // GEE image reference
    confidence: Number,
    model_version: String
  },
  created_at: Date
}
// Index: { "properties.cluster_id": 1 }
```

### 3.8 Collection: `analytics_snapshots` (Pre-computed analytics)
```javascript
{
  _id: ObjectId,
  type: "monthly_trend" | "priority_ranking" | "zone_summary",
  period: String,                     // "YYYY-MM"
  authority_zone: String | null,
  data: {
    // Varies by type
    // monthly_trend: { total_detections, clusters_created, repairs_completed, risk_delta }
    // priority_ranking: [{ cluster_id, rank, risk_score, location }]
    // zone_summary: { total_clusters, avg_risk, high_risk_count }
  },
  created_at: Date
}
// Index: { type: 1, period: 1 }
```

---

## Phase 4: JavaScript Utilities & Validation (Next.js)

Create utility functions in `frontend/src/lib/` and `frontend/src/utils/`:

### 4.1 Database Connection (`src/lib/db.js`)
```javascript
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;
```

### 4.2 Validation Helpers (`src/utils/validators.js`)
```javascript
// Validate GeoJSON Point
export const isValidGeoPoint = (geometry) => {
  return geometry?.type === 'Point' && 
         Array.isArray(geometry.coordinates) &&
         geometry.coordinates.length === 2;
};

// Validate detection properties
export const isValidDetection = (detection) => {
  const { properties } = detection;
  return properties?.damage_type &&
         typeof properties?.confidence === 'number' &&
         properties.confidence >= 0 && properties.confidence <= 1;
};

// Risk level calculator
export const getRiskLevel = (score) => {
  if (score >= 0.85) return 'Critical';
  if (score >= 0.70) return 'High';
  if (score >= 0.50) return 'Medium';
  return 'Low';
};
```

### 4.3 Constants (`src/utils/constants.js`)
```javascript
export const DAMAGE_TYPES = ['pothole', 'crack', 'patch', 'depression', 'other'];
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
export const REPAIR_STATUSES = ['pending', 'scheduled', 'in_progress', 'repaired', 'verified'];
export const USER_ROLES = ['admin', 'operator', 'viewer'];
```

---

## Phase 5: Pydantic Schemas (FastAPI ML Service)

Create schemas in `ml-service/app/schemas/`:

- `detection.py` - Detection validation schemas
- `cluster.py` - Clustering input/output schemas
- `satellite.py` - Satellite analysis schemas
- `risk.py` - Risk calculation schemas

---

## Phase 6: API Endpoints Implementation

### 6.1 Next.js API Routes (`/api/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/video` | Upload video + GPS + accelerometer for demo |
| GET | `/api/upload/status/:id` | Check upload processing status |
| POST | `/api/v1/detections/bulk` | Receive bulk detections from Member 1 |
| GET | `/api/v1/detections` | List detections with filters |
| GET | `/api/v1/clusters` | Get all clusters (GeoJSON) |
| GET | `/api/v1/clusters/:id` | Get single cluster details |
| PATCH | `/api/v1/clusters/:id/status` | Update repair status |
| GET | `/api/v1/areas` | Get area grid (heatmap data) |
| GET | `/api/v1/roads` | Get road risk data |
| GET | `/api/v1/analytics/monthly-trend` | Monthly statistics |
| GET | `/api/v1/analytics/priority-ranking` | Top priority clusters |
| GET | `/api/v1/map-data` | Combined map data with zoom filtering |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Current user info |

### 6.2 Video Upload Flow (Demo Feature)

```
User uploads via Frontend
        |
        v
POST /api/upload/video
  - Accepts: video file, GPS CSV (optional), accelerometer CSV (optional)
  - Saves to: public/uploads/ (or cloud storage)
  - Creates: video_uploads document
  - Returns: { video_id, status: "uploaded" }
        |
        v
Member 1 fetches video & metadata
        |
        v
Member 1 processes with YOLOv8
        |
        v
POST /api/v1/detections/bulk (from Member 1)
  - Updates: video_uploads.status = "completed"
  - Creates: raw_detections documents
        |
        v
POST /ml/clustering/run (trigger clustering)
  - Creates: clusters, areas, roads documents
```

### 6.3 FastAPI ML Endpoints (`http://localhost:8000/ml/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clustering/run` | Run DBSCAN on detections |
| POST | `/satellite/analyze` | Analyze satellite imagery |
| POST | `/risk/calculate` | Calculate final risk scores |
| GET | `/health` | Health check |

---

## Phase 7: Risk Engine Logic

### Risk Score Calculation

```python
def calculate_final_risk(avg_severity: float, aging_index: float, repeat_count: int) -> float:
    if repeat_count > 3:
        # Higher weight on aging for repeatedly detected areas
        return 0.6 * avg_severity + 0.4 * aging_index
    else:
        return 0.7 * avg_severity + 0.3 * aging_index

def get_risk_level(score: float) -> str:
    if score >= 0.85: return "Critical"
    if score >= 0.70: return "High"
    if score >= 0.50: return "Medium"
    return "Low"
```

### DBSCAN Clustering Parameters

```python
CLUSTERING_CONFIG = {
    "eps_meters": 10,           # 10 meter radius
    "min_samples": 3,           # Minimum 3 points to form cluster
    "metric": "haversine"       # For geographic coordinates
}
```

---

## Phase 8: Implementation Order

### Step 1: Initialize Projects
```bash
# Create Next.js app with JavaScript (no TypeScript)
npx create-next-app@latest frontend --js --app --src-dir --no-typescript
cd frontend
npm install mongodb jsonwebtoken bcryptjs

# Create FastAPI project
mkdir ml-service
cd ml-service
python -m venv venv
# Activate venv then:
pip install fastapi uvicorn motor scikit-learn numpy pandas earthengine-api
```

### Step 2: MongoDB Setup
- Install MongoDB locally OR use MongoDB Atlas (cloud)
- Create database: `road_damage_db`
- Create collections with indexes:
  ```javascript
  // Run in MongoDB shell
  db.raw_detections.createIndex({ "geometry": "2dsphere" });
  db.clusters.createIndex({ "geometry": "2dsphere" });
  db.areas.createIndex({ "geometry": "2dsphere" });
  db.roads.createIndex({ "geometry": "2dsphere" });
  ```

### Step 3: Environment Variables
```env
# frontend/.env.local
MONGODB_URI=mongodb://localhost:27017/road_damage_db
JWT_SECRET=your-secret-key
FASTAPI_URL=http://localhost:8000

# ml-service/.env
MONGODB_URI=mongodb://localhost:27017/road_damage_db
EE_SERVICE_ACCOUNT=your-gee-service-account.json
```

### Step 4: Development Order
1. Database connection & utilities
2. Video upload API (demo feature)
3. Detection bulk API (Member 1 integration)
4. Clustering service (FastAPI)
5. Risk calculation service
6. Areas & Roads aggregation
7. Analytics endpoints
8. Authentication (JWT)
9. Frontend pages & map visualization

---

## Key Design Decisions

1. **JavaScript Only**: No TypeScript - using plain JavaScript with JSDoc comments for documentation
2. **GeoJSON Format**: All geographic data uses GeoJSON for frontend compatibility with Mapbox/Leaflet
3. **2dsphere Indexes**: MongoDB geospatial indexes for efficient location queries
4. **Zoom-based API**: `/map-data` endpoint returns different granularity based on zoom level
5. **Pre-computed Analytics**: Snapshot collection for fast dashboard queries
6. **Service Separation**: ML operations isolated in FastAPI to prevent blocking Next.js
7. **Standard Contract**: Clear interface defined for Member 1 integration
8. **No Docker**: Simple local development setup with manual service startup

---

## Summary: What Member 1 Needs to Know

### Input Requirements (From Demo Upload)
Member 1's AI system will receive:
- Video file URL
- GPS data array (optional) - `[{ timestamp, latitude, longitude, speed }]`
- Accelerometer data array (optional) - `[{ timestamp, x, y, z }]`
- Video metadata (fps, duration, file size)

### Output Requirements (To Your Backend)
Member 1 must send detections via `POST /api/v1/detections/bulk` with:
- `video_id`: Reference to uploaded video
- `model_version`: AI model version string
- `detections[]`: Array of GeoJSON Features with properties:
  - `frame_id`, `timestamp`, `damage_type`, `confidence`
  - `bbox_area_ratio`, `normalized_acceleration`
  - `severity_score`, `confidence_level`, `vehicle_speed`
  - `possible_duplicate`

### Severity Score Calculation (Member 1 should implement)
```
severity_score = confidence × bbox_area_ratio × (0.5 + normalized_acceleration × 0.5)
```

