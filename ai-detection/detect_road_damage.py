import cv2
import json
import os
import requests
from datetime import datetime, timedelta
from collections import defaultdict
from ultralytics import YOLO
from road_simulator import RoadSimulator

# ==========================================
# Configuration
# ==========================================

import argparse

parser = argparse.ArgumentParser(description='Run Road Damage Detection')
parser.add_argument('--video', type=str, default="test_data/test3_clear", help='Path to video file')
parser.add_argument('--api_url', type=str, default="http://localhost:3000/api/v1/detections/bulk", help='Next.js API URL')
parser.add_argument('--export', action='store_true', help='Export detections to API')
parser.add_argument('--video_id', type=str, default=None, help='Video ID for the API')
parser.add_argument('--internal_key', type=str, default=None, help='Internal API key for service-to-service auth')
args, unknown = parser.parse_known_args()

MODEL_PATH = "yolov12s.pt"
VIDEO_PATH = args.video
NEXTJS_API_URL = args.api_url
EXPORT_TO_API = args.export
INTERNAL_KEY = args.internal_key

ROADS_JSON_PATH = "roads.json"  # Ahmedabad road data

video_filename = os.path.basename(VIDEO_PATH)
video_basename, _ = os.path.splitext(video_filename)
JSON_OUTPUT_PATH = f"{video_basename}_damage_report.json"
VIDEO_ID = args.video_id if args.video_id else f"upload_{video_basename}"
MODEL_VERSION = "yolov12s"

# 0.45 is a good balance: filters noise but catches real damage
CONFIDENCE_THRESHOLD = 0.45

# ==========================================
# Damage type mapping
# ==========================================
# Maps RDD2022 model classes → ML-Service DamageType enum values
# Enum: pothole | crack | patch | depression | other
SIMPLIFIED_MAPPING = {
    "D00": "crack",          # Longitudinal crack
    "D10": "crack",          # Transverse crack
    "D20": "crack",          # Multiple/alligator cracking
    "D40": "pothole",        # Pothole
    "Repair": "patch"        # Repaired/patched area
}

# Damage type severity weights (higher = more dangerous)
# Note: Our RDD2022 model only outputs: pothole, crack, patch
# "depression" exists in the ML-Service enum but is NOT detected by our model
DAMAGE_TYPE_WEIGHTS = {
    "pothole": 1.0,
    "crack": 0.6,
    "patch": 0.2,
    "other": 0.3, #Just in the case of unseen class that model might detect other than the trained classes (practically it will not happen)
}

def get_simplified_category(original_label):
    for key, val in SIMPLIFIED_MAPPING.items():
        if key.lower() in original_label.lower():
            return val
    return "other"

def get_confidence_level(confidence):
    """Match ML-Service ConfidenceLevel enum: low | medium | high"""
    if confidence < 0.5:
        return "low"
    elif confidence <= 0.8:
        return "medium"
    return "high"

def calculate_severity_score(confidence, bbox_area_ratio, damage_type):
    """
    Severity score on a 0.0 - 1.0 scale (matches ML-Service schema).

    Factors:
      - confidence    (40%) — model certainty
      - damage_type   (35%) — pothole > depression > crack > patch
      - bbox_area     (25%) — larger damage = more severe
    """
    type_weight = DAMAGE_TYPE_WEIGHTS.get(damage_type, 0.3)
    bbox_normalized = min(bbox_area_ratio / 0.15, 1.0)
    raw = (confidence * 0.40) + (type_weight * 0.35) + (bbox_normalized * 0.25)
    return round(raw, 2)  # 0.0 - 1.0 scale


