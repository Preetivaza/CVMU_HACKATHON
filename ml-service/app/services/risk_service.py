from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.core.config import settings
from app.core.database import get_collection, Collections


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


async def recalculate_risk(
    cluster_ids: Optional[List[str]] = None,
    recalculate_all: bool = False
) -> Dict[str, Any]:
    """
    Recalculate risk scores for clusters.
    
    Args:
        cluster_ids: Optional list of cluster IDs to recalculate
        recalculate_all: If True, recalculate all clusters
    
    Returns:
        Dictionary with recalculation results
    """
    clusters_col = get_collection(Collections.CLUSTERS)
    
    # Build query
    query = {}
    if cluster_ids and not recalculate_all:
        query["_id"] = {"$in": [ObjectId(cid) for cid in cluster_ids]}
    
    # Fetch clusters
    clusters = await clusters_col.find(query).to_list(length=None)
    
    if not clusters:
        return {
            "status": "skipped",
            "clusters_updated": 0,
            "message": "No clusters found to update"
        }
    
    updated_count = 0
    
    for cluster in clusters:
        props = cluster["properties"]
        
        # Calculate new risk score
        final_risk = calculate_final_risk(
            props["avg_severity"],
            props.get("aging_index"),
            props.get("repeat_count", 1)
        )
        
        risk_level = get_risk_level(final_risk)
        
        # Update cluster
        await clusters_col.update_one(
            {"_id": cluster["_id"]},
            {
                "$set": {
                    "properties.final_risk_score": round(final_risk, 4),
                    "properties.risk_level": risk_level,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_count += 1
    
    return {
        "status": "completed",
        "clusters_updated": updated_count,
        "message": f"Updated risk scores for {updated_count} clusters"
    }


async def update_aging_index(cluster_id: str, aging_index: float) -> Dict[str, Any]:
    """
    Update aging index for a cluster and recalculate risk.
    
    Args:
        cluster_id: Cluster ID to update
        aging_index: New aging index from satellite analysis
    
    Returns:
        Dictionary with update results
    """
    clusters_col = get_collection(Collections.CLUSTERS)
    
    cluster = await clusters_col.find_one({"_id": ObjectId(cluster_id)})
    
    if not cluster:
        return {
            "status": "error",
            "message": "Cluster not found"
        }
    
    props = cluster["properties"]
    
    # Calculate new risk with updated aging index
    final_risk = calculate_final_risk(
        props["avg_severity"],
        aging_index,
        props.get("repeat_count", 1)
    )
    
    risk_level = get_risk_level(final_risk)
    
    # Update cluster
    await clusters_col.update_one(
        {"_id": ObjectId(cluster_id)},
        {
            "$set": {
                "properties.aging_index": round(aging_index, 4),
                "properties.final_risk_score": round(final_risk, 4),
                "properties.risk_level": risk_level,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "status": "completed",
        "cluster_id": cluster_id,
        "new_risk_score": round(final_risk, 4),
        "risk_level": risk_level,
        "message": "Aging index updated and risk recalculated"
    }
