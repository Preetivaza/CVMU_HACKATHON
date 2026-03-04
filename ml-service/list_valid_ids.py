import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def list_ids():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    db = client[os.getenv("DATABASE_NAME", "RoadDamageDetaction")]
    print("\n--- VALID CLUSTER IDs IN YOUR DB ---")
    async for cluster in db.clusters.find({}, {"_id": 1}).limit(10):
        print(f"ID: {cluster['_id']}")
    print("------------------------------------\n")
    client.close()

if __name__ == "__main__":
    asyncio.run(list_ids())
