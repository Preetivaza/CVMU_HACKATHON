"""
aggregation_service.py - Spatial Aggregation Pipeline
=====================================================
Groups clusters into 'areas' (heatmaps) and maps them to 'roads'.
"""

from datetime import datetime
from typing import Dict, Any, List
from bson import ObjectId

from app.core.database import get_collection, Collections

# Helper to generate a rough grid ID based on lat/lon (e.g. 0.01 degree bins ~1km)
def get_grid_id(lon: float, lat: float, bin_size: float = 0.01) -> str:
    # Round to nearest bin_size
    grid_lon = round(lon / bin_size) * bin_size
    grid_lat = round(lat / bin_size) * bin_size
    return f"grid_{grid_lon:.2f}_{grid_lat:.2f}"

def get_grid_polygon(lon: float, lat: float, bin_size: float = 0.01) -> List[List[List[float]]]:
    """Return a square polygon for the grid cell."""
    grid_lon = round(lon / bin_size) * bin_size
    grid_lat = round(lat / bin_size) * bin_size
    half = bin_size / 2
    return [[[grid_lon - half, grid_lat - half],
             [grid_lon + half, grid_lat - half],
             [grid_lon + half, grid_lat + half],
             [grid_lon - half, grid_lat + half],
             [grid_lon - half, grid_lat - half]]]

def get_risk_level(score: float) -> str:
    if score >= 0.85: return "Critical"
    if score >= 0.70: return "High"
    if score >= 0.50: return "Medium"
    return "Low"

async def run_aggregation() -> Dict[str, Any]:
    """
    Run spatial aggregation to build/update the `areas` and `roads` collections.
    """
    clusters_col = get_collection(Collections.CLUSTERS)
    areas_col = get_collection(Collections.AREAS)
    roads_col = get_collection(Collections.ROADS)

    # 1. Fetch all processed clusters (let's only aggregate un-repaired ones for risk)
    clusters = await clusters_col.find({"properties.status": {"$ne": "repaired"}}).to_list(None)

    if not clusters:
        return {"status": "skipped", "message": "No active clusters to aggregate."}

    # ── AREA AGGREGATION ──────────────────────────────────────────────────────────
    areas_map = {}
    current_month = datetime.utcnow().strftime("%Y-%m")

    for c in clusters:
        lon, lat = c["geometry"]["coordinates"]
        grid_id = get_grid_id(lon, lat)
        risk_score = c["properties"].get("final_risk_score", 0)

        if grid_id not in areas_map:
            areas_map[grid_id] = {
                "grid_id": grid_id,
                "lon": lon,
                "lat": lat,
                "cluster_ids": [],
                "total_risk": 0,
                "total_detections": 0
            }
        
        areas_map[grid_id]["cluster_ids"].append(c["_id"])
        areas_map[grid_id]["total_risk"] += risk_score
        areas_map[grid_id]["total_detections"] += c["properties"].get("points_count", 1)

    # Upsert Areas
    areas_updated = 0
    for grid_id, data in areas_map.items():
        count = len(data["cluster_ids"])
        avg_risk = data["total_risk"] / count if count > 0 else 0

        area_doc = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": get_grid_polygon(data["lon"], data["lat"])
            },
            "properties": {
                "grid_id": grid_id,
                "cluster_ids": data["cluster_ids"],
                "cluster_count": count,
                "avg_risk_score": round(avg_risk, 4),
                "risk_level": get_risk_level(avg_risk),
                "month": current_month,
                "total_detections": data["total_detections"]
            },
            "updated_at": datetime.utcnow()
        }

        # Update if exists for this month, else insert
        res = await areas_col.update_one(
            {"properties.grid_id": grid_id, "properties.month": current_month},
            {"$set": area_doc, "$setOnInsert": {"created_at": datetime.utcnow()}},
            upsert=True
        )
        areas_updated += 1
        
        # Link clusters back to area
        area_id = None
        if res.upserted_id:
            area_id = res.upserted_id
        else:
            existing_area = await areas_col.find_one({"properties.grid_id": grid_id, "properties.month": current_month})
            if existing_area:
                area_id = existing_area["_id"]
        
        if area_id:
            await clusters_col.update_many(
                {"_id": {"$in": data["cluster_ids"]}},
                {"$set": {"area_id": area_id}}
            )

    # ── ROAD AGGREGATION ──────────────────────────────────────────────────────────
    # For every road in the DB, find clusters near it, compute risk
    roads_updated = 0
    roads = await roads_col.find({}).to_list(None)

    for road in roads:
        road_id = road["_id"]
        # Find clusters that have this road_id (we need to map them first)
        # For simplicity, we query clusters spatially near this road line
        # Note: In production you'd use $nearSphere or $geoIntersects
        
        # For our basic aggregation, let's just use the clusters that were already mapped.
        # But since our clustering logic drops "noise", all clusters are supposed to be on roads!
        # A more robust way: Spatial query for clusters within 20m of the road line.
        try:
            road_clusters = await clusters_col.find({
                "geometry": {
                    "$near": {
                        "$geometry": road["geometry"],
                        "$maxDistance": 20
                    }
                },
                "properties.status": {"$ne": "repaired"}
            }).to_list(None)
            
            cluster_count = len(road_clusters)
            if cluster_count > 0:
                avg_risk = sum(c["properties"].get("final_risk_score", 0) for c in road_clusters) / cluster_count
                
                await roads_col.update_one(
                    {"_id": road_id},
                    {"$set": {
                        "properties.cluster_ids": [c["_id"] for c in road_clusters],
                        "properties.cluster_count": cluster_count,
                        "properties.avg_risk_score": round(avg_risk, 4),
                        "properties.risk_level": get_risk_level(avg_risk),
                        "updated_at": datetime.utcnow()
                    }}
                )
                roads_updated += 1
                
                # Link clusters to road
                await clusters_col.update_many(
                    {"_id": {"$in": [c["_id"] for c in road_clusters]}},
                    {"$set": {"road_id": road_id}}
                )
        except Exception as e:
            print(f"[Aggregation] Failed road spatial query for {road_id}: {e}")

    return {
        "status": "completed",
        "areas_updated": areas_updated,
        "roads_updated": roads_updated,
        "message": f"Aggregation complete. Updated {areas_updated} grid areas and {roads_updated} roads."
    }
