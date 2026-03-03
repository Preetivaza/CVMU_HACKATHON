from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.schemas import RiskCalculationRequest, RiskCalculationResponse
from app.services.risk_service import recalculate_risk, update_aging_index, update_repair_status

router = APIRouter()


class AgingIndexUpdate(BaseModel):
    cluster_id: str
    aging_index: float = Field(..., ge=0, le=1)


class RepairStatusUpdate(BaseModel):
    cluster_id: str
    status: str
    notes: Optional[str] = None


@router.post("/calculate", response_model=RiskCalculationResponse)
async def trigger_risk_calculation(request: RiskCalculationRequest):
    """
    Recalculate risk scores for clusters.
    
    - **cluster_ids**: Optional list of cluster IDs to recalculate
    - **recalculate_all**: If True, recalculate all clusters
    """
    try:
        result = await recalculate_risk(
            cluster_ids=request.cluster_ids,
            recalculate_all=request.recalculate_all
        )
        
        return RiskCalculationResponse(
            status=result["status"],
            clusters_updated=result["clusters_updated"],
            message=result["message"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-aging")
async def update_cluster_aging(request: AgingIndexUpdate):
    """
    Update aging index for a specific cluster and recalculate risk.
    
    - **cluster_id**: The cluster ID to update
    - **aging_index**: New aging index from satellite analysis (0-1)
    """
    try:
        result = await update_aging_index(
            cluster_id=request.cluster_id,
            aging_index=request.aging_index
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=404, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-status")
async def update_cluster_status(request: RepairStatusUpdate):
    """
    Update repair status for a cluster (pending, in_progress, repaired).
    If 'repaired', the ML engine resets risk to 0.0.
    """
    try:
        result = await update_repair_status(
            cluster_id=request.cluster_id,
            status=request.status,
            notes=request.notes
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=404, detail=result["message"])
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
