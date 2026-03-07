# 🛣️ Sadaksuraksha: Road Damage Detection & Management System
### *Hackathon Pitch & Technical Deep-Dive Guide*

---

## 🏗️ 1. Project Workflow (The "Closed-Loop" Lifecycle)

Our system transforms simple video detection into a full-scale government management tool.

1.  **Detection (AI Engine)**: 
    A YOLOv8-based model processes road video/dashcam feeds. It generates raw **GeoJSON** detections containing bounding boxes, GPS coordinates, and a severity score (0-1).
    
2.  **Spatial Fusion (ML Clustering)**: 
    Thousands of raw points are processed by a **DBSCAN** algorithm. It fuses overlapping detections into unique "Logical Data Objects" (Clusters). 
    *Example: 50 detection frames of the same pothole are merged into 1 unique Pothole ID.*

3.  **Cross-Validation**:
    *   **Road Network Check**: Uses a `2dsphere` index to ensure the detection is within 10m of a registered road (filters out "ghost" detections in fields/water).
    *   **Satellite Material Check**: Google Earth Engine validates if the surface material is actually asphalt/pavement.

4.  **Satellite Aging Fusion**: 
    The system fetches **3-year NDVI (Vegetation/Moisture) trends** (2023-2025) via Sentinel-2. If a road's moisture retention has increased, it indicates microscopic structural failure, leading to a higher **Risk Score**.

5.  **Governance & Repair**: 
    Authorities (Admins/Contractors) view geofenced data. Once a repair is marked "Completed," the system **resets the Risk & Aging metrics**, closing the management loop.

---

## 📊 2. Mathematical Logic & Formulas

### A. DBSCAN Spatial Clustering (The "Fusion" Radius)
We use the **Haversine Metric** to cluster points in meters on a spherical earth.
$$ \epsilon_{rad} = \frac{Radius_{meters}}{6,371,000} $$
*   **Potholes**: 5m radius (tight clustering).
*   **Cracks**: 12m radius (longitudinal fusion).

### B. Satellite Aging Index (NDVI Trend)
We detect microscopic surface degradation using multispectral satellite data.
$$ NDVI = \frac{NearInfrared (B8) - Red (B4)}{NearInfrared (B8) + Red (B4)} $$

The **Aging Index ($A$)** uses a 3-year temporal gradient ($\Delta NDVI$):
$$ \Delta NDVI = NDVI_{2023} - NDVI_{2025} $$
$$ A = \text{clamp}(0.5 + 2.5 \times \Delta NDVI, 0, 1) $$
*   **Result $A \approx 1$**: Indicates a rapid loss of surface reflectivity and health.
*   **Result $A \approx 0$**: Healthy, stable road surface.

### C. Road Network Proximity Filtering (Geospatial Snapping)
To filter out sensor noise, we validate every cluster centroid ($C$) against the nearest Road Segment LineString ($L$).
$$ dist(C, L) = \min_{P \in L} \| C - P \| $$
*   **Logic**: If $dist(C, L) > 10m \rightarrow$ Cluster is flagged as **Sensor Artifact** and discarded.

### D. Multi-Criteria Risk Scoring (Weighted Fusion)
Final priority is calculated via a dynamic weighted average, shifting focus based on detecting frequency.

**Case 1: Normal Detection ($repeat\_count \le 3$)**
$$ R = (w_s \cdot S) + (w_a \cdot A) $$
*Where $w_s=0.7$ (Severity), $w_a=0.3$ (Aging).*

**Case 2: Persistent Hazard ($repeat\_count > 3$)**
Wait-time and recurring complaints shift the importance towards historical aging.
$$ R = [(w'_{s} \cdot S) + (w'_{a} \cdot A)] + B_{temporal} $$
*Where $w'_s=0.6, w'_a=0.4$ and $B_{temporal}=0.20$ (The "Hackathon Boost").*

---

