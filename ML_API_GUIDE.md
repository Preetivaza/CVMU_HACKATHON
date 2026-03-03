# 🚀 Road Damage ML Service - cURL Testing Guide

The ML Service runs on **Port 8001**. 

> **💡 Note for Windows Users**: 
> - If using **PowerShell**, use the backtick (`` ` ``) instead of backslash (`\`) for multi-line commands.
> - If using **Command Prompt (CMD)**, use the caret (`^`) or just keep the whole command on one line.

---

## 1. Service Health Check
Verify the service and MongoDB Atlas connectivity.
```bash
curl -X GET http://localhost:8001/ml/health
```

---

## 2. Ingest Raw Detections (AI Engine Simulation)
Simulate the AI engine sending raw detections into the system.

**PowerShell Version**:
```powershell
curl -X POST http://localhost:8001/api/v1/detections/bulk `
     -H "Content-Type: application/json" `
     -d '{
       "video_id": "session_curl_001",
       "model_version": "yolov8-custom-v1",
       "detections": [
         {
           "geometry": { "type": "Point", "coordinates": [77.2090, 28.6139] },
           "properties": {
             "damage_type": "pothole",
             "confidence": 0.95,
             "bbox_area_ratio": 0.15,
             "normalized_acceleration": 0.4,
             "severity_score": 0.8
           }
         }
       ]
     }'
```

**Linux/Mac/Bash Version**:
```bash
curl -X POST http://localhost:8001/api/v1/detections/bulk \
     -H "Content-Type: application/json" \
     -d '{
       "video_id": "session_curl_001",
       "model_version": "yolov8-custom-v1",
       "detections": [
         {
           "geometry": { "type": "Point", "coordinates": [77.2090, 28.6139] },
           "properties": {
             "damage_type": "pothole",
             "confidence": 0.95,
             "bbox_area_ratio": 0.15,
             "normalized_acceleration": 0.4,
             "severity_score": 0.8
           }
         }
       ]
     }'
```

---

## 3. Run Dynamic Clustering & Road Validation
Trigger DBSCAN to group detections and apply Road Network + Satellite Noise filters.
```bash
curl -X POST http://localhost:8001/ml/clustering/run \
     -H "Content-Type: application/json" \
     -d '{"video_id": "session_curl_001", "force_recluster": true}'
```

---

## 4. Trigger 3-Year Satellite Aging Fusion
Calculate the NDVI drop/trend (2023-2025) using Google Earth Engine.
```bash
curl -X POST http://localhost:8001/ml/satellite/analyze \
     -H "Content-Type: application/json" \
     -d '{"cluster_id": "REPLACE_WITH_CLUSTER_ID", "coordinates": [77.2090, 28.6139]}'
```

---

## 5. Close the Lifecycle Loop (Mark as Repaired)
Simulate an authority fixing the damage. This triggers a **ML Score Reset**.
```bash
curl -X POST http://localhost:8001/ml/risk/update-status \
     -H "Content-Type: application/json" \
     -d '{"cluster_id": "REPLACE_WITH_CLUSTER_ID", "status": "repaired", "notes": "Fixed."}'
```
### 🧠 System Logic (Closed Loop):
-   **Status = `repaired`**: ML Engine overrides all models and sets **Risk = 0.0** and **Aging = 0.0**.
-   **Status = `in_progress`**: No risk change, but `repair_history` is updated.

---

## 🛡️ 6. Smart Data Masking (Authority Geofencing)
This is handled at the **Query Layer** in the Frontend Controller.
- **City Admin**: Sees all 100% of risks.
- **Zone Officer**: Only sees risks where:
  `{ "geometry": { "$geoWithin": { "$geometry": user_authority_polygon } } }`
- **Contractor**: Only sees risks where:
  `{ "properties.assigned_to_user_id": current_user_id }`

---
*Created by PathFounders Team - 2026*