# ── Normalized Acceleration (IoT Accelerometer) ──────────────────
# In a real system, this value comes from the phone/dashcam accelerometer sensor.
# When the vehicle hits a pothole, the sensor records a vertical spike (bump).
# Since we don't have real IoT data, below is a simulation based on damage type.
# Uncomment this function and replace "normalized_acceleration": 0.0 with
# "normalized_acceleration": simulate_acceleration(det["damage_type"]) to enable.
#
# import random
#
# ACCEL_RANGES = {
#     "pothole": (0.6, 0.9),     # Strong bump — car physically drops into the hole
#     "crack":   (0.1, 0.4),     # Mild vibration — rough surface under tires
#     "patch":   (0.05, 0.15),   # Very slight — uneven but repaired surface
#     "other":   (0.0, 0.1),     # Negligible
# }
#
# def simulate_acceleration(damage_type):
#     """
#     Simulates normalized accelerometer reading (0.0 - 1.0) based on damage type.
#     In production, this would come from the phone's accelerometer via the app.
#     """
#     low, high = ACCEL_RANGES.get(damage_type, (0.0, 0.1))
#     return round(random.uniform(low, high), 2)

def main():
    print(f"Loading YOLO model from {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    # ── Initialize Road Simulator (speed determined by road type) ──
    print(f"\nInitializing road simulator from {ROADS_JSON_PATH}...")
    try:
        road_sim = RoadSimulator(ROADS_JSON_PATH)
    except Exception as e:
        print(f"Error loading road simulator: {e}")
        return

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"Error: Could not open video file {VIDEO_PATH}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps:
        fps = 30.0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration = total_frames / fps
    max_drive_time = road_sim.get_total_drive_time()
    print(f"\nVideo: {total_frames} frames, {video_duration:.1f}s at {fps:.0f} FPS")
    print(f"Road: ~{max_drive_time:.0f}s drive ({road_sim.road_name}, "
          f"{road_sim.speed_min}-{road_sim.speed_max} km/h)")

    frame_count = 0
    per_second_detections = defaultdict(list)

    print("\nProcessing video... This might take some time depending on video length.")
    cv2.namedWindow("Video Processing (JSON Export)", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Video Processing (JSON Export)", 960, 540)

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_area = frame_width * frame_height

    start_time = datetime.now()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        timestamp_sec = frame_count / fps
        td = timedelta(seconds=timestamp_sec)
        current_time = start_time + td
        timestamp_str = current_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        second_bucket = int(timestamp_sec)

        # Run inference
        results = model(frame, verbose=False)
        overall_confidence = []

        for result in results:
            boxes = result.boxes
            for box in boxes:
                conf = float(box.conf[0])
                if conf < CONFIDENCE_THRESHOLD:
                    continue

                cls_id = int(box.cls[0])
                original_label = model.names[cls_id]
                damage_type = get_simplified_category(original_label)
                overall_confidence.append(conf)

                # Bounding box
                xyxy = box.xyxy[0].tolist()
                bbox_w = xyxy[2] - xyxy[0]
                bbox_h = xyxy[3] - xyxy[1]
                bbox_area = bbox_w * bbox_h
                bbox_area_ratio = bbox_area / frame_area if frame_area > 0 else 0

                severity = calculate_severity_score(conf, bbox_area_ratio, damage_type)

                # Get realistic road coordinates & speed for this timestamp
                lat, lon, speed_kmh = road_sim.get_position(timestamp_sec)

                detection = {
                    "frame_id": frame_count,
                    "timestamp_sec": timestamp_sec,
                    "timestamp": timestamp_str,
                    "damage_type": damage_type,
                    "confidence": round(conf, 2),
                    "bbox_area_ratio": round(bbox_area_ratio, 4),
                    "severity_score": severity,
                    "confidence_level": get_confidence_level(conf),
                    "lat": lat,
                    "lon": lon,
                    "speed_kmh": speed_kmh,
                }

                per_second_detections[second_bucket].append(detection)

        # Visualization
        annotated_frame = results[0].plot() if len(overall_confidence) > 0 else frame
        cv2.imshow("Video Processing (JSON Export)", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Processing interrupted by user.")
            break

    cap.release()
    cv2.destroyAllWindows()

    # ── Reduce: 1 best detection per damaged second ────────────
    total_raw = sum(len(v) for v in per_second_detections.values())
    secs_with_damage = len(per_second_detections)
    total_video_secs = int(video_duration)
    print(f"\nRaw detections: {total_raw} across {secs_with_damage} seconds "
          f"(out of {total_video_secs}s video — {total_video_secs - secs_with_damage}s had no damage)")

    best_per_second = []
    for sec in sorted(per_second_detections.keys()):
        detections_in_sec = per_second_detections[sec]
        if not detections_in_sec:
            continue
        best = max(detections_in_sec, key=lambda d: (d["severity_score"], d["confidence"]))
        best_per_second.append(best)

    print(f"After reduction: {len(best_per_second)} detections (1 best per damaged second)")

    # ── Build GeoJSON output (matches ML-Service DetectionsBulkRequest) ──
    video_id = VIDEO_ID
    all_detections = []
    for det in best_per_second:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [det["lon"], det["lat"]]  # [longitude, latitude]
            },
            "properties": {
                "video_id": video_id,
                "frame_id": det["frame_id"],
                "timestamp": det["timestamp"],
                "damage_type": det["damage_type"],
                "confidence": det["confidence"],
                "bbox_area_ratio": det["bbox_area_ratio"],
                "normalized_acceleration": 0.0,
                # "normalized_acceleration": simulate_acceleration(det["damage_type"]),
                "severity_score": det["severity_score"],
                "confidence_level": det["confidence_level"],
                "vehicle_speed": det["speed_kmh"],
                "possible_duplicate": False,
                "model_version": MODEL_VERSION
            }
        }
        all_detections.append(feature)

    final_payload = {
        "video_id": video_id,
        "model_version": MODEL_VERSION,
        "detections": all_detections
    }

    # Save JSON report
    print(f"\nSaving JSON report to {JSON_OUTPUT_PATH}...")
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_payload, f, indent=4)

    print(f"Report saved! {len(all_detections)} detections (1 per damaged second).")

    # Print summary
    if all_detections:
        coords = [f["geometry"]["coordinates"] for f in all_detections]
        lats = [c[1] for c in coords]
        lons = [c[0] for c in coords]
        speeds = [f["properties"]["vehicle_speed"] for f in all_detections]
        scores = [f["properties"]["severity_score"] for f in all_detections]
        types = defaultdict(int)
        for f in all_detections:
            types[f["properties"]["damage_type"]] += 1

        print(f"\n--- Summary ---")
        print(f"  Coordinates: ({min(lats):.6f}, {min(lons):.6f}) → ({max(lats):.6f}, {max(lons):.6f})")
        print(f"  Speed range: {min(speeds):.0f} - {max(speeds):.0f} km/h")
        print(f"  Severity range: {min(scores)} - {max(scores)} (0-1 scale)")
        print(f"  Damage types: {dict(types)}")

    if EXPORT_TO_API:
        try:
            print(f"\nUploading to {NEXTJS_API_URL}...")
            headers = {'Content-Type': 'application/json'}
            if INTERNAL_KEY:
                headers['Authorization'] = f"Bearer {INTERNAL_KEY}"
            response = requests.post(NEXTJS_API_URL, json=final_payload, headers=headers)
            if response.status_code in (200, 201):
                print(f"Uploaded successfully! {response.json().get('inserted_count', 0)} detections stored.")
                # Delete local JSON file after successful upload
                try:
                    os.remove(JSON_OUTPUT_PATH)
                    print(f"Deleted local file: {JSON_OUTPUT_PATH}")
                except OSError as e:
                    print(f"Warning: Could not delete {JSON_OUTPUT_PATH}: {e}")
            else:
                print(f"Failed to upload. Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print(f"Error during API upload: {e}")


if __name__ == "__main__":
    main()
