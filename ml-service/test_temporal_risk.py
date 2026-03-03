"""
test_temporal_risk.py
======================
Verifies the Temporal Check logic:
1. Day 1: Insert detection at Loc A → Should create Cluster 1 (Risk X).
2. Day 2: Insert detection at Loc A → Should update Cluster 1 (Risk X * 1.2).
3. Verify the final risk score.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME     = os.getenv("DATABASE_NAME", "RoadDamageDetaction")
ML_URL      = "http://localhost:8001"

async def run_test():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    # Clean up old test data
    VIDEO_ID = "temporal_test_video"
    await db["raw_detections"].delete_many({"properties.video_id": VIDEO_ID})
    await db["clusters"].delete_many({"properties.video_id": VIDEO_ID})
    
    # 1. Day 1 Detection
    day1 = datetime.utcnow() - timedelta(days=2)
    print(f"📌 Step 1: Inserting detection for Day 1 ({day1.date()})...")
    
    await db["raw_detections"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [77.5, 28.5]},
        "properties": {
            "video_id": VIDEO_ID,
            "damage_type": "pothole",
            "severity_score": 0.5,
            "confidence": 0.9,
            "timestamp": day1
        },
        "processed": False
    })
    
    # Run clustering for Day 1
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(f"{ML_URL}/ml/clustering/run", json={"video_id": VIDEO_ID, "force_recluster": True})
        summary = resp.json().get("pothole_summary", [])
        if not summary:
            print(f"❌ ERROR: Day 1 response empty: {resp.text}")
            client.close()
            return
        day1_risk = summary[0]["final_risk_score"]
        print(f"   → Day 1 Risk Score: {day1_risk}")

    # 2. Day 2 Detection (Same Location)
    day2 = datetime.utcnow()
    print(f"\n📌 Step 2: Inserting detection for Day 2 ({day2.date()}) at same location...")
    
    await db["raw_detections"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [77.5, 28.5]},
        "properties": {
            "video_id": VIDEO_ID,
            "damage_type": "pothole",
            "severity_score": 0.5,
            "confidence": 0.9,
            "timestamp": day2
        },
        "processed": False
    })
    
    # Run clustering for Day 2
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(f"{ML_URL}/ml/clustering/run", json={"video_id": VIDEO_ID, "force_recluster": True})
        summary = resp.json().get("pothole_summary", [])
        if summary:
            print(f"\n✅ Step 4 OUTPUT (Pothole Summary Sample):")
            print(json.dumps(summary[0], indent=2))
            day2_risk = summary[0]["final_risk_score"]
            print(f"\n   → Day 2 Risk Score: {day2_risk}")
        else:
            print("\n❌ FAILED: No pothole summary in response.")
            day2_risk = 0

    # 3. Verification
    # Expected: day2_risk should be approx day1_risk * 1.2
    # Formula: 0.7 * 0.5 + 0.3 * 0.5 = 0.5. 
    # Boosted: 0.5 * 1.2 = 0.6.
    
    if day2_risk > day1_risk:
        print(f"\n✅ SUCCESS: Risk increased from {day1_risk} to {day2_risk} (+{round((day2_risk/day1_risk - 1)*100)}%)")
    else:
        print(f"\n❌ FAILED: Risk did not increase. ({day1_risk} -> {day2_risk})")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
