"""
test_aging_fusion.py
======================
Verifies the 3-Year Satellite Aging Fusion logic:
1. Fetch 3-year NDVI trend from GEE (2023, 2024, 2025).
2. Compute Aging Index based on NDVI drop.
3. Apply 0.7*Vision + 0.3*Aging formula.
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
    
    # Let's find a real cluster or create a dummy one for analysis
    # Coordinates for a road segment in Delhi
    COORD = [77.2090, 28.6139]
    
    print("📌 Step 1: Creating a test cluster for satellite fusion...")
    cluster_res = await db["clusters"].insert_one({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": COORD},
        "properties": {
            "damage_type": "pothole",
            "avg_severity": 0.6,
            "avg_confidence": 0.9,
            "repeat_count": 1,
            "aging_index": None,
            "final_risk_score": 0.42 # 0.7 * 0.6 + 0.3 * 0 (placeholder)
        }
    })
    cluster_id = str(cluster_res.inserted_id)
    print(f"   → Cluster ID: {cluster_id}")

    # 2. Trigger Satellite Analysis
    print("\n📌 Step 2: Triggering 3-year NDVI Trend Analysis...")
    async with httpx.AsyncClient(timeout=60) as http_client:
        # Note: /ml/satellite/analyze is the typical endpoint based on previous work
        # but let's check routers in main.py if needed. 
        # Actually my satellite_service has run_satellite_analysis
        # Routers: app.include_router(satellite.router, prefix="/ml/satellite", ...)
        
        resp = await http_client.post(
            f"{ML_URL}/ml/satellite/analyze", 
            json={"cluster_id": cluster_id, "coordinates": COORD}
        )
        
        if resp.status_code != 200:
            print(f"❌ Error: {resp.text}")
            return

        data = resp.json()
        print(f"✅ Analysis Completed:")
        print(f"   → Trend (2023-2025): {json.dumps(data.get('trend'), indent=2)}")
        print(f"   → Aging Index Calculated: {data.get('aging_index')}")

        # 3. Verify Risk Re-calculation
        # The service should have recalculated the risk score
        updated_cluster = await db["clusters"].find_one({"_id": cluster_res.inserted_id})
        new_risk = updated_cluster["properties"]["final_risk_score"]
        aging = updated_cluster["properties"]["aging_index"]
        severity = updated_cluster["properties"]["avg_severity"]
        
        # Expected: 0.7 * 0.6 + 0.3 * aging
        expected_risk = round(0.7 * severity + 0.3 * aging, 4)
        
        print(f"\n📊 Risk Fusion Audit:")
        print(f"   → Vision Severity: {severity}")
        print(f"   → Satellite Aging: {aging}")
        print(f"   → Final Risk Score: {new_risk} (Expected: {expected_risk})")
        
        if abs(new_risk - expected_risk) < 0.01:
            print("\n✅ SUCCESS: Satellite Aging accurately fused into Risk Score.")
        else:
            print("\n❌ FAILED: Risk Score mismatch.")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
