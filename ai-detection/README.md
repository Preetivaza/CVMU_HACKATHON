# Road Damage Detection — Setup & Usage

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the detection script
python detect_road_damage.py
```

---

## Configuration

Open `detect_road_damage.py` and edit these variables at the top:

```python
# Path to your YOLO model weights
MODEL_PATH = "yolov12s.pt"

# Path to your dashcam video file
VIDEO_PATH = "test_data/your_video.mp4"

# Confidence threshold (0.45 recommended)
CONFIDENCE_THRESHOLD = 0.45

# Set to True to send results directly to the backend API
EXPORT_TO_API = False
NEXTJS_API_URL = "http://localhost:3000/api/v1/detections/bulk"
```

### Changing the Input Video

Replace the `VIDEO_PATH` with the path to your dashcam video:

```python
VIDEO_PATH = "test_data/my_dashcam_footage.mp4"
```

Supported formats: `.mp4`, `.avi`, `.webm`, `.mov`

---

## Output

The script generates a JSON report named `{video_name}_damage_report.json` in the same directory.

The output follows the **GeoJSON Feature** format compatible with the ML-Service backend:

```json
{
    "video_id": "upload_my_video",
    "model_version": "yolov12s",
    "detections": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [72.567, 23.012]
            },
            "properties": {
                "damage_type": "pothole",
                "confidence": 0.85,
                "severity_score": 0.79,
                "vehicle_speed": 52.3,
                ...
            }
        }
    ]
}
```

---

## Files

| File | Purpose |
|---|---|
| `detect_road_damage.py` | Main script — runs YOLO inference, scores damage, outputs JSON |
| `road_simulator.py` | Simulates GPS coordinates along real Ahmedabad roads |
| `roads.json` | Road geometry data (60K+ Ahmedabad roads from OpenStreetMap) |
| `yolov12s.pt` | YOLOv12s model weights (trained on RDD2022 dataset) |
| `requirements.txt` | Python dependencies |

---

## Accelerometer Data (`normalized_acceleration`)

The `normalized_acceleration` field in the output is currently set to `0.0` as a placeholder.

In a real deployment, this value would come from the **phone/dashcam accelerometer sensor** (IoT). When a vehicle hits a pothole, the sensor records a vertical spike (bump).

### To enable simulation:

In `detect_road_damage.py`, there is a commented-out `simulate_acceleration()` function. To enable it:

1. **Uncomment** the `ACCEL_RANGES` dict and `simulate_acceleration()` function (around line 80-100)
2. **Uncomment** this line in the output dict:
   ```python
   # "normalized_acceleration": simulate_acceleration(det["damage_type"]),
   ```
3. **Comment out** or remove the placeholder line:
   ```python
   "normalized_acceleration": 0.0,
   ```

This will simulate realistic acceleration values:
- **Pothole**: 0.6 – 0.9 (strong bump)
- **Crack**: 0.1 – 0.4 (mild vibration)
- **Patch**: 0.05 – 0.15 (slight unevenness)

> In production, replace the simulation with real accelerometer data from the mobile app.
