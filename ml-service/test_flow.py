import asyncio
import httpx
import json

async def trigger():
    url_bulk = "http://localhost:8001/api/v1/detections/bulk"
    payload_bulk = {
        "video_id": "session_test_99",
        "model_version": "v1",
        "detections": [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [77.2090, 28.6139]},
            "properties": {
                "damage_type": "pothole",
                "confidence": 0.95,
                "bbox_area_ratio": 0.15,
                "normalized_acceleration": 0.4,
                "severity_score": 0.8
            }
        }]
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Bulk Insert
        r1 = await client.post(url_bulk, json=payload_bulk)
        print(f"Bulk Insert: {r1.status_code} - {r1.text}")
        
        # 2. Trigger Clustering
        url_cluster = "http://localhost:8001/ml/clustering/run"
        r2 = await client.post(url_cluster, json={"video_id": "session_test_99", "force_recluster": True})
        print(f"Clustering: {r2.status_code}")
        data = r2.json()
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(trigger())
