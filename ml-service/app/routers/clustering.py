"""
clustering.py — ML Clustering Router
=====================================
Adds an in-process job lock (_RUNNING_JOBS) to prevent duplicate clustering
runs for the same video_id. Returns 409 Conflict if already processing.
"""
from fastapi import APIRouter, HTTPException
from app.schemas import ClusteringRequest, ClusteringResponse
from app.services.clustering_service import run_clustering
from app.services.aggregation_service import run_aggregation
import asyncio

router = APIRouter()

# ── In-process deduplication lock ────────────────────────────────────────────
# Tracks video_ids that are currently being clustered.  Prevents the same
# video from triggering duplicate DBSCAN runs when the upload pipeline fires
# the ML trigger more than once (e.g. process retries, manual re-cluster races).
_RUNNING_JOBS: set[str] = set()


@router.post("/run", response_model=ClusteringResponse)
async def trigger_clustering(request: ClusteringRequest):
    """
    Trigger DBSCAN clustering on raw detections.

    - **video_id**: Optional video ID to filter detections
    - **force_recluster**: If True, re-cluster already processed detections
    - **eps_meters**: DBSCAN epsilon in meters (default: per damage-type)
    - **min_samples**: Minimum samples to form a cluster (default: 1)

    Returns 409 if a clustering job for the same video_id is already running.
    """
    job_key = request.video_id or "__all__"

    # ── Guard: reject duplicate concurrent runs ───────────────────────────────
    if job_key in _RUNNING_JOBS:
        raise HTTPException(
            status_code=409,
            detail=f"Clustering for video_id='{job_key}' is already in progress. "
                   "Please wait for it to finish before triggering again."
        )

    _RUNNING_JOBS.add(job_key)
    try:
        result = await run_clustering(
            video_id=request.video_id,
            force_recluster=request.force_recluster,
            eps_meters=request.eps_meters,
            min_samples=request.min_samples,
        )

        # Fire-and-forget spatial aggregation after clustering
        asyncio.create_task(run_aggregation())

        return ClusteringResponse(
            status=result["status"],
            clusters_created=result["clusters_created"],
            detections_processed=result["detections_processed"],
            message=result["message"],
            pothole_summary=result.get("pothole_summary", []),
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Always release the lock, even on failure
        _RUNNING_JOBS.discard(job_key)


@router.post("/aggregate")
async def trigger_aggregation():
    """
    Manually trigger spatial aggregation to build/update areas and roads collections.
    """
    try:
        result = await run_aggregation()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
