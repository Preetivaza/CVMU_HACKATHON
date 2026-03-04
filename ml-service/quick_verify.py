import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DATABASE_NAME", "RoadDamageDetaction")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    raw_count = await db['raw_detections'].count_documents({})
    cluster_count = await db['clusters'].count_documents({})
    road_count = await db['roads'].count_documents({})
    
    unprocessed = await db['raw_detections'].count_documents({"processed": False})
    
    print("-" * 30)
    print(f"DATABASE: {db_name}")
    print(f"Roads:           {road_count}")
    print(f"Raw Detections:  {raw_count} ({unprocessed} unprocessed)")
    print(f"Clusters:        {cluster_count}")
    
    if cluster_count > 0:
        last_cluster = await db['clusters'].find_one(sort=[("_id", -1)])
        print(f"Latest Cluster ID: {last_cluster['_id']}")
    elif unprocessed > 0:
        print("\n⚠ Unprocessed detections found, but no clusters created.")
        print("This usually means:")
        print("1. min_samples (default 3) wasn't met.")
        print("2. Detections were filtered as 'Sensor Noise' by road proximity.")
        
        sample = await db['raw_detections'].find_one({"processed": False})
        print(f"Sample Unprocessed Detection Coords: {sample['geometry']['coordinates']}")
    
    print("-" * 30)
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
