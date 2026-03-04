"""
detections.py — Detection Ingestion Router
============================================
Handles bulk ingestion of raw detections from Member 1's AI engine.
Endpoint: POST /api/v1/detections/bulk
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

from app.schemas.detection import DetectionsBulkRequest
from app.core.database import get_collection, Collections
from app.dependencies.auth import verify_api_key
from app.services.detections_service import process_bulk_detections

router = APIRouter(prefix="/api/v1/detections", tags=["Detections"], dependencies=[Depends(verify_api_key)])

@router.post("/bulk")
async def receive_bulk_detections(payload: DetectionsBulkRequest):
    """
    Ingest raw detections from the AI engine (Member 1).
    """
    try:
        result = await process_bulk_detections(payload)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing detections: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while saving to database.")

@router.get("")
async def list_detections(
    video_id: Optional[str] = None,
    processed: Optional[bool] = None,
    limit: int = 100,
):
    """
    List raw detections with optional filtering.

    - **video_id**: Filter by video/session ID
    - **processed**: Filter by processing status (True/False)
    - **limit**: Max results to return (default 100)
    """
    detections_col = get_collection(Collections.RAW_DETECTIONS)

    query = {}
    if video_id:
        query["properties.video_id"] = video_id
    if processed is not None:
        query["processed"] = processed

    detections = await detections_col.find(query).sort("created_at", -1).to_list(length=limit)

    # Convert ObjectId to string for JSON serialization
    for det in detections:
        det["_id"] = str(det["_id"])
        if det.get("cluster_id"):
            det["cluster_id"] = str(det["cluster_id"])

    return {
        "status": "success",
        "count": len(detections),
        "detections": detections,
    }
