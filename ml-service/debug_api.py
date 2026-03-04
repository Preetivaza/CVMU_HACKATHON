import httpx
import json

async def check():
    url = "http://localhost:8001/ml/satellite/analyze"
    payload = {
        "cluster_id": "65e49f8a3d5f3a0012345678", # dummy
        "coordinates": [77.2090, 28.6139],
        "radius_meters": 50
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {json.dumps(resp.json(), indent=2)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(check())
