import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    db = client[os.getenv("DATABASE_NAME", "road_damage_db")]
    road = await db.roads.find_one({})
    if road:
        print(f"ROAD_TYPE: {road['geometry']['type']}")
        print(f"ROAD_COORDS: {road['geometry']['coordinates']}")
    else:
        print("No roads found.")

if __name__ == "__main__":
    asyncio.run(main())
