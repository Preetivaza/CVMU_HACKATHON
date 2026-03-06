import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def main():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    dbs = await client.list_database_names()
    print("Databases:", dbs)
    
    for db_name in ["road_damage_db", "RoadDamageDetaction"]:
        if db_name in dbs:
            print(f"\nCollections in {db_name}:")
            db = client[db_name]
            cols = await db.list_collection_names()
            for col in cols:
                count = await db[col].count_documents({})
                print(f"  {col}: {count}")

asyncio.run(main())
