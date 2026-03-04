"""
detections.py — Detection Ingestion Router
============================================
Handles bulk ingestion of raw detections from Member 1's AI engine.
Endpoint: POST /api/v1/detections/bulk
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.schemas import DetectionsBulkRequest
from app.core.database import get_collection, Collections
from app.dependencies.auth import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/bulk")
async def bulk_create_detections(request: DetectionsBulkRequest):
    """
    Ingest raw detections from the AI engine (Member 1).

    Accepts GeoJSON Feature detections with damage_type, confidence,
    severity_score, and geographic coordinates. Each detection is stored
    in the `raw_detections` collection with `processed=False` for
    downstream DBSCAN clustering.

    - **video_id**: Session/video identifier from the AI engine
    - **model_version**: YOLO model version used for inference
    - **detections**: List of GeoJSON Feature detections
    """
    detections_col = get_collection(Collections.RAW_DETECTIONS)
    uploads_col = get_collection(Collections.VIDEO_UPLOADS)

    if not request.detections:
        raise HTTPException(status_code=400, detail="No detections provided")

    # Build MongoDB documents from the request
    docs = []
    for det in request.detections:
        doc = {
            "type": "Feature",
            "geometry": det.geometry.model_dump(),
            "properties": {
                **det.properties.model_dump(),
                "video_id": request.video_id,
                "model_version": request.model_version,
            },
            "cluster_id": None,
            "processed": False,
            "created_at": datetime.utcnow(),
        }
        docs.append(doc)

    # Bulk insert
    result = await detections_col.insert_many(docs)

    # Upsert video_uploads tracking record
    await uploads_col.update_one(
        {"video_id": request.video_id},
        {
            "$set": {
                "video_id": request.video_id,
                "status": "processing",
                "updated_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
                "original_filename": request.video_id,
                "storage_path": "",
                "file_size": 0,
            },
        },
        upsert=True,
    )

    return {
        "status": "success",
        "video_id": request.video_id,
        "detections_ingested": len(result.inserted_ids),
        "message": f"Successfully ingested {len(result.inserted_ids)} detections for video '{request.video_id}'.",
    }


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

