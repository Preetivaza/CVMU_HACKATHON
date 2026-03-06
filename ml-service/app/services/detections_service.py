from datetime import datetime
from typing import List, Dict, Any, Optional
from app.core.database import get_collection, Collections
from app.schemas.detection import DetectionsBulkRequest

async def process_bulk_detections(payload: DetectionsBulkRequest, background_tasks: Any) -> Dict[str, Any]:
    """
    Process and save bulk detections from Member 1.
    """
    detections_col = get_collection(Collections.RAW_DETECTIONS)
    
    raw_detections = []
    now = datetime.utcnow()
    
    # Format detections for MongoDB
    for det in payload.detections:
        doc = det.model_dump()
        
        # Add tracking fields
        doc["properties"]["video_id"] = payload.video_id
        doc["properties"]["model_version"] = payload.model_version
        doc["processed"] = False
        doc["cluster_id"] = None
        doc["created_at"] = now
        
        raw_detections.append(doc)
        
    if not raw_detections:
        return {"success": False, "message": "No detections provided."}
        
    result = await detections_col.insert_many(raw_detections)
    
    # --- Trigger Clustering Automatically (Dynamic processing) ---
    import httpx
    
    async def trigger_via_http(vid: str):
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "http://localhost:8000/ml/clustering/run",
                    json={"video_id": vid, "force_recluster": False},
                    timeout=5.0
                )
        except Exception as e:
            print(f"Failed to trigger dynamic clustering: {e}")
            
    background_tasks.add_task(trigger_via_http, payload.video_id)
    
    return {
        "success": True, 
        "inserted_count": len(result.inserted_ids),
        "message": f"Successfully saved {len(result.inserted_ids)} detections and triggered clustering."
    }
