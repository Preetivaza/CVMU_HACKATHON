import cv2
import json
import os
import requests
from datetime import datetime, timedelta
from ultralytics import YOLO

# ==========================================
# Configuration
# ==========================================

MODEL_PATH = "best.pt"
VIDEO_PATH = "test5.mp4" # Replace with your dashcam video file path
NEXTJS_API_URL = "http://localhost:3000/api/v1/detections/bulk"
API_KEY = "member1-secret-key"
EXPORT_TO_API = False # Set to True to send to the backend directly

video_filename = os.path.basename(VIDEO_PATH)
video_basename, _ = os.path.splitext(video_filename)
JSON_OUTPUT_PATH = f"{video_basename}_damage_report.json"
# We simulate a video ID here
VIDEO_ID = f"upload_{video_basename}"

CONFIDENCE_THRESHOLD = 0.30

# Map original RDD2022 classes to standardized damage types
# Standard types: pothole | crack | patch | depression | other
SIMPLIFIED_MAPPING = {
    "D00": "crack",
    "D10": "crack",
    "D20": "crack", # Multiple crack falls under crack
    "D40": "pothole",
    "Repair": "patch"
}
SIMPLIFIED_MAPPING = {
    "D00": "Crack",
    "D10": "Crack",
    "D20": "Multiple Crack",
    "D40": "Pothole",
    "Repair": "Repaired"
}

def get_simplified_category(original_label):
    for key, val in SIMPLIFIED_MAPPING.items():
        if key.lower() in original_label.lower():
            return val
    return "other"

def get_confidence_level(confidence):
    if confidence < 0.5:
        return "low"
    elif confidence <= 0.8:
        return "medium"
    return "high"

def calculate_severity_score(confidence, bbox_area_ratio, acc=0.0):
    # Member 1 formula: confidence × bbox_area_ratio × (0.5 + normalized_acceleration × 0.5)
    return round(confidence * bbox_area_ratio * (0.5 + acc * 0.5), 2)


def main():
    print(f"Loading YOLO model from {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"Error: Could not open video file {VIDEO_PATH}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps:
        fps = 30.0

    video_id = VIDEO_ID
    frame_count = 0
    all_detections = []
    
    print("Processing video... This might take some time depending on video length.")
    cv2.namedWindow("Video Processing (JSON Export)", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Video Processing (JSON Export)", 960, 540)
    
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_area = frame_width * frame_height
    
    # Fake start time for real ISO timestamps
    start_time = datetime.now()

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        timestamp_sec = frame_count / fps
        td = timedelta(seconds=timestamp_sec)
        
        # Real timestamp for Next.js API
        current_time = start_time + td
        timestamp_str = current_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Run inference
        results = model(frame, verbose=False)
        overall_confidence = []
        
        # Process detections for current frame
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
                
                # Bounding box coordinates
                xyxy = box.xyxy[0].tolist()
                bbox_w = xyxy[2] - xyxy[0]
                bbox_h = xyxy[3] - xyxy[1]
                bbox_area = bbox_w * bbox_h
                bbox_area_ratio = bbox_area / frame_area if frame_area > 0 else 0
                
                # Assume a fixed GPS and mock acceleration since dashcam GPS is missing in script
                # In a real scenario, this would correspond to matched GPS coordinates from the telemetry file
                mock_lon = 77.2090 + (frame_count * 0.00001)
                mock_lat = 28.6139 + (frame_count * 0.00001)
                
                score = calculate_severity_score(conf, bbox_area_ratio, 0.0)
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(mock_lon, 6), round(mock_lat, 6)]
                    },
                    "properties": {
                        "frame_id": frame_count,
                        "timestamp": timestamp_str,
                        "damage_type": damage_type,
                        "confidence": round(conf, 2),
                        "bbox_area_ratio": round(bbox_area_ratio, 4),
                        "normalized_acceleration": 0.0,
                        "severity_score": score,
                        "confidence_level": get_confidence_level(conf),
                        "vehicle_speed": 40,
                        "possible_duplicate": False,
                        "model_version": "yolov8_v1"
                    }
                }
                
                all_detections.append(feature)

        # Visualization for processing (show boxes if any)
        annotated_frame = results[0].plot() if len(overall_confidence) > 0 else frame
        cv2.imshow("Video Processing (JSON Export)", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Processing interrupted by user.")
            break

    # Format final payload according to Contract Phase 2
    final_payload = {
        "video_id": VIDEO_ID,
        "model_version": "yolov8_v1",
        "detections": all_detections
    }
    
    # Save JSON report before starting pipeline handoffs
    print(f"\nVideo processing finished. Saving JSON report to {JSON_OUTPUT_PATH}...")
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_payload, f, indent=4)
        
    print(f"Report successfully saved! Documented {len(all_detections)} distinct detections.")
    
    if EXPORT_TO_API:
        try:
            print(f"Uploading to {NEXTJS_API_URL}...")
            headers = {"Content-Type": "application/json", "x-api-key": API_KEY}
            response = requests.post(NEXTJS_API_URL, json=final_payload, headers=headers)
            if response.status_code in [200, 201]:
                print("Uploaded successfully!")
            else:
                print(f"Failed to upload. Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print(f"Error during API upload: {e}")
    

if __name__ == "__main__":
    main()
