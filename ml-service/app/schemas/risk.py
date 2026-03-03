"""
risk.py — Risk Calculation Schemas
====================================
Covers: risk score calculation requests/responses, aging index updates,
        and the risk engine configuration schema.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

from app.schemas.cluster import RiskLevel


# ===========================================================================
# RISK CALCULATION  (used by /ml/risk/calculate)
# ===========================================================================

class RiskCalculationRequest(BaseModel):
    """
    Request body to recalculate risk scores for clusters.
    Either provide a list of cluster_ids OR set recalculate_all=True.
    """
    cluster_ids: Optional[List[str]] = None     # Specific cluster ObjectIds to recalculate
    recalculate_all: bool = False               # If True, recalculate all clusters in DB


class RiskCalculationResponse(BaseModel):
    """Response after a risk recalculation run."""
    status: str
    clusters_updated: int
    message: str


# ===========================================================================
# AGING INDEX UPDATE  (used by /ml/risk/update-aging)
# ===========================================================================

class AgingIndexUpdate(BaseModel):
    """
    Request body to update the satellite-derived aging index for a single cluster.
    Triggers an immediate risk score recalculation for that cluster.
    """
    cluster_id: str
    aging_index: float = Field(..., ge=0, le=1)  # 0 = new surface, 1 = severely aged


class AgingIndexUpdateResponse(BaseModel):
    """Response after updating a cluster aging index."""
    status: str
    cluster_id: str
    new_risk_score: float
    risk_level: RiskLevel
    message: str


# ===========================================================================
# RISK ENGINE CONFIG  (mirrors settings.py — useful for API exposure)
# ===========================================================================

class RiskEngineConfig(BaseModel):
    """
    Exposes the current risk engine weighting configuration.
    Weights must sum to 1.0 within each scenario.
    """
    # Normal scenario weights (repeat_count <= REPEAT_THRESHOLD)
    weight_severity_normal: float = Field(0.7, ge=0, le=1)
    weight_aging_normal: float    = Field(0.3, ge=0, le=1)

    # Repeat damage scenario weights (repeat_count > REPEAT_THRESHOLD)
    weight_severity_repeat: float = Field(0.6, ge=0, le=1)
    weight_aging_repeat: float    = Field(0.4, ge=0, le=1)

    repeat_threshold: int = 3      # How many repeats before switching to repeat weights

    # Risk level thresholds (score >= threshold → that level)
    threshold_critical: float = 0.85
    threshold_high: float     = 0.70
    threshold_medium: float   = 0.50
    # score < threshold_medium → Low


# ===========================================================================
# RISK SCORE HELPER  (utility response — e.g. for single-cluster preview)
# ===========================================================================

class RiskScoreResult(BaseModel):
    """Result of calculating risk for a single data point."""
    avg_severity: float      = Field(..., ge=0, le=1)
    aging_index: float       = Field(..., ge=0, le=1)
    repeat_count: int
    final_risk_score: float  = Field(..., ge=0, le=1)
    risk_level: RiskLevel
