import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    db = client[os.getenv("DATABASE_NAME", "road_damage_db")]
    rc = await db.roads.count_documents({})
    cc = await db.clusters.count_documents({})
    print(f"ROADS: {rc}")
    print(f"CLUSTERS: {cc}")
    
    if cc == 0:
        # Check if satellite is failing
        raw = await db.raw_detections.find_one({"processed": False})
        if raw:
            print(f"Pending Detections: {raw['geometry']['coordinates']}")

if __name__ == "__main__":
    asyncio.run(main())