## 🛡️ 3. Authority-Based Data Masking (Geofencing)
Implementation of **Role-Based Access Control (RBAC)** via MongoDB Geo-Queries:
*   **Zone Officer**: Query uses `$geoWithin` check against their assigned **Ward Polygon**.
*   **State Authority**: Automatic filter for `road_type == 'highway'`.
*   **Contractor**: Only sees clusters where `assigned_to == user_id`.

---

## 🎤 4. Jury Counter-Questions & Winning Answers

### Q1: "Sentinel-2 satellite resolution is 10m per pixel. How can you detect a 0.5m pothole?"
> **Answer**: "We don't use satellite to *detect* the pothole—our AI dashcam does that. We use the satellite for **Regional Contextual Fusion**. We analyze the 10m-30m area around the pothole to check for water logging, moisture retention, and long-term surface degradation. The satellite provides the 'Why' and 'When,' while the AI provides the 'Where.'"

### Q2: "What if the GPS on the mobile/dashcam is inaccurate?"
> **Answer**: "This is why we implemented **DBSCAN Clustering**. A single inaccurate point is ignored as noise. Only when multiple detections 'agree' on a location within our 10m threshold do we form a cluster. We also snap these coordinates to the nearest road network using geospatial indexing to correct GPS drift."

### Q3: "How is your project scalable for the whole country?"
> **Answer**: "We built a **Micro-service Architecture**. Our ML-Service (FastAPI) is decoupled from the Frontend. We use **MongoDB Atlas for Horizontal Scaling** and **Google Earth Engine for Serverless Geospatial Analysis**. This means we can process thousands of wards simultaneously without overloading a single server."

### Q4: "How do you handle duplicate reports of the same pothole by different users?"
> **Answer**: "Our **Temporal Fusion Logic** checks the `last_detected` timestamp. If a detection falls within an existing cluster's radius, we don't create a new task. Instead, we increment the `repeat_count` and boost the Risk Score. This ensures authorities don't get 10 tickets for 1 pothole."

### Q5: "How do you prevent False Positives, like shadows or manhole covers appearing as potholes?"
> **Answer**: "We use **Multi-Modal Validation**. A detection is only promoted to a high-risk cluster if it meets three criteria: (1) Visual confidence from YOLOv8, (2) **Sensor validation** (normalized acceleration 'jerk' from the device), and (3) **Road Proximity**. A shadow in the middle of a park will be automatically discarded by our Geospatial Filter."

### Q6: "Contractor Accountability: Can a contractor just mark it as 'Repaired' without actually fixing it?"
> **Answer**: "Our system has a built-in **Self-Correction Loop**. When a status is changed to 'Repaired', it enters a 'Pending Verification' state. The next time *any* user drives through that coordinate, our AI Engine (Member 1) re-scans the spot. If the pothole is still detected, the system automatically flags a **Compliance Violation** and re-opens the ticket with a Critical priority."

### Q7: "What happens in areas with poor internet connectivity (e.g., rural roads)?"
> **Answer**: "The system uses an **Edge-First Architecture**. The AI model (Member 1) runs locally on the edge device. Detections are queued in a local SQLite database. Once the vehicle reaches a 4G/5G/Wi-Fi zone, the data is synced via our **Bulk Ingestion API**, ensuring no data loss even in remote areas."

Technical Workflow: A step-by-step breakdown of how the AI Engine (Member 1), Data Layer (Member 2), and ML Logic (Member 3) work together as a single ecosystem.
Mathematical Power:
DBSCAN Radians: How we convert meters to spherical coordinates for clustering.
NDVI Trend Formula: The exact logic used to fetch data from Google Earth Engine.
Weighted Risk Fusion: The formulas for Normal Risk vs. Repeat Escalation (The $+20%$ boost logic).
Jury Defense Strategy: I have listed the Top 4 "Killer Questions" judges usually ask (like Satellite Resolution or GPS Drift) and provided high-impact, technical answers to impress them.
---
*Created by PathFounders  Team - Hackathon 2026*
