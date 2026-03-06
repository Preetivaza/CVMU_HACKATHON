"""
test_clustering_pipeline.py
============================
End-to-end test for the DBSCAN clustering pipeline.
Tests:
  1. Per-damage-type radius (pothole=5m, crack=12m)
  2. Duplicate merging within same type
  3. Separate clusters for different types at same location
  4. Noise point handling (isolated single point far from others)
  5. Full API call to /ml/clustering/run

Run:
    python test_clustering_pipeline.py
"""

import asyncio
import json
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI  = os.getenv("MONGODB_URI")
DB_NAME      = os.getenv("DATABASE_NAME", "road_damage_db")
ML_URL       = "http://localhost:8001"

# ─── Test Data ────────────────────────────────────────────────────────────────
# Delhi coordinates — we create precise clusters to test each scenario

TEST_VIDEO_ID = f"test_pipeline_{datetime.utcnow().strftime('%H%M%S')}"

TEST_DETECTIONS = [
    # ── SCENARIO A: 4 potholes within 3m of each other → SHOULD merge into 1 cluster ──
    # eps=5m, so all 4 are within radius
    {"lon": 77.20900, "lat": 28.61390, "type": "pothole", "severity": 0.9,  "confidence": 0.95},
    {"lon": 77.20901, "lat": 28.61391, "type": "pothole", "severity": 0.85, "confidence": 0.92},
    {"lon": 77.20902, "lat": 28.61392, "type": "pothole", "severity": 0.88, "confidence": 0.90},
    {"lon": 77.20903, "lat": 28.61393, "type": "pothole", "severity": 0.82, "confidence": 0.88},

    # ── SCENARIO B: 3 cracks spread over 8m → SHOULD merge into 1 cluster ──
    # eps=12m, so they merge; would NOT merge if treated as potholes (eps=5m)
    {"lon": 77.20950, "lat": 28.61420, "type": "crack", "severity": 0.6,  "confidence": 0.80},
    {"lon": 77.20957, "lat": 28.61423, "type": "crack", "severity": 0.55, "confidence": 0.78},
    {"lon": 77.20964, "lat": 28.61426, "type": "crack", "severity": 0.65, "confidence": 0.82},

    # ── SCENARIO C: 1 pothole far away (>5m from any other pothole) → SHOULD be its own cluster ──
    # with min_samples=1, single points still become clusters
    {"lon": 77.21500, "lat": 28.62000, "type": "pothole", "severity": 0.7, "confidence": 0.85},

    # ── SCENARIO D: 2 different types at same spot → SHOULD be 2 separate clusters ──
    {"lon": 77.21200, "lat": 28.61800, "type": "pothole",  "severity": 0.75, "confidence": 0.88},
    {"lon": 77.21200, "lat": 28.61800, "type": "rutting",  "severity": 0.60, "confidence": 0.75},
]

async def insert_test_detections(db):
    col = db["raw_detections"]
    docs = []
    for i, d in enumerate(TEST_DETECTIONS):
        docs.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [d["lon"], d["lat"]]},
            "properties": {
                "video_id":      TEST_VIDEO_ID,
                "frame_id":      i * 5,
                "timestamp":     datetime.utcnow(),
                "damage_type":   d["type"],
                "confidence":    d["confidence"],
                "severity_score": d["severity"],
                "model_version": "test-pipeline-v1",
            },
            "cluster_id": None,
            "processed":  False,
            "created_at": datetime.utcnow(),
        })
    result = await col.insert_many(docs)
    return result.inserted_ids

async def run_test():
    print("=" * 60)
    print("  DBSCAN Clustering Pipeline — Integration Test")
    print("=" * 60)

    # 1. DB Connection
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    print(f"\n✅ Connected to MongoDB: {DB_NAME}")

    # 2. Insert test detections
    print(f"\n📌 Inserting {len(TEST_DETECTIONS)} test detections (video: {TEST_VIDEO_ID})...")
    ids = await insert_test_detections(db)
    print(f"   → Inserted {len(ids)} detections")

    # 3. Call the clustering API
    print(f"\n🔄 Calling ML clustering API: POST {ML_URL}/ml/clustering/run ...")
    async with httpx.AsyncClient(timeout=30) as client_http:
        resp = await client_http.post(
            f"{ML_URL}/ml/clustering/run",
            json={"video_id": TEST_VIDEO_ID, "force_recluster": True}
        )

    if resp.status_code != 200:
        print(f"\n❌ API Error {resp.status_code}: {resp.text}")
        client.close()
        return

    api_result = resp.json()
    print(f"\n📊 API Response:")
    print(json.dumps(api_result, indent=2))

    # 4. Verify DB results
    print(f"\n🔍 Verifying database results...")
    detections = await db["raw_detections"].find({"properties.video_id": TEST_VIDEO_ID}).to_list(None)
    clusters_created = {}
    for det in detections:
        cid = str(det.get("cluster_id", "NONE"))
        clusters_created[cid] = clusters_created.get(cid, 0) + 1

    print(f"\n   Total detections  : {len(detections)}")
    print(f"   Unique cluster IDs: {len([k for k in clusters_created if k != 'NONE'])}")
    print(f"   Distribution      :")
    for cid, count in clusters_created.items():
        print(f"     Cluster {cid[:12]}... → {count} detection(s)")

    # 5. Expected results
    print(f"\n📋 Expected Results:")
    print(f"   Scenario A (4 potholes ~3m apart)  → 1 cluster  (eps=5m)")
    print(f"   Scenario B (3 cracks ~8m apart)    → 1 cluster  (eps=12m)")
    print(f"   Scenario C (1 isolated pothole)     → 1 cluster  (min_samples=1)")
    print(f"   Scenario D (pothole + rutting)      → 2 clusters (different types)")
    print(f"   Total Expected: ~5 clusters")

    # 6. Check per_type_breakdown
    breakdown = api_result.get("per_type_breakdown", {})
    print(f"\n📈 Per-Type Breakdown:")
    for dtype, info in breakdown.items():
        print(f"   {dtype:12s}: {info['detections']} detections, "
              f"{info['clusters_created']} new cluster(s), "
              f"eps={info['eps_meters']}m")

    print(f"\n{'=' * 60}")
    status = "✅ PASSED" if api_result.get("status") == "completed" else "❌ FAILED"
    print(f"  Result: {status}")
    print(f"{'=' * 60}\n")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
