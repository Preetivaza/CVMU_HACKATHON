import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_index():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    db = client[os.getenv('DATABASE_NAME')]
    roads = db['roads']
    
    # Check if collection is empty
    count = await roads.estimated_document_count()
    print(f"Roads collection count: {count}")
    
    # Get indices
    indices = await roads.list_indexes().to_list(None)
    print("Indices on 'roads' collection:")
    for idx in indices:
        print(f"  - {idx['name']}: {idx['key']}")
    
    # Check if a 2dsphere index exists
    has_2dsphere = any('2dsphere' in str(idx['key']) for idx in indices)
    if not has_2dsphere:
        print("⚠ WARNING: 'roads' collection is missing a 2dsphere index on 'geometry'.")
        if count > 0:
            print("Creating 2dsphere index on 'geometry'...")
            await roads.create_index([("geometry", "2dsphere")])
            print("Successfully created 2dsphere index.")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_index())
