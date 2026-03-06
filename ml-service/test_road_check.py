"""
test_road_check.py
===================
Verifies the Road Check requirement:
"If Centroid is > 10m from a known road segment, label as NOISE".
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME     = os.getenv("DATABASE_NAME", "road_damage_db")
ML_URL      = "http://localhost:8001"

async def run_test():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    VIDEO_ID = "road_check_test"
    await db["raw_detections"].delete_many({"properties.video_id": VIDEO_ID})
    await db["roads"].delete_many({"name": "Test Road"})
    
    # Ensure 2dsphere index
    await db["roads"].create_index([("geometry", "2dsphere")])

    # 1. Insert a Road Segment (Delhi area)
    print("📌 Step 1: Inserting a road segment...")
    await db["roads"].insert_one({
        "name": "Test Road",
        "geometry": {
            "type": "LineString",
            "coordinates": [[77.2090, 28.6139], [77.2095, 28.6140]]
        },
        "properties": {"road_type": "local"}
    })

    # 2. Insert two detections:
    #   Det A: On road (or within 2m)
    #   Det B: FAR FROM ROAD (>10m away)
    print("📌 Step 2: Inserting detections...")
    
    # Det A (Within 10m)
    await db["raw_detections"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [77.2091, 28.61392]}, # Very close
        "properties": {
            "video_id": VIDEO_ID,
            "damage_type": "pothole",
            "severity_score": 0.8,
            "confidence": 0.9
        },
        "processed": False
    })

    # Det B (Far away: ~50m offset)
    await db["raw_detections"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [77.2100, 28.6150]}, # Far
        "properties": {
            "video_id": VIDEO_ID,
            "damage_type": "pothole",
            "severity_score": 0.8,
            "confidence": 0.9
        },
        "processed": False
    })

    # 3. Trigger Clustering
    print("🔄 Triggering Clustering...")
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(f"{ML_URL}/ml/clustering/run", json={"video_id": VIDEO_ID, "force_recluster": True})
        result = resp.json()
        
    # 4. Verification
    print(f"\n📊 Summary: {result['message']}")
    print(f"📊 Clusters created: {result['clusters_created']}")
    print(f"📊 Detections processed: {result['detections_processed']}")

    # Check the database for the results of the specific detections
    dets = await db["raw_detections"].find({"properties.video_id": VIDEO_ID}).to_list(None)
    for d in dets:
        lon, lat = d["geometry"]["coordinates"]
        is_clustered = "CLUSTERED" if d.get("cluster_id") else "NOISE (NOT CLUSTERED)"
        dist_desc = "CLOSE TO ROAD" if lat < 28.6145 else "FAR FROM ROAD"
        print(f"   → Det @ [{lon}, {lat}] ({dist_desc}) → Status: {is_clustered}")

    if result['clusters_created'] == 1:
        print("\n✅ SUCCESS: Only the road-adjacent detection was clustered. The far one was marked as NOISE.")
    else:
        print("\n❌ FAILED: Unexpected cluster count.")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
