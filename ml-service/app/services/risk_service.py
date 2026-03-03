from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.core.config import settings
from app.core.database import get_collection, Collections
from app.models.risk_model import RiskModel


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
        
        # Calculate new risk score using ML Model
        risk_result = RiskModel.calculate(
            props["avg_severity"],
            props.get("aging_index"),
            props.get("repeat_count", 1)
        )
        
        # Update cluster
        await clusters_col.update_one(
            {"_id": cluster["_id"]},
            {
                "$set": {
                    "properties.final_risk_score": risk_result.final_risk_score,
                    "properties.risk_level": risk_result.risk_level,
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
    
    try:
        obj_id = ObjectId(cluster_id)
        cluster = await clusters_col.find_one({"_id": obj_id})
    except Exception:
        return {
            "status": "error",
            "message": "Invalid cluster_id format"
        }
    
    if not cluster:
        return {
            "status": "error",
            "message": "Cluster not found"
        }
    
    props = cluster["properties"]
    
    # Calculate new risk with updated aging index using ML Model
    risk_result = RiskModel.calculate(
        props["avg_severity"],
        aging_index,
        props.get("repeat_count", 1)
    )
    
    # Update cluster
    await clusters_col.update_one(
        {"_id": ObjectId(cluster_id)},
        {
            "$set": {
                "properties.aging_index": round(aging_index, 4),
                "properties.final_risk_score": risk_result.final_risk_score,
                "properties.risk_level": risk_result.risk_level,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "status": "completed",
        "cluster_id": cluster_id,
        "new_risk_score": risk_result.final_risk_score,
        "risk_level": risk_result.risk_level,
        "message": "Aging index updated and risk recalculated"
    }


async def update_repair_status(
    cluster_id: str, 
    status: str,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update repair status for a cluster and handle lifecycle closure.
    If status is 'repaired', risk is dropped to 0 and aging is reset.
    """
    clusters_col = get_collection(Collections.CLUSTERS)
    
    cluster = await clusters_col.find_one({"_id": ObjectId(cluster_id)})
    if not cluster:
        return {"status": "error", "message": "Cluster not found"}

    props = cluster["properties"]
    
    # If repaired, we reset aging index as well
    new_aging = 0.0 if status.lower() == "repaired" else props.get("aging_index")
    
    # Calculate new risk
    risk_result = RiskModel.calculate(
        avg_severity=props["avg_severity"],
        aging_index=new_aging,
        repeat_count=props.get("repeat_count", 1),
        status=status
    )

    # Prepare repair history entry
    history_entry = {
        "status": status,
        "changed_at": datetime.utcnow(),
        "notes": notes or "Status updated via management system."
    }

    # Update database
    await clusters_col.update_one(
        {"_id": ObjectId(cluster_id)},
        {
            "$set": {
                "properties.status": status,
                "properties.aging_index": new_aging,
                "properties.final_risk_score": risk_result.final_risk_score,
                "properties.risk_level": risk_result.risk_level,
                "updated_at": datetime.utcnow()
            },
            "$push": {
                "properties.repair_history": history_entry
            }
        }
    )

    return {
        "status": "completed",
        "cluster_id": cluster_id,
        "new_status": status,
        "new_risk_score": risk_result.final_risk_score,
        "message": f"Cluster marked as {status}. Risk loop closed."
    }

