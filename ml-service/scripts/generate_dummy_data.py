import random
import uuid
import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import numpy as np

# Configuration
MONGODB_URI = "mongodb://localhost:27017/road_damage_db"
DATABASE_NAME = "road_damage_db"
VIDEO_COUNT = 3
DETECTIONS_PER_VIDEO = 50

# Center coordinates (Delhi area)
CENTER_LAT = 28.6139
CENTER_LON = 77.2090
SPREAD = 0.05  # roughly 5km

DAMAGE_TYPES = ["pothole", "crack", "patch", "depression", "other"]
CONFIDENCE_LEVELS = ["low", "medium", "high"]

async def generate_dummy_data():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    # Collections
    videos_col = db["video_uploads"]
    detections_col = db["raw_detections"]
    clusters_col = db["clusters"]
    
    print("Cleaning up old dummy data...")
    # Optional: Clear existing data for a fresh start
    # await videos_col.delete_many({})
    # await detections_col.delete_many({})
    # await clusters_col.delete_many({})
    
    print(f"Generating {VIDEO_COUNT} videos and {VIDEO_COUNT * DETECTIONS_PER_VIDEO} detections...")
    
    for i in range(VIDEO_COUNT):
        video_id = f"vid_{uuid.uuid4().hex[:8]}"
        
        # Create video upload
        video_doc = {
            "video_id": video_id,
            "original_filename": f"road_survey_{i+1}.mp4",
            "storage_path": f"/uploads/{video_id}.mp4",
            "file_size": random.randint(10000000, 50000000),
            "duration_seconds": random.randint(60, 300),
            "fps": 30,
            "status": "completed",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 7)),
            "updated_at": datetime.utcnow(),
            "processing_result": {
                "detections_count": DETECTIONS_PER_VIDEO
            }
        }
        await videos_col.insert_one(video_doc)
        
        # Create hot-spots (damage clusters) to make DBSCAN work well
        hot_spots = []
        for _ in range(5):
            hot_spots.append((
                CENTER_LAT + random.uniform(-SPREAD, SPREAD),
                CENTER_LON + random.uniform(-SPREAD, SPREAD)
            ))
            
        detections = []
        for j in range(DETECTIONS_PER_VIDEO):
            # 80% chance to be near a hot-spot, 20% noise
            if random.random() < 0.8:
                spot = random.choice(hot_spots)
                lat = spot[0] + random.uniform(-0.0001, 0.0001)
                lon = spot[1] + random.uniform(-0.0001, 0.0001)
            else:
                lat = CENTER_LAT + random.uniform(-SPREAD, SPREAD)
                lon = CENTER_LON + random.uniform(-SPREAD, SPREAD)
                
            damage_type = random.choice(DAMAGE_TYPES)
            confidence = random.uniform(0.4, 0.98)
            
            det_doc = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]  # [longitude, latitude]
                },
                "properties": {
                    "video_id": video_id,
                    "frame_id": j * 10,
                    "timestamp": datetime.utcnow() - timedelta(minutes=random.randint(0, 100)),
                    "damage_type": damage_type,
                    "confidence": confidence,
                    "bbox_area_ratio": random.uniform(0.01, 0.2),
                    "normalized_acceleration": random.uniform(0.1, 0.9),
                    "severity_score": confidence * random.uniform(0.5, 1.0),
                    "confidence_level": "high" if confidence > 0.8 else ("medium" if confidence > 0.5 else "low"),
                    "vehicle_speed": random.randint(20, 60),
                    "possible_duplicate": False,
                    "model_version": "v1.0.0-dummy"
                },
                "cluster_id": None,
                "processed": False,
                "created_at": datetime.utcnow()
            }
            detections.append(det_doc)
            
        await detections_col.insert_many(detections)
        print(f"Inserted {DETECTIONS_PER_VIDEO} detections for video {video_id}")

    print("Dummy data generation complete!")
    print("\nYou can now trigger clustering by running the ML service and calling:")
    print("POST http://localhost:8000/ml/clustering/run with {'force_recluster': true}")

if __name__ == "__main__":
    asyncio.run(generate_dummy_data())
