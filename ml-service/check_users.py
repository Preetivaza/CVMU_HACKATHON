import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import json

load_dotenv()

async def main():
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DATABASE_NAME", "road_damage_db")
    print(f"DATABASE: {db_name}")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    cursor = db.users.find({}, {"password_hash": 0})
    async for u in cursor:
        u['_id'] = str(u['_id'])
        print(json.dumps(u, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
