"""
test_repair_lifecycle.py
=========================
Verifies the "Closing the Loop" requirement:
1. Create a cluster with high risk and aging.
2. Mark it as 'repaired'.
3. Verify risk falls to 0.0 and aging resets.
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
    
    print("📌 Step 1: Creating a high-risk cluster...")
    cluster_res = await db["clusters"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [77.123, 28.123]},
        "properties": {
            "damage_type": "pothole",
            "avg_severity": 0.8,
            "aging_index": 0.9,
            "repeat_count": 5,
            "final_risk_score": 0.85,
            "status": "pending",
            "repair_history": []
        }
    })
    cluster_id = str(cluster_res.inserted_id)
    print(f"   → Cluster ID: {cluster_id}")

    # 2. Trigger Repair Update
    print("\n📌 Step 2: Marking cluster as 'repaired' via ML service...")
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            f"{ML_URL}/ml/risk/update-status", 
            json={
                "cluster_id": cluster_id, 
                "status": "repaired",
                "notes": "Pothole filled with asphalt mix."
            }
        )
        
        if resp.status_code != 200:
            print(f"❌ Error: {resp.text}")
            return

        print(f"✅ Status updated successfully.")

    # 3. Verification
    print("\n📌 Step 3: Verifying risk and aging reset...")
    updated_cluster = await db["clusters"].find_one({"_id": cluster_res.inserted_id})
    props = updated_cluster["properties"]
    
    print(f"   → New Status: {props['status']}")
    print(f"   → New Aging Index: {props['aging_index']}")
    print(f"   → New Risk Score: {props['final_risk_score']}")
    print(f"   → History Count: {len(props['repair_history'])}")

    if props['status'] == 'repaired' and props['final_risk_score'] == 0.0 and props['aging_index'] == 0.0:
        print("\n✅ SUCCESS: Lifecycle loop closed. Problem solved!")
    else:
        print("\n❌ FAILED: Values did not reset correctly.")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
