"""
cost_schemas.py — Repair Cost Estimation Pydantic Schemas
==========================================================
Input/output models for the /ml/cost/* API endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


# ===========================================================================
# ENUMS
# ===========================================================================

class DamageTypeEnum(str, Enum):
    POTHOLE         = "pothole"
    CRACK           = "crack"
    SURFACE_FAILURE = "surface_failure"
    UNKNOWN         = "unknown"


class RoadTypeEnum(str, Enum):
    HIGHWAY   = "highway"
    ARTERIAL  = "arterial"
    COLLECTOR = "collector"
    LOCAL     = "local"


# ===========================================================================
# REQUEST SCHEMAS
# ===========================================================================

class CostEstimateRequest(BaseModel):
    """
    Request body for estimating repair cost for a single damage cluster.
    All fields required except road_type (defaults to 'local') and risk_score.
    """
    cluster_id:     Optional[str]   = Field(None, description="Optional cluster reference ID from MongoDB")
    latitude:       float           = Field(..., ge=-90,  le=90,  description="Latitude of the damage centroid")
    longitude:      float           = Field(..., ge=-180, le=180, description="Longitude of the damage centroid")
    damage_type:    DamageTypeEnum  = Field(..., description="Primary damage type detected")
    severity_score: float           = Field(..., ge=0.0, le=1.0,  description="Normalized severity (0=minor, 1=severe)")
    road_type:      RoadTypeEnum    = Field(RoadTypeEnum.LOCAL, description="Road classification for location factor")
    risk_score:     Optional[float] = Field(None, ge=0.0, le=1.0, description="Final risk score from RiskModel (used for priority mapping)")

    class Config:
        json_schema_extra = {
            "example": {
                "cluster_id": "67c9a1b2e4d3f5a6b7c8d9e0",
                "latitude":    23.0225,
                "longitude":   72.5714,
                "damage_type": "pothole",
                "severity_score": 0.8,
                "road_type":   "highway",
                "risk_score":  0.9
            }
        }


class BatchCostRequest(BaseModel):
    """Request body for batch cost estimation across multiple clusters."""
    clusters: List[CostEstimateRequest] = Field(..., min_length=1, max_length=1000,
                                                 description="List of damage cluster inputs (max 1000 per request)")

    class Config:
        json_schema_extra = {
            "example": {
                "clusters": [
                    {
                        "latitude": 23.0225, "longitude": 72.5714,
                        "damage_type": "pothole", "severity_score": 0.8,
                        "road_type": "highway", "risk_score": 0.9
                    },
                    {
                        "latitude": 23.0300, "longitude": 72.5800,
                        "damage_type": "crack", "severity_score": 0.3,
                        "road_type": "arterial"
                    },
                    {
                        "latitude": 22.9900, "longitude": 72.5600,
                        "damage_type": "surface_failure", "severity_score": 0.95,
                        "road_type": "local", "risk_score": 0.95
                    }
                ]
            }
        }


# ===========================================================================
# RESPONSE SCHEMAS
# ===========================================================================

class CostBreakdown(BaseModel):
    """Detailed cost component breakdown for transparency."""
    base_cost:       float = Field(..., description="Base repair cost in ₹ (PWD schedule of rates)")
    severity_factor: float = Field(..., description="Multiplier derived from severity score")
    location_factor: float = Field(..., description="Road-type location multiplier")
    formula:         str   = Field(..., description="Human-readable formula string showing computation")


class CostEstimateResult(BaseModel):
    """
    Complete cost estimation result for a single damage cluster.
    Structured for direct consumption by the infrastructure dashboard.
    """
    cluster_id:     Optional[str] = Field(None, description="MongoDB cluster reference ID (if provided)")
    location: dict = Field(..., description="GeoJSON Point location {latitude, longitude}")

    # Damage metadata
    damage_type:    str   = Field(..., description="Damage type (pothole | crack | surface_failure)")
    severity_score: float = Field(..., description="Input severity score (0–1)")
    road_type:      str   = Field(..., description="Road classification used for cost calculation")

    # Cost output
    estimated_cost: float = Field(..., description="Final estimated repair cost (₹, rounded to nearest ₹100)")
    currency:       str   = Field("INR", description="Currency code")
    breakdown:      CostBreakdown

    # Planning metadata
    repair_method:  str   = Field(..., description="Recommended repair technique per PWD guidelines")
    priority_level: str   = Field(..., description="Actionable priority label (P1–P4)")
    priority_code:  int   = Field(..., description="Numeric priority code (1=highest)")


class BatchCostResponse(BaseModel):
    """
    Complete batch cost estimation response.
    Includes per-cluster results and aggregate summary for dashboard use.
    """
    status:              str                    = "completed"
    cluster_count:       int                    = Field(..., description="Number of clusters processed")
    total_estimated_cost: float                 = Field(..., description="Sum of all estimated repair costs (₹)")
    processing_time_ms:  float                  = Field(..., description="Server-side processing time in milliseconds")
    currency:            str                    = "INR"
    clusters:            List[CostEstimateResult]

    # Aggregate breakdown by priority
    priority_summary: dict = Field(
        default_factory=dict,
        description="Count of clusters at each priority level: {P1: n, P2: n, P3: n, P4: n}"
    )


class ClustersCostResponse(BaseModel):
    """
    Response for /ml/cost/clusters — fetches clusters from DB and estimates costs.
    Same structure as BatchCostResponse but includes a source indicator.
    """
    status:               str                    = "completed"
    source:               str                    = "database"
    cluster_count:        int
    total_estimated_cost: float
    processing_time_ms:   float
    currency:             str                    = "INR"
    clusters:             List[CostEstimateResult]
    priority_summary:     dict                   = Field(default_factory=dict)
