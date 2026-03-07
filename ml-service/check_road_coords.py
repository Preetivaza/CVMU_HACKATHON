import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def main():
    uri = os.getenv('MONGODB_URI')
    client = AsyncIOMotorClient(uri)
    db = client['road_damage_db']
    roads = await db['roads'].find({}).to_list(None)
    
    print('ALL ROADS IN DB:')
    for r in roads:
        name = r.get('name', 'Unnamed')
        rtype = r.get('properties', {}).get('road_type', 'none')
        coords = r.get('geometry', {}).get('coordinates', [])
        
        # safely print just the first few coordinates
        if len(coords) > 0:
            if isinstance(coords[0], list):
                if isinstance(coords[0][0], list):
                    # MultiLineString
                    snippet = coords[0][:2]
                else:
                    # LineString
                    snippet = coords[:2]
            else:
                snippet = coords
        else:
            snippet = []
            
        print(f"Name: {name} | Type: {rtype} | Length: {len(coords)} | Coords Example: {snippet}")

if __name__ == "__main__":
    asyncio.run(main())
