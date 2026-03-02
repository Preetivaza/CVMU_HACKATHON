from fastapi import APIRouter, HTTPException
from app.schemas import ClusteringRequest, ClusteringResponse
from app.services.clustering_service import run_clustering

router = APIRouter()


@router.post("/run", response_model=ClusteringResponse)
async def trigger_clustering(request: ClusteringRequest):
    """
    Trigger DBSCAN clustering on raw detections.
    
    - **video_id**: Optional video ID to filter detections
    - **force_recluster**: If True, re-cluster already processed detections
    - **eps_meters**: DBSCAN epsilon parameter in meters (default: 10)
    - **min_samples**: Minimum samples to form a cluster (default: 3)
    """
    try:
        result = await run_clustering(
            video_id=request.video_id,
            force_recluster=request.force_recluster,
            eps_meters=request.eps_meters,
            min_samples=request.min_samples
        )
        
        return ClusteringResponse(
            status=result["status"],
            clusters_created=result["clusters_created"],
            detections_processed=result["detections_processed"],
            message=result["message"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
