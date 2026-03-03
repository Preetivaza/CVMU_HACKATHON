from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.schemas.detection import GeoJSONPoint


# --- MongoDB Document Schema ---

class SatelliteAnalysisProperties(BaseModel):
    """
    Properties sub-document of a satellite_analysis MongoDB document.
    Stores GEE/Sentinel-2 analysis results for a specific cluster location.
    """
    cluster_id: str                             # ObjectId reference to clusters collection
    aging_index: float = Field(..., ge=0, le=1) # 0 = new surface, 1 = severely aged
    analysis_date: datetime                     # When this analysis was run
    image_date: Optional[datetime] = None       # Sentinel-2 image capture date
    image_id: Optional[str] = None             # GEE image asset reference string
    confidence: float = Field(0.0, ge=0, le=1) # Model prediction confidence
    model_version: str = "mock-v1.0"           # ML model version used


class SatelliteAnalysisDB(BaseModel):
    """
    Full MongoDB document schema for the 'satellite_analysis' collection.
    Each document records one satellite aging analysis pass for a cluster.

    Indexes:
        - { 'properties.cluster_id': 1 }   — look up analyses by cluster (ascending)
    """
    geometry: GeoJSONPoint                      # Location analysed [longitude, latitude]
    properties: SatelliteAnalysisProperties
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- API Request / Response schemas ---

class SatelliteAnalysisRequest(BaseModel):
    """Request body to trigger satellite analysis for a cluster."""
    cluster_id: str
    coordinates: List[float]    # [longitude, latitude]
    radius_meters: float = 50


class SatelliteAnalysisResponse(BaseModel):
    """Response after running satellite analysis."""
    status: str
    cluster_id: str
    aging_index: Optional[float] = None
    analysis_date: datetime
    message: str
