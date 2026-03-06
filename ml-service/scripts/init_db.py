import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def init_db():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DATABASE_NAME", "road_damage_db")
    
    print(f"Connecting to {db_name}...")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    # 1. raw_detections collection
    print("Creating indices for 'raw_detections'...")
    await db.raw_detections.create_index([("geometry", "2dsphere")])
    await db.raw_detections.create_index([("properties.video_id", 1)])
    await db.raw_detections.create_index([("properties.timestamp", 1)])
    
    # 2. clusters collection
    print("Creating indices for 'clusters'...")
    await db.clusters.create_index([("geometry", "2dsphere")])
    await db.clusters.create_index([("properties.final_risk_score", -1)])
    await db.clusters.create_index([("area_id", 1)])
    await db.clusters.create_index([("road_id", 1)])
    
    print("Database initialization complete!")
    client.close()

if __name__ == "__main__":
    asyncio.run(init_db())
