import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DATABASE_NAME", "road_damage_db")

async def ingest_ahmedabad_roads():
    json_path = "../ai-detection/roads.json"
    print(f"Loading {json_path}...")
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    elements = data.get("elements", [])
    print(f"Found {len(elements)} raw elements in JSON.")
    
    # We only want "way" elements that have highway tags
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    roads_col = db["roads"]
    
    docs_to_insert = []
    
    for el in elements:
        if el.get("type") != "way":
            continue
            
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
            
        tags = el.get("tags", {})
        highway = tags.get("highway")
        
        if not highway:
            continue
            
        # Convert internal geometry to proper GeoJSON LineString
        coordinates = [[pt["lon"], pt["lat"]] for pt in geom]
        
        doc = {
            "name": tags.get("name", "Unnamed Ahmedabad Road"),
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            },
            "properties": {
                "road_type": highway,
                "surface": tags.get("surface", "unknown"),
                "source": "osm_ahmedabad"
            }
        }
        docs_to_insert.append(doc)
        
    print(f"Prepared {len(docs_to_insert)} proper road GeoJSON documents.")
    
    if len(docs_to_insert) > 0:
        # Clear previous partial/old roads to ensure clean slate? The user wants EVERYTHING in road_damage_db
        # But just inserting the new ones is fine. Let's insert them.
        print("Inserting into MongoDB...")
        # Since 60k is large, insert in chunks
        chunk_size = 5000
        for i in range(0, len(docs_to_insert), chunk_size):
            chunk = docs_to_insert[i:i+chunk_size]
            await roads_col.insert_many(chunk)
            print(f"  Inserted chunk {i} to {i+len(chunk)}")
            
        print("Ensuring 2dsphere index on geometry (this might take a second for 60k docs)...")
        await roads_col.create_index([("geometry", "2dsphere")])
        print("Done!")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(ingest_ahmedabad_roads())
