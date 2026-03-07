import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.cost_model import RepairCostModel
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DATABASE_NAME", "road_damage_db")

async def migrate_clusters():
    print(f"Connecting to MongoDB at {MONGODB_URI}")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    clusters_col = db["clusters"]
    roads_col = db["roads"]
    
    total_clusters = await clusters_col.count_documents({})
    print(f"Found {total_clusters} clusters to check.")
    
    updated_count = 0
    
    # Process all clusters
    async for cluster in clusters_col.find({}):
        _id = cluster["_id"]
        props = cluster.get("properties", {})
        geom = cluster.get("geometry", {})
        
        if not geom or "coordinates" not in geom:
            continue
            
        centroid = geom["coordinates"]
        damage_type = props.get("damage_type", "unknown")
        severity = props.get("avg_severity", 0.5)
        risk_score = props.get("final_risk_score", severity)
        
        # Determine road type
        road_type = "local"
        try:
            nearby_road = await roads_col.find_one({
                "geometry": {
                    "$near": {
                        "$geometry": {"type": "Point", "coordinates": centroid},
                        "$maxDistance": 10
                    }
                }
            })
            if nearby_road:
                road_type = nearby_road.get("properties", {}).get("road_type", "local")
        except Exception as e:
            pass
            
        print(f"Cluster {_id} (coords: {centroid}) -> Road Type: {road_type}")
        
        # Calculate new cost and priority
        cost_result = RepairCostModel.estimate(
            damage_type=damage_type,
            severity_score=severity,
            road_type=road_type,
            risk_score=risk_score
        )
        
        repair_cost_dict = {
            "estimated_cost":  cost_result.estimated_cost,
            "base_cost":       cost_result.base_cost,
            "severity_factor": cost_result.severity_factor,
            "location_factor": cost_result.location_factor,
            "repair_method":   cost_result.repair_method,
            "priority_level":  cost_result.priority_level,
            "priority_code":   cost_result.priority_code,
            "currency":        cost_result.currency,
            "road_type":       road_type
        }
        
        # Update the database
        await clusters_col.update_one(
            {"_id": _id},
            {"$set": {"properties.repair_cost": repair_cost_dict}}
        )
        updated_count += 1
        
    print(f"Migration complete! Updated {updated_count} clusters with the new priority logic.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_clusters())
