from fastapi import APIRouter, HTTPException
from app.schemas.detection import DetectionsBulkRequest
from app.services.detections_service import process_bulk_detections

router = APIRouter(prefix="/api/v1", tags=["Detections"])

@router.post("/detections/bulk")
async def receive_bulk_detections(payload: DetectionsBulkRequest):
    """
    Receive bulk detections from Member 1's AI engine.
    """
    try:
        result = await process_bulk_detections(payload)
        
        if not result["success"]:
            return result
            
        return result
        
    except Exception as e:
        print(f"Error processing detections: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while saving to database.")

