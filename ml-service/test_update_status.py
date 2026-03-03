import httpx
import asyncio
import json

async def test():
    cluster_id = "69a69c65e4dd5d56506d882b"
    url = "http://localhost:8001/ml/risk/update-status"
    payload = {
        "cluster_id": cluster_id,
        "status": "repaired",
        "notes": "Testing via internal script."
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload)
            print(f"Status: {resp.status_code}")
            print(f"Body: {resp.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
