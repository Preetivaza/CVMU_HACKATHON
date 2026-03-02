from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DamageType(str, Enum):
    POTHOLE = "pothole"
    CRACK = "crack"
    PATCH = "patch"
    DEPRESSION = "depression"
    OTHER = "other"


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GeoJSONPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class DetectionProperties(BaseModel):
    video_id: str
    frame_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    damage_type: DamageType
    confidence: float = Field(..., ge=0, le=1)
    bbox_area_ratio: float = Field(0, ge=0, le=1)
    normalized_acceleration: float = Field(0, ge=0, le=1)
    severity_score: float = Field(..., ge=0, le=1)
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    vehicle_speed: float = 0
    possible_duplicate: bool = False
    model_version: str = "unknown"


class Detection(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: DetectionProperties


class ClusteringRequest(BaseModel):
    video_id: Optional[str] = None
    force_recluster: bool = False
    eps_meters: Optional[float] = None
    min_samples: Optional[int] = None


class ClusteringResponse(BaseModel):
    status: str
    clusters_created: int
    detections_processed: int
    message: str
