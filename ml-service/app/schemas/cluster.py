from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class RepairStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    REPAIRED = "repaired"
    VERIFIED = "verified"


class GeoJSONPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float]


class ClusterProperties(BaseModel):
    detection_ids: List[str] = []
    points_count: int
    radius_meters: float
    avg_severity: float = Field(..., ge=0, le=1)
    avg_confidence: float = Field(..., ge=0, le=1)
    damage_types: Dict[str, int] = {}
    aging_index: Optional[float] = None
    final_risk_score: float = Field(..., ge=0, le=1)
    risk_level: RiskLevel
    repeat_count: int = 1
    status: RepairStatus = RepairStatus.PENDING
    repair_history: List[Dict] = []


class Cluster(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: ClusterProperties
    road_id: Optional[str] = None
    area_id: Optional[str] = None
    first_detected: datetime
    last_detected: datetime
    created_at: datetime
    updated_at: datetime


class RiskCalculationRequest(BaseModel):
    cluster_ids: Optional[List[str]] = None
    recalculate_all: bool = False


class RiskCalculationResponse(BaseModel):
    status: str
    clusters_updated: int
    message: str
