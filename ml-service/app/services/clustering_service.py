import numpy as np
from sklearn.cluster import DBSCAN
from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.core.config import settings
from app.core.database import get_collection, Collections


def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
    """Calculate haversine distance between two coordinates in meters."""
    R = 6371000  # Earth's radius in meters
    
    lon1, lat1 = np.radians(coord1)
    lon2, lat2 = np.radians(coord2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    
    return R * c


def get_risk_level(score: float) -> str:
    """Get risk level from score."""
    if score >= 0.85:
        return "Critical"
    elif score >= 0.70:
        return "High"
    elif score >= 0.50:
        return "Medium"
    return "Low"


def calculate_final_risk(avg_severity: float, aging_index: Optional[float], repeat_count: int) -> float:
    """Calculate final risk score using the formula from the plan."""
    aging = aging_index if aging_index is not None else 0.5  # Default aging index
    
    if repeat_count > settings.REPEAT_THRESHOLD:
        return settings.RISK_WEIGHT_SEVERITY_REPEAT * avg_severity + settings.RISK_WEIGHT_AGING_REPEAT * aging
    else:
        return settings.RISK_WEIGHT_SEVERITY_NORMAL * avg_severity + settings.RISK_WEIGHT_AGING_NORMAL * aging


async def run_clustering(
    video_id: Optional[str] = None,
    force_recluster: bool = False,
    eps_meters: Optional[float] = None,
    min_samples: Optional[int] = None
) -> Dict[str, Any]:
    """
    Run DBSCAN clustering on raw detections.
    
    Args:
        video_id: Optional video ID to filter detections
        force_recluster: If True, re-cluster already processed detections
        eps_meters: DBSCAN epsilon parameter in meters
        min_samples: DBSCAN minimum samples parameter
    
    Returns:
        Dictionary with clustering results
    """
    eps = eps_meters or settings.DBSCAN_EPS_METERS
    min_samp = min_samples or settings.DBSCAN_MIN_SAMPLES
    
    detections_col = get_collection(Collections.RAW_DETECTIONS)
    clusters_col = get_collection(Collections.CLUSTERS)
    
    # Build query for detections
    query = {}
    if video_id:
        query["properties.video_id"] = video_id
    if not force_recluster:
        query["processed"] = False
    
    # Fetch detections
    detections = await detections_col.find(query).to_list(length=None)
    
    if len(detections) < min_samp:
        return {
            "status": "skipped",
            "clusters_created": 0,
            "detections_processed": len(detections),
            "message": f"Not enough detections for clustering (need at least {min_samp})"
        }
    
    # Extract coordinates
    coordinates = []
    for det in detections:
        coords = det["geometry"]["coordinates"]
        coordinates.append([coords[0], coords[1]])  # [lon, lat]
    
    coordinates = np.array(coordinates)
    
    # Convert to radians for haversine
    coords_rad = np.radians(coordinates)
    
    # Run DBSCAN with haversine metric
    # eps needs to be converted from meters to radians
    eps_rad = eps / 6371000  # Convert meters to radians
    
    clustering = DBSCAN(
        eps=eps_rad,
        min_samples=min_samp,
        metric='haversine',
        algorithm='ball_tree'
    )
    
    labels = clustering.fit_predict(coords_rad)
    
    # Group detections by cluster
    clusters_created = 0
    unique_labels = set(labels)
    
    for label in unique_labels:
        if label == -1:  # Noise points
            continue
        
        # Get indices of detections in this cluster
        cluster_mask = labels == label
        cluster_indices = np.where(cluster_mask)[0]
        
        if len(cluster_indices) < min_samp:
            continue
        
        # Get cluster detections
        cluster_detections = [detections[i] for i in cluster_indices]
        
        # Calculate cluster properties
        cluster_coords = coordinates[cluster_mask]
        centroid = cluster_coords.mean(axis=0)
        
        # Calculate radius (max distance from centroid)
        max_distance = 0
        for coord in cluster_coords:
            dist = haversine_distance(centroid.tolist(), coord.tolist())
            max_distance = max(max_distance, dist)
        
        # Calculate average severity and confidence
        severities = [d["properties"]["severity_score"] for d in cluster_detections]
        confidences = [d["properties"]["confidence"] for d in cluster_detections]
        avg_severity = np.mean(severities)
        avg_confidence = np.mean(confidences)
        
        # Count damage types
        damage_types = {}
        for d in cluster_detections:
            dt = d["properties"]["damage_type"]
            damage_types[dt] = damage_types.get(dt, 0) + 1
        
        # Get detection IDs
        detection_ids = [d["_id"] for d in cluster_detections]
        
        # Get timestamps
        timestamps = [d["properties"].get("timestamp") or d.get("created_at") for d in cluster_detections]
        timestamps = [t for t in timestamps if t is not None]
        first_detected = min(timestamps) if timestamps else datetime.utcnow()
        last_detected = max(timestamps) if timestamps else datetime.utcnow()
        
        # Check for existing cluster at same location (for repeat_count)
        existing = await clusters_col.find_one({
            "geometry": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": centroid.tolist()
                    },
                    "$maxDistance": eps  # Within eps meters
                }
            }
        })
        
        repeat_count = 1
        if existing:
            repeat_count = existing["properties"].get("repeat_count", 1) + 1
        
        # Calculate final risk
        final_risk = calculate_final_risk(avg_severity, None, repeat_count)
        risk_level = get_risk_level(final_risk)
        
        # Create cluster document
        cluster_doc = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": centroid.tolist()
            },
            "properties": {
                "detection_ids": detection_ids,
                "points_count": len(cluster_detections),
                "radius_meters": max_distance,
                "avg_severity": round(avg_severity, 4),
                "avg_confidence": round(avg_confidence, 4),
                "damage_types": damage_types,
                "aging_index": None,  # Will be set by satellite analysis
                "final_risk_score": round(final_risk, 4),
                "risk_level": risk_level,
                "repeat_count": repeat_count,
                "status": "pending",
                "repair_history": []
            },
            "road_id": None,
            "area_id": None,
            "first_detected": first_detected,
            "last_detected": last_detected,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert or update cluster
        if existing:
            await clusters_col.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "properties.detection_ids": list(set(
                            [str(d) for d in existing["properties"]["detection_ids"]] + 
                            [str(d) for d in detection_ids]
                        )),
                        "properties.points_count": existing["properties"]["points_count"] + len(cluster_detections),
                        "properties.avg_severity": round((existing["properties"]["avg_severity"] + avg_severity) / 2, 4),
                        "properties.avg_confidence": round((existing["properties"]["avg_confidence"] + avg_confidence) / 2, 4),
                        "properties.repeat_count": repeat_count,
                        "properties.final_risk_score": round(final_risk, 4),
                        "properties.risk_level": risk_level,
                        "last_detected": last_detected,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            cluster_id = existing["_id"]
        else:
            result = await clusters_col.insert_one(cluster_doc)
            cluster_id = result.inserted_id
            clusters_created += 1
        
        # Update detections with cluster reference
        await detections_col.update_many(
            {"_id": {"$in": detection_ids}},
            {
                "$set": {
                    "cluster_id": cluster_id,
                    "processed": True
                }
            }
        )
    
    # Mark remaining noise points as processed (not clustered)
    noise_indices = np.where(labels == -1)[0]
    noise_ids = [detections[i]["_id"] for i in noise_indices]
    if noise_ids:
        await detections_col.update_many(
            {"_id": {"$in": noise_ids}},
            {"$set": {"processed": True}}
        )
    
    return {
        "status": "completed",
        "clusters_created": clusters_created,
        "detections_processed": len(detections),
        "message": f"Clustering completed. Created {clusters_created} new clusters from {len(detections)} detections."
    }
