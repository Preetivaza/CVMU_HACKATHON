"""
cluster.py — Clustering Input/Output Schemas
=============================================
Covers collections: clusters, areas, roads, analytics_snapshots
All cluster-derived data lives here: areas and roads are spatial aggregations
of clusters, and analytics snapshots are pre-computed from cluster data.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from app.schemas.detection import GeoJSONPoint


# ===========================================================================
# ENUMS
# ===========================================================================

class RiskLevel(str, Enum):
    LOW      = "Low"
    MEDIUM   = "Medium"
    HIGH     = "High"
    CRITICAL = "Critical"


class RepairStatus(str, Enum):
    PENDING     = "pending"
    SCHEDULED   = "scheduled"
    IN_PROGRESS = "in_progress"
    REPAIRED    = "repaired"
    VERIFIED    = "verified"


class RoadType(str, Enum):
    HIGHWAY   = "highway"
    ARTERIAL  = "arterial"
    COLLECTOR = "collector"
    LOCAL     = "local"


class SnapshotType(str, Enum):
    MONTHLY_TREND    = "monthly_trend"
    PRIORITY_RANKING = "priority_ranking"
    ZONE_SUMMARY     = "zone_summary"


# ===========================================================================
# SHARED GEOMETRY (cluster-layer)
# ===========================================================================

class GeoJSONPolygon(BaseModel):
    """GeoJSON Polygon geometry — used by area grid cells."""
    type: str = "Polygon"
    coordinates: List[List[List[float]]]  # [[[lon, lat], ...]]


class GeoJSONLineString(BaseModel):
    """GeoJSON LineString geometry — used by road segments."""
    type: str = "LineString"
    coordinates: List[List[float]]  # [[lon, lat], ...]


# ===========================================================================
# CLUSTER SCHEMAS  (collection: clusters)
# ===========================================================================

class RepairHistoryEntry(BaseModel):
    """Typed entry in the cluster repair_history array."""
    status: str
    changed_by: Optional[str] = None            # ObjectId → str of the user
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None


class ClusterProperties(BaseModel):
    """Properties sub-document of a cluster GeoJSON Feature."""
    detection_ids: List[str]   = []             # References to raw_detections _id values
    points_count: int
    radius_meters: float
    avg_severity: float        = Field(..., ge=0, le=1)
    avg_confidence: float      = Field(..., ge=0, le=1)
    damage_types: Dict[str, int] = {}           # e.g. {"pothole": 5, "crack": 2}
    aging_index: Optional[float] = Field(None, ge=0, le=1)   # from satellite analysis
    final_risk_score: float    = Field(..., ge=0, le=1)
    risk_level: RiskLevel
    repeat_count: int          = 1
    status: RepairStatus       = RepairStatus.PENDING
    repair_history: List[RepairHistoryEntry] = []


class Cluster(BaseModel):
    """Input schema for creating a cluster (no auto-generated timestamps)."""
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: ClusterProperties
    road_id: Optional[str]  = None
    area_id: Optional[str]  = None
    first_detected: datetime
    last_detected: datetime


class ClusterDB(BaseModel):
    """
    Full MongoDB document schema for the 'clusters' collection.
    GeoJSON Feature representing a grouped damage cluster from DBSCAN.

    Indexes:
        - { geometry: '2dsphere' }                  — geospatial queries
        - { 'properties.final_risk_score': -1 }     — priority ranking (descending)
    """
    type: str = "Feature"
    geometry: GeoJSONPoint
    properties: ClusterProperties
    road_id: Optional[str]  = None              # ObjectId reference to roads collection
    area_id: Optional[str]  = None              # ObjectId reference to areas collection
    first_detected: datetime
    last_detected: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# AREA SCHEMAS  (collection: areas — heatmap grid cells)
# ===========================================================================

class AreaProperties(BaseModel):
    """Properties sub-document of an Area heatmap grid cell."""
    grid_id: str                                    # H3 hex index or "lat_lon_zoom" string
    cluster_ids: List[str]         = []             # ObjectId refs to clusters in this cell
    cluster_count: int             = 0
    avg_risk_score: float          = Field(0.0, ge=0, le=1)
    risk_level: RiskLevel          = RiskLevel.LOW
    month: str                                      # "YYYY-MM" for time-series queries
    total_detections: int          = 0


class AreaDB(BaseModel):
    """
    Full MongoDB document schema for the 'areas' collection.
    GeoJSON Feature representing a heatmap grid cell aggregating cluster risk data.

    Indexes:
        - { geometry: '2dsphere' }          — geospatial intersection queries
        - { 'properties.month': 1 }         — time-series filtering (ascending)
    """
    type: str = "Feature"
    geometry: GeoJSONPolygon
    properties: AreaProperties
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AreaCreateRequest(BaseModel):
    """Request body for manually creating or upserting an area grid cell."""
    grid_id: str
    coordinates: List[List[List[float]]]
    cluster_ids: List[str]  = []
    cluster_count: int      = 0
    avg_risk_score: float   = Field(0.0, ge=0, le=1)
    risk_level: RiskLevel   = RiskLevel.LOW
    month: str
    total_detections: int   = 0


class AreaResponse(BaseModel):
    type: str
    geometry: GeoJSONPolygon
    properties: AreaProperties
    created_at: datetime
    updated_at: datetime


class AreaListResponse(BaseModel):
    """GeoJSON FeatureCollection for the /api/v1/areas endpoint."""
    type: str = "FeatureCollection"
    features: List[AreaResponse]
    total: int = 0


# ===========================================================================
# ROAD SCHEMAS  (collection: roads)
# ===========================================================================

class RoadProperties(BaseModel):
    """Properties sub-document of a Road segment GeoJSON Feature."""
    road_name: str
    road_type: RoadType
    osm_id: Optional[str]    = None             # OpenStreetMap road reference (nullable)
    cluster_ids: List[str]   = []               # ObjectId refs to clusters on this road
    cluster_count: int        = 0
    avg_risk_score: float     = Field(0.0, ge=0, le=1)
    risk_level: RiskLevel     = RiskLevel.LOW
    length_meters: float      = 0.0
    authority_zone: str       = ""              # Zone name for role-based filtering


class RoadDB(BaseModel):
    """
    Full MongoDB document schema for the 'roads' collection.
    GeoJSON Feature representing a road segment with aggregated damage risk.

    Indexes:
        - { geometry: '2dsphere' }                  — geospatial queries
        - { 'properties.avg_risk_score': -1 }       — priority ranking (highest risk first)
    """
    type: str = "Feature"
    geometry: GeoJSONLineString
    properties: RoadProperties
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RoadCreateRequest(BaseModel):
    """Request body for importing or creating a road segment (e.g. from OSM)."""
    road_name: str
    road_type: RoadType
    osm_id: Optional[str] = None
    coordinates: List[List[float]]
    length_meters: float  = 0.0
    authority_zone: str   = ""


class RoadResponse(BaseModel):
    type: str
    geometry: GeoJSONLineString
    properties: RoadProperties
    created_at: datetime
    updated_at: datetime


class RoadListResponse(BaseModel):
    """GeoJSON FeatureCollection for the /api/v1/roads endpoint."""
    type: str = "FeatureCollection"
    features: List[RoadResponse]
    total: int = 0


# ===========================================================================
# ANALYTICS SNAPSHOTS  (collection: analytics_snapshots)
# ===========================================================================

class MonthlyTrendData(BaseModel):
    """Data payload for 'monthly_trend' snapshots."""
    total_detections: int  = 0
    clusters_created: int  = 0
    repairs_completed: int = 0
    risk_delta: float      = 0.0    # Δ avg risk score vs. previous month


class PriorityRankingEntry(BaseModel):
    """Single cluster entry in a 'priority_ranking' snapshot."""
    cluster_id: str
    rank: int
    risk_score: float = Field(..., ge=0, le=1)
    location: List[float]               # [longitude, latitude]


class ZoneSummaryData(BaseModel):
    """Data payload for 'zone_summary' snapshots."""
    total_clusters: int = 0
    avg_risk: float     = Field(0.0, ge=0, le=1)
    high_risk_count: int = 0            # Clusters rated High or Critical


class AnalyticsSnapshotDB(BaseModel):
    """
    Full MongoDB document schema for the 'analytics_snapshots' collection.
    Stores pre-computed analytics for fast dashboard queries.

    data field shape varies by type:
        monthly_trend     → MonthlyTrendData
        priority_ranking  → List[PriorityRankingEntry]
        zone_summary      → ZoneSummaryData

    Indexes:
        - { type: 1, period: 1 }    — compound index for efficient snapshot lookup
    """
    type: SnapshotType
    period: str                             # "YYYY-MM"
    authority_zone: Optional[str] = None    # None = global (all zones)
    data: Dict[str, Any]                    # Flexible for storage; use typed helpers for reads
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MonthlyTrendSnapshot(BaseModel):
    type: SnapshotType = SnapshotType.MONTHLY_TREND
    period: str
    authority_zone: Optional[str] = None
    data: MonthlyTrendData
    created_at: datetime


class PriorityRankingSnapshot(BaseModel):
    type: SnapshotType = SnapshotType.PRIORITY_RANKING
    period: str
    authority_zone: Optional[str] = None
    data: List[PriorityRankingEntry]
    created_at: datetime


class ZoneSummarySnapshot(BaseModel):
    type: SnapshotType = SnapshotType.ZONE_SUMMARY
    period: str
    authority_zone: Optional[str] = None
    data: ZoneSummaryData
    created_at: datetime


class AnalyticsSnapshotRequest(BaseModel):
    """Trigger pre-computation of an analytics snapshot."""
    type: SnapshotType
    period: str
    authority_zone: Optional[str] = None


class AnalyticsSnapshotResponse(BaseModel):
    status: str
    type: SnapshotType
    period: str
    message: str
