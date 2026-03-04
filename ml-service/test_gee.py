import asyncio
import os
import json
import ee
from pprint import pprint
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables
load_dotenv()

from app.core.database import connect_to_mongo, get_collection, Collections
from app.services.satellite_service import check_gee_connection, run_satellite_analysis

async def test_gee_v2():
    print("--- Google Earth Engine & Satellite Analysis Test ---")
    
    # 1. Test basic connection
    print("\n[1/3] Testing GEE Connection...")
    is_connected = await check_gee_connection()
    print(f"Connection Status: {'SUCCESS' if is_connected else 'FAILED'}")
    
    if not is_connected:
        print("GEE is not connected. Please check your credentials file and configuration.")
        return

    # 2. Test analysis with dummy data
    print("\n[2/3] Testing Analysis on dummy coordinates (Mumbai, India)...")
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
                "repeat_count": 1,
                "timestamp": {"$date": "2024-03-04T12:00:00.000Z"}
            }
        })
        
        print(f"Running analysis for cluster {dummy_id}...")
        result = await run_satellite_analysis(
            cluster_id=str(dummy_id),
            coordinates=coords,
            radius_meters=50
        ) 
        
        # Print results
        print("\n--- FINAL ANALYSIS RESULT ---")
        pprint(result)
        print("-----------------------------\n")
        
        # 3. Cleanup
        print("[3/3] Cleaning up temporary test data...")
        await clusters_col.delete_one({"_id": dummy_id})
        print("Cleanup complete.")
        
    except Exception as e:
        print(f"Test failed with exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_gee_v2())
