"""
cost.py — Repair Cost Estimation Router
=========================================
Exposes three endpoints for the infrastructure dashboard:

  POST  /ml/cost/estimate     — Single cluster cost estimation
  POST  /ml/cost/batch        — Batch cost estimation (up to 1000 clusters)
  GET   /ml/cost/clusters     — Fetch clusters from DB and estimate costs

All responses are structured JSON ready for dashboard consumption.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.schemas.cost_schemas import (
    CostEstimateRequest,
    BatchCostRequest,
    CostEstimateResult,
    BatchCostResponse,
    ClustersCostResponse,
)
from app.services.cost_service import (
    estimate_single,
    estimate_batch,
    estimate_for_clusters,
)

router = APIRouter()


# ===========================================================================
# ENDPOINTS
# ===========================================================================

@router.post(
    "/estimate",
    summary="Estimate repair cost for a single damage cluster",
    description="""
Compute the estimated repair cost for a single detected damage cluster using:

- **Base Cost** (damage type, Indian PWD schedule of rates)
- **Severity Factor** = `1.0 + (severity_score × 3.0)` → [1.0, 4.0]
- **Location Factor** based on road type (highway, arterial, collector, local)

**Formula:** `Estimated Cost = Base Cost × Severity Factor × Location Factor`

Returns repair method, priority level, cost breakdown, and location metadata.
    """,
    response_model=CostEstimateResult,
    tags=["Cost Estimation"],
)
async def estimate_single_cluster(request: CostEstimateRequest):
    """
    Single cluster cost estimation endpoint.
    Returns a complete repair cost estimate with breakdown and repair metadata.
    """
    try:
        result = await estimate_single(
            latitude       = request.latitude,
            longitude      = request.longitude,
            damage_type    = request.damage_type.value,
            severity_score = request.severity_score,
            road_type      = request.road_type.value,
            risk_score     = request.risk_score,
            cluster_id     = request.cluster_id,
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cost estimation failed: {str(e)}"
        )


@router.post(
    "/batch",
    summary="Batch repair cost estimation for multiple clusters",
    description="""
Estimate repair costs for up to **1,000 damage clusters** in a single request.

Processes all clusters in O(n) time — no database calls, pure computation.
Returns per-cluster estimates plus aggregate summary (total cost, priority distribution).

Ideal for bulk repair planning, budget forecasting, and dashboard loading.
    """,
    response_model=BatchCostResponse,
    tags=["Cost Estimation"],
)
async def estimate_batch_clusters(request: BatchCostRequest):
    """
    Batch cost estimation for multiple clusters.
    Returns per-cluster results plus total cost and priority summary.
    """
    try:
        cluster_inputs = [
            {
                "cluster_id":     c.cluster_id,
                "latitude":       c.latitude,
                "longitude":      c.longitude,
                "damage_type":    c.damage_type.value,
                "severity_score": c.severity_score,
                "road_type":      c.road_type.value,
                "risk_score":     c.risk_score,
            }
            for c in request.clusters
        ]

        result = await estimate_batch(cluster_inputs)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch cost estimation failed: {str(e)}"
        )


@router.get(
    "/clusters",
    summary="Fetch clusters from DB and compute repair costs",
    description="""
Fetch active damage clusters directly from MongoDB and compute repair cost estimates.

- Excludes **repaired** and **verified** clusters (only active repair candidates)
- Sorted by **risk score descending** (highest priority clusters first)
- Supports pagination via `skip` and `limit` (max 500 per request)

Returns a complete repair plan with per-cluster estimates and budget summary.
Suitable for the dashboard's **Repair Planning** and **Budget Estimation** panels.
    """,
    response_model=ClustersCostResponse,
    tags=["Cost Estimation"],
)
async def get_cluster_cost_estimates(
    cluster_ids: Optional[str] = Query(
        None,
        description="Comma-separated cluster IDs to filter (optional). If omitted, returns latest active clusters."
    ),
    limit: int = Query(
        50, ge=1, le=500,
        description="Maximum number of clusters to return (default 50, max 500)"
    ),
    skip: int = Query(
        0, ge=0,
        description="Pagination offset (number of clusters to skip)"
    ),
):
    """
    Live cluster cost estimation from the database.
    Returns highest-risk clusters first with complete repair cost breakdowns.
    """
    try:
        # Parse comma-separated cluster IDs
        parsed_ids = None
        if cluster_ids:
            parsed_ids = [cid.strip() for cid in cluster_ids.split(",") if cid.strip()]

        result = await estimate_for_clusters(
            cluster_ids = parsed_ids,
            limit       = limit,
            skip        = skip,
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch cluster cost estimates: {str(e)}"
        )
