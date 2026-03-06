# Schemas package — Road Damage ML Service
# ==========================================
# Only 4 schema files as per architecture spec:
#   detection.py  — raw_detections, video_uploads, users
#   cluster.py    — clusters, areas, roads, analytics_snapshots
#   satellite.py  — satellite_analysis
#   risk.py       — risk calculation I/O
#   cost_schemas.py — repair cost estimation I/O

# --- cost_schemas.py ---
from app.schemas.cost_schemas import (
    DamageTypeEnum,
    RoadTypeEnum,
    CostEstimateRequest,
    BatchCostRequest,
    CostBreakdown,
    CostEstimateResult,
    BatchCostResponse,
    ClustersCostResponse,
)

# --- detection.py ---
from app.schemas.detection import (
    # Enums
    DamageType,
    ConfidenceLevel,
    UserRole,
    # Geometry
    GeoJSONPoint,
    GeoJSONPolygon,
    # Video upload
    GPSData,
    AccelerometerData,
    VideoMetadata,
    ProcessingResult,
    VideoUploadResponse,
    VideoUploadDocument,
    # User
    UserDocument,
    # Raw detections
    DetectionProperties,
    Detection,
    RawDetectionDB,
    DetectionsBulkRequest,
    # Clustering I/O
    ClusteringRequest,
    ClusteringResponse,
)

# --- cluster.py ---
from app.schemas.cluster import (
    # Enums
    RiskLevel,
    RepairStatus,
    RoadType,
    SnapshotType,
    # Geometry
    GeoJSONPolygon as GeoJSONPolygonCluster,   # alias — avoid name clash with detection.GeoJSONPolygon
    GeoJSONLineString,
    # Cluster
    RepairHistoryEntry,
    ClusterProperties,
    Cluster,
    ClusterDB,
    # Area
    AreaProperties,
    AreaDB,
    AreaCreateRequest,
    AreaResponse,
    AreaListResponse,
    # Road
    RoadProperties,
    RoadDB,
    RoadCreateRequest,
    RoadResponse,
    RoadListResponse,
    # Analytics
    MonthlyTrendData,
    PriorityRankingEntry,
    ZoneSummaryData,
    AnalyticsSnapshotDB,
    MonthlyTrendSnapshot,
    PriorityRankingSnapshot,
    ZoneSummarySnapshot,
    AnalyticsSnapshotRequest,
    AnalyticsSnapshotResponse,
)

# --- satellite.py ---
from app.schemas.satellite import (
    SatelliteAnalysisProperties,
    SatelliteAnalysisDB,
    SatelliteAnalysisRequest,
    SatelliteAnalysisResponse,
)

# --- risk.py ---
from app.schemas.risk import (
    RiskCalculationRequest,
    RiskCalculationResponse,
    AgingIndexUpdate,
    AgingIndexUpdateResponse,
    RiskEngineConfig,
    RiskScoreResult,
)
