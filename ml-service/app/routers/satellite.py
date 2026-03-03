from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from app.schemas import SatelliteAnalysisRequest, SatelliteAnalysisResponse
from app.services.satellite_service import run_satellite_analysis, check_gee_connection

router = APIRouter()


@router.post("/analyze", response_model=SatelliteAnalysisResponse)
async def analyze_satellite_imagery(request: SatelliteAnalysisRequest):
    """
    Analyze satellite imagery for road aging index.
    
    - **cluster_id**: The cluster ID to analyze
    - **coordinates**: [longitude, latitude] of the location
    - **radius_meters**: Analysis radius in meters
    """
    try:
        result = await run_satellite_analysis(
            cluster_id=request.cluster_id,
            coordinates=request.coordinates,
            radius_meters=request.radius_meters
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
            
        return SatelliteAnalysisResponse(
            status=result["status"],
            cluster_id=result["cluster_id"],
            aging_index=result["aging_index"],
            analysis_date=result["analysis_date"],
            message=result["message"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_satellite_service_status():
    """
    Check satellite analysis service status and GEE connection.
    """
    gee_connected = await check_gee_connection()
    return {
        "status": "ready",
        "gee_connected": gee_connected,
        "message": "Satellite service is running." if not gee_connected else "Satellite service is running and connected to GEE."
    }
