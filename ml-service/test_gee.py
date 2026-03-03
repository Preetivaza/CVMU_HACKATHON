import asyncio
import os
from pprint import pprint
from dotenv import load_dotenv
load_dotenv()
from bson import ObjectId

from app.core.database import connect_to_mongo, get_collection, Collections
from app.services.satellite_service import check_gee_connection, run_satellite_analysis

async def test():
    print("Testing GEE Connection...")
    is_connected = await check_gee_connection()
    print(f"Connection Status: {'SUCCESS' if is_connected else 'FAILED'}")
    
    if is_connected:
        print("\nTesting Analysis on dummy coordinates (Mumbai, India)...")
        coords = [72.8777, 19.0760] 
        try:
            await connect_to_mongo()
            
            # Create a valid temporary MongoDB cluster to prevent 'Invalid cluster_id format' errors
            dummy_id = ObjectId()
            clusters_col = get_collection(Collections.CLUSTERS)
            await clusters_col.insert_one({
                "_id": dummy_id,
                "type": "Feature",
                "properties": {
                    "avg_severity": 0.5,
                    "repeat_count": 1
                }
            })
            
            result = await run_satellite_analysis(
                cluster_id=str(dummy_id),
                coordinates=coords,
                radius_meters=50
            ) 
            
            # Print the clean result
            print("\n--- FINAL ANALYSIS RESULT ---")
            pprint(result)
            print("-----------------------------\n")
            
            # Cleanup the temporary cluster
            await clusters_col.delete_one({"_id": dummy_id})
            
        except Exception as e:
            print(f"Analysis Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test())
