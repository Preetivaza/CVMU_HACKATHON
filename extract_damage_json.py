import cv2
import json
import os
from datetime import timedelta
from ultralytics import YOLO

# ==========================================
# Configuration
# ==========================================

MODEL_PATH = "best.pt"
VIDEO_PATH = "test5.mp4" # Replace with your dashcam video file path

video_filename = os.path.basename(VIDEO_PATH)
video_basename, _ = os.path.splitext(video_filename)
JSON_OUTPUT_PATH = f"{video_basename}_damage_report.json"

CONFIDENCE_THRESHOLD = 0.30

# Map original RDD2022 classes to simplified categories for severity calculation
# We will still output the original D00/D10/etc. in the JSON conditions.
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
    return "Unknown"

def calculate_severity_and_score(conditions, confidences):
    """
    Logically calculates a numerical damage score and a categorical severity.
    Uses simplified categories.
    """
    # Count simplified categories based on the original condition keys
    simplified_counts = {"Pothole": 0, "Multiple Crack": 0, "Crack": 0, "Repaired": 0}
    simplified_confs = {"Pothole": [], "Multiple Crack": [], "Crack": [], "Repaired": []}
    
    for orig_label, count in conditions.items():
        cat = get_simplified_category(orig_label)
        if cat in simplified_counts:
            simplified_counts[cat] += count
            
            # Extract confidences for this category from the confidences dict
            if orig_label in confidences:
                simplified_confs[cat].extend(confidences[orig_label])
                
    pothole_count = simplified_counts["Pothole"]
    mc_count = simplified_counts["Multiple Crack"]
    crack_count = simplified_counts["Crack"]
    repaired_count = simplified_counts["Repaired"]
    
    # Calculate numerical score weighted by cumulative confidences
    # Base weights: Pothole(10.0), Multiple Crack(5.0), Crack(2.0)
    pothole_score = sum(simplified_confs["Pothole"]) * 10.0
    mc_score = sum(simplified_confs["Multiple Crack"]) * 5.0
    crack_score = sum(simplified_confs["Crack"]) * 2.0
    
    damage_score = pothole_score + mc_score + crack_score
    
    # Severity logic categorization
    if pothole_count >= 1 or mc_count >= 2:
        severity = "Critical"
    elif mc_count == 1 or crack_count >= 3:
        severity = "High"
    elif crack_count >= 1:
        severity = "Medium"
    elif repaired_count >= 1:
        severity = "Low"
    else:
        severity = "None"
        
    return severity, round(damage_score, 2)

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

    video_id = os.path.basename(VIDEO_PATH)
    frame_count = 0
    all_reports = []
    
    print("Processing video... This might take some time depending on video length.")
    cv2.namedWindow("Video Processing (JSON Export)", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Video Processing (JSON Export)", 960, 540)
    
    current_second = -1
    best_frame_in_sec = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        timestamp_sec = frame_count / fps
        sec_idx = int(timestamp_sec)
        
        # If we entered a new second, save the best frame from the previous second
        if sec_idx > current_second:
            if best_frame_in_sec is not None:
                # Filter out low damage / low confidence frames entirely
                if best_frame_in_sec["severity"] not in ["None", "Low"] and best_frame_in_sec["damage_score"] > 0:
                    all_reports.append(best_frame_in_sec)
                    if best_frame_in_sec["severity"] in ["Critical", "High", "Medium"]:
                        print(f"[{best_frame_in_sec['timestamp']}] Logged {best_frame_in_sec['severity']} frame. Score: {best_frame_in_sec['damage_score']}")
            
            # Reset for the new second
            current_second = sec_idx
            best_frame_in_sec = None
            
        # Format string to slice milliseconds correctly
        td = timedelta(seconds=timestamp_sec)
        timestamp_str = str(td)
        if '.' in timestamp_str:
            timestamp_str = timestamp_str[:-3]
        else:
            timestamp_str += ".000"
            
        # Run inference
        results = model(frame, verbose=False)
        
        conditions = {}
        confidences = {}
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
                
                # Keep original labels like D00, D10
                if original_label not in conditions:
                    conditions[original_label] = 0
                    confidences[original_label] = []
                    
                conditions[original_label] += 1
                confidences[original_label].append(conf)
                overall_confidence.append(conf)
        
        # Evaluate if this frame is worth considering
        if len(overall_confidence) > 0:
            severity, damage_score = calculate_severity_and_score(conditions, confidences)
            avg_confidence = sum(overall_confidence) / len(overall_confidence)
            
            frame_report = {
                "video_id": video_id,
                "frame_id": frame_count,
                "timestamp": timestamp_str,
                "conditions": conditions, # Now uses original labels (e.g., D00)
                "severity": severity,
                "damage_score": damage_score,
                "confidence_level": round(avg_confidence, 2)
            }
            
            # Update best frame for this second if it has a higher score
            if best_frame_in_sec is None or damage_score > best_frame_in_sec["damage_score"]:
                best_frame_in_sec = frame_report

        # Visualization for processing (show boxes if any)
        annotated_frame = results[0].plot() if len(overall_confidence) > 0 else frame
        cv2.imshow("Video Processing (JSON Export)", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Processing interrupted by user.")
            break

    # Handle the very last second
    if best_frame_in_sec is not None:
        if best_frame_in_sec["severity"] not in ["None", "Low"] and best_frame_in_sec["damage_score"] > 0:
            all_reports.append(best_frame_in_sec)

    # Release video resources
    cap.release()
    cv2.destroyAllWindows()
    
    # Save JSON report before starting pipeline handoffs
    print(f"\nVideo processing finished. Saving JSON report to {JSON_OUTPUT_PATH}...")
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_reports, f, indent=4)
        
    print(f"Report successfully saved! Documented conditions in {len(all_reports)} intervals.")
    

if __name__ == "__main__":
    main()
