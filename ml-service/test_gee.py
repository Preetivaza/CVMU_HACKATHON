<<<<<<< HEAD
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
=======
import ee
import json
import os

def test_gee_connection():
    print("--- Google Earth Engine Connection Test ---")
    
    # Path to service account JSON
    gee_json_path = 'gee-service-account.json'
    
    if not os.path.exists(gee_json_path):
        print(f"Error: Credentials file '{gee_json_path}' not found.")
        return
    
    try:
        # Load credentials to get the email
        with open(gee_json_path, 'r') as f:
            creds = json.load(f)
            service_account = creds.get('client_email')
            
        print(f"Using service account: {service_account}")
        
        # Initialize GEE
        credentials = ee.ServiceAccountCredentials(service_account, gee_json_path)
        ee.Initialize(credentials)
        
        # Test: Fetch SRTM elevation data for a single point
        print("Connected! Testing data fetch...")
        point = ee.Geometry.Point([77.2090, 28.6139]) # Delhi
        srtm = ee.Image('USGS/SRTMGL1_003')
        elevation = srtm.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=30
        ).getInfo()
        
        print(f"Success! Elevation at Delhi: {elevation.get('elevation')} meters")
        print("GEE is working properly.")
        
    except Exception as e:
        print(f"GEE Initialization failed: {str(e)}")
        print("\nPossible issues:")
        print("1. Service account doesn't have GEE API enabled.")
        print("2. Service account hasn't been registered for Earth Engine access.")
        print("3. Network/proxy issues.")

if __name__ == "__main__":
    test_gee_connection()
>>>>>>> 731845e (cluster DBSCAN done)
