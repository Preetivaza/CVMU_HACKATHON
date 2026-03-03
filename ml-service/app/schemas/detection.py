"""
detection.py — Detection Validation Schemas
============================================
Covers collections: raw_detections, video_uploads, users
All input/upload/user schemas live here since videos → detections → users are the ingestion layer.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ===========================================================================
# ENUMS
# ===========================================================================

class DamageType(str, Enum):
    POTHOLE    = "pothole"
    CRACK      = "crack"
    PATCH      = "patch"
    DEPRESSION = "depression"
    OTHER      = "other"


class ConfidenceLevel(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class UserRole(str, Enum):
    ADMIN    = "admin"
    OPERATOR = "operator"
    VIEWER   = "viewer"


# ===========================================================================
# SHARED GEOMETRY
# ===========================================================================

class GeoJSONPoint(BaseModel):
    """GeoJSON Point geometry — used by detections, clusters, satellite analysis."""
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class GeoJSONPolygon(BaseModel):
    """GeoJSON Polygon geometry — used by user authority_zone."""
    type: str = "Polygon"
    coordinates: List[List[List[float]]]  # [[[lon, lat], ...]]


# ===========================================================================
# VIDEO UPLOAD SCHEMAS  (collection: video_uploads)
# ===========================================================================

class GPSData(BaseModel):
    """Single GPS frame entry attached to a video upload."""
    timestamp: datetime
    latitude: float
    longitude: float
    speed: Optional[float] = None  # km/h


class AccelerometerData(BaseModel):
    """Single accelerometer frame entry attached to a video upload."""
    timestamp: datetime
    x: float
    y: float
    z: float


class VideoMetadata(BaseModel):
    uploaded_at: datetime
    file_size: int = Field(..., ge=0)
    duration_seconds: Optional[int] = Field(None, ge=0)
    fps: Optional[int] = Field(None, ge=0)


class ProcessingResult(BaseModel):
    total_frames: Optional[int]        = Field(None, ge=0)
    processed_frames: Optional[int]    = Field(None, ge=0)
    detections_count: Optional[int]    = Field(None, ge=0)
    processing_time_seconds: Optional[float] = Field(None, ge=0)


class VideoUploadResponse(BaseModel):
    """Response sent to Member 1 after a video is uploaded."""
    video_id: str
    video_url: str
    gps_data: List[GPSData] = []
    accelerometer_data: List[AccelerometerData] = []
    metadata: VideoMetadata


class VideoUploadDocument(BaseModel):
    """
    Full MongoDB document schema for the 'video_uploads' collection.

    Indexes:
        - { video_id: 1 }   — unique lookup by video ID
        - { status: 1 }     — filter by processing status
    """
    video_id: str
    original_filename: Optional[str]   = None
    storage_path: str
    file_size: int                     = Field(..., ge=0)
    duration_seconds: Optional[int]    = Field(None, ge=0)
    fps: Optional[int]                 = Field(None, ge=0)
    status: str                        = "uploaded"   # uploaded|processing|completed|failed
    gps_data: List[GPSData]            = []
    accelerometer_data: List[AccelerometerData] = []
    processing_result: Optional[ProcessingResult] = None
    uploaded_by: Optional[str]         = None         # ObjectId → str
    created_at: datetime               = Field(default_factory=datetime.utcnow)
    updated_at: datetime               = Field(default_factory=datetime.utcnow)


# ===========================================================================
# USER SCHEMAS  (collection: users)
# ===========================================================================

class UserDocument(BaseModel):
    """
    Full MongoDB document schema for the 'users' collection.

    Indexes:
        - { email: 1 }   — unique email lookup
    """
    email: EmailStr
    password_hash: str
    name: str
    role: UserRole
    authority_zone: Optional[GeoJSONPolygon] = None   # Polygon for zone-based filtering
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# RAW DETECTION SCHEMAS  (collection: raw_detections)
# ===========================================================================

class DetectionProperties(BaseModel):
    """Properties of a single detection Feature (from Member 1 AI engine)."""
    video_id: str
    frame_id: Optional[int]                        = None
    timestamp: Optional[datetime]                  = None
    damage_type: DamageType
    confidence: float                              = Field(..., ge=0, le=1)
    bbox_area_ratio: float                         = Field(0, ge=0, le=1)
    normalized_acceleration: float                 = Field(0, ge=0, le=1)
    severity_score: float                          = Field(..., ge=0, le=1)
    confidence_level: ConfidenceLevel              = ConfidenceLevel.MEDIUM
    vehicle_speed: float                           = 0       # km/h
    possible_duplicate: bool                       = False
    model_version: str                             = "unknown"


class Detection(BaseModel):
    """Single detection as received from Member 1 AI engine (bulk POST body)."""
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: DetectionProperties


class RawDetectionDB(BaseModel):
    """
    Full MongoDB document schema for the 'raw_detections' collection.

    Indexes:
        - { geometry: '2dsphere' }              — geospatial queries
        - { 'properties.timestamp': 1 }         — time-range filtering
    """
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: DetectionProperties
    cluster_id: Optional[str]  = None    # ObjectId ref → clusters (null until DBSCAN assigns it)
    processed: bool            = False   # True once clustered
    created_at: datetime       = Field(default_factory=datetime.utcnow)


class DetectionsBulkRequest(BaseModel):
    """Request body for POST /api/v1/detections/bulk from Member 1."""
    video_id: str
    model_version: str
    detections: List[Detection]


# ===========================================================================
# CLUSTERING REQUEST / RESPONSE  (used by clustering router)
# ===========================================================================

class ClusteringRequest(BaseModel):
    """Request body to trigger DBSCAN clustering on raw detections."""
    video_id: Optional[str]        = None
    force_recluster: bool          = False
    eps_meters: Optional[float]    = None   # override default 10 m
    min_samples: Optional[int]     = None   # override default 3


class ClusteringResponse(BaseModel):
    status: str
    clusters_created: int
    detections_processed: int
    message: str
