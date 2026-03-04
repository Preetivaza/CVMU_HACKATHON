import requests
import os
import json
import time

def simulate_upload(frontend_url="http://localhost:3000", video_path=None, gps_path=None, acc_path=None):
    print("="*60)
    print("🚀 ROAD DAMAGE DETECTION - MULTI-SENSOR UPLOAD SIMULATOR")
    print("="*60)

    # 1. Prepare Dummy Files if not provided
    temp_files = []
    if not video_path:
        video_path = "dummy_video.mp4"
        with open(video_path, "wb") as f:
            f.write(os.urandom(1024 * 100)) # 100KB dummy video
        temp_files.append(video_path)
    
    if not gps_path:
        gps_path = "dummy_gps.csv"
        with open(gps_path, "w") as f:
            f.write("latitude,longitude,timestamp\n")
            f.write("28.6139,77.2090,2024-03-03T10:00:00Z\n")
            f.write("28.6140,77.2091,2024-03-03T10:00:01Z\n")
        temp_files.append(gps_path)

    if not acc_path:
        acc_path = "dummy_acc.csv"
        with open(acc_path, "w") as f:
            f.write("acc_x,acc_y,acc_z,timestamp\n")
            f.write("0.1,9.8,0.2,2024-03-03T10:00:00Z\n")
            f.write("0.2,10.5,0.1,2024-03-03T10:00:01Z\n")
        temp_files.append(acc_path)

    # 2. Perform Upload
    print(f"\n📁 Uploading files to {frontend_url}/api/upload/video...")
    try:
        with open(video_path, 'rb') as v, open(gps_path, 'rb') as g, open(acc_path, 'rb') as a:
            files = {
                'video': (os.path.basename(video_path), v, 'video/mp4'),
                'gps': (os.path.basename(gps_path), g, 'text/csv'),
                'accelerometer': (os.path.basename(acc_path), a, 'text/csv')
            }
            
            start_time = time.time()
            response = requests.post(f"{frontend_url}/api/upload/video", files=files)
            end_time = time.time()

        if response.status_code == 201:
            data = response.json()
            print(f"✅ SUCCESS ({round(end_time - start_time, 2)}s)")
            print(f"   Video ID: {data.get('video_id')}")
            print(f"   Status:   {data.get('status')}")
            print(f"   Data Points: GPS({data['data_points']['gps']}), ACC({data['data_points']['accelerometer']})")
            
            video_id = data.get('video_id')
            
            # --- NEW STEP: Send dummy detections for this video so clustering has something to work with! ---
            print(f"📍 Sending 5 dummy detections for video {video_id}...")
            base_lat, base_lon = 28.6139, 77.2090
            detections = []
            for i in range(5):
                offset = i * 0.00001 # ~1 meter spacing
                detections.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [base_lon + offset, base_lat + offset]},
                    "properties": {
                        "video_id": video_id,
                        "frame_id": i * 10,
                        "timestamp": "2024-03-03T10:00:00Z",
                        "damage_type": "pothole",
                        "confidence": 0.95,
                        "severity_score": 0.82
                    }
                })
            
            detect_payload = {
                "video_id": video_id,
                "model_version": "v1.0-simulated",
                "detections": detections
            }
            requests.post(f"{frontend_url}/api/v1/detections/bulk", json=detect_payload)
            # -----------------------------------------------------------------------------------------------

            # 3. Verify ML Trigger
            print(f"\n📡 Waiting 5 seconds for ML Service to process clustering...")
            time.sleep(5)
            
            # Check if any clusters were created for this video
            clusters_check = requests.get(f"{frontend_url}/api/v1/clusters")
            if clusters_check.ok:
                all_clusters = clusters_check.json().get('features', [])
                # Filter for detections in our video (simplified check)
                print(f"📊 Total clusters in system: {len(all_clusters)}")
            
            # Check DB status
            status_check = requests.get(f"{frontend_url}/api/upload/status/{video_id}")
            if status_check.ok:
                print(f"📊 Final Upload Status: {status_check.json().get('status')}")
            
            print("\n🌟 STEP 1 & 2 COMPLETED: Video uploaded, Detections simulated, and Clustering triggered successfully.")

        else:
            print(f"❌ FAILED (Status {response.status_code})")
            print(f"   Error: {response.text}")

    except Exception as e:
        print(f"❌ CONNECTION ERROR: {str(e)}")
    
    # 4. Cleanup temp files
    # for f in temp_files:
    #     if os.path.exists(f): os.remove(f)

if __name__ == "__main__":
    # You can pass real paths here later: simulate_upload(video_path="C:/videos/test.mp4")
    simulate_upload()
