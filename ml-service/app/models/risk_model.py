"""
risk_model.py — Risk Score Calculation ML Model
================================================
Pure risk calculation logic — no database I/O.
This is the M (Model) in FastAPI's MVC for the risk engine.
Called by risk_service.py to compute final_risk_score and risk_level.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class RiskResult:
    """Output from the risk model for a single cluster."""
    final_risk_score: float   # 0–1, rounded to 4 decimal places
    risk_level: str           # Low | Medium | High | Critical
    formula_used: str         # Which formula branch was applied


class RiskModel:
    """
    Stateless risk calculation engine.

    Formula
    -------
    Normal    (repeat_count <= threshold): 0.70 × avg_severity + 0.30 × aging_index
    Repeat    (repeat_count >  threshold): 0.60 × avg_severity + 0.40 × aging_index

    Risk Levels
    -----------
    score >= 0.85  → Critical
    score >= 0.70  → High
    score >= 0.50  → Medium
    score <  0.50  → Low
    """

    # Weights
    WEIGHT_SEVERITY_NORMAL: float = 0.70
    WEIGHT_AGING_NORMAL:    float = 0.30
    WEIGHT_SEVERITY_REPEAT: float = 0.60
    WEIGHT_AGING_REPEAT:    float = 0.40

    # Repeat detection threshold
    REPEAT_THRESHOLD: int = 3

    # Risk level thresholds (descending)
    THRESHOLD_CRITICAL: float = 0.85
    THRESHOLD_HIGH:     float = 0.70
    THRESHOLD_MEDIUM:   float = 0.50

    # Default aging index when satellite data is unavailable
    DEFAULT_AGING_INDEX: float = 0.50

    @classmethod
    def calculate(
        cls,
        avg_severity: float,
        aging_index: Optional[float],
        repeat_count: int,
        unique_days: int = 1,
        status: str = "pending",
    ) -> RiskResult:
        """
        Calculate final risk score and level.

        Parameters
        ----------
        avg_severity  : Average severity score across detections in cluster (0–1)
        aging_index   : Satellite-derived road surface aging (0–1), or None if unavailable
        repeat_count  : Number of times this location has been detected
        unique_days   : Number of distinct days this damage has been observed
        """
        aging = aging_index if aging_index is not None else cls.DEFAULT_AGING_INDEX

        # ── REPAIR CHECK (Member 3 Requirement) ──────────────────────────────
        # If marked as 'repaired', the problem is solved.
        if status.lower() == "repaired":
            return RiskResult(
                final_risk_score=0.0,
                risk_level="Repaired",
                formula_used="repair-closure: score reset to 0.0"
            )

        if repeat_count > cls.REPEAT_THRESHOLD:
            score  = cls.WEIGHT_SEVERITY_REPEAT * avg_severity + cls.WEIGHT_AGING_REPEAT * aging
            formula = f"repeat: {cls.WEIGHT_SEVERITY_REPEAT}×severity + {cls.WEIGHT_AGING_REPEAT}×aging"
        else:
            score  = cls.WEIGHT_SEVERITY_NORMAL * avg_severity + cls.WEIGHT_AGING_NORMAL * aging
            formula = f"normal: {cls.WEIGHT_SEVERITY_NORMAL}×severity + {cls.WEIGHT_AGING_NORMAL}×aging"

        # ── TEMPORAL CHECK: 20% increase per unique day after the first ──
        if unique_days > 1:
            multiplier = 1.0 + (0.20 * (unique_days - 1))
            score = score * multiplier
            formula += f" | temporal-boost: {multiplier}x ({unique_days} days)"

        score = round(min(max(score, 0.0), 1.0), 4)

        return RiskResult(
            final_risk_score=score,
            risk_level=cls.get_risk_level(score),
            formula_used=formula,
        )

    @classmethod
    def get_risk_level(cls, score: float) -> str:
        """Map a numeric risk score to its categorical label."""
        if score >= cls.THRESHOLD_CRITICAL: return "Critical"
        if score >= cls.THRESHOLD_HIGH:     return "High"
        if score >= cls.THRESHOLD_MEDIUM:   return "Medium"
        return "Low"

    @classmethod
    def severity_score(
        cls,
        confidence: float,
        bbox_area_ratio: float,
        normalized_acceleration: float,
    ) -> float:
        """
        Calculate per-detection severity score (as defined in the Member 1 contract).
        severity = confidence × bbox_area_ratio × (0.5 + normalized_acceleration × 0.5)
        """
        return round(confidence * bbox_area_ratio * (0.5 + normalized_acceleration * 0.5), 4)
