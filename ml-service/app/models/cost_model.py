"""
cost_model.py — Repair Cost Estimation Model
=============================================
Stateless, rule-based cost calculation engine aligned with Indian PWD standards.
Mirrors RiskModel in design — pure logic, zero database I/O.

Formula
-------
Estimated Cost (₹) = Base Cost × Severity Factor × Location Factor

where:
    Severity Factor = 1.0 + (severity_score × 3.0)   → range [1.0, 4.0]
    Location Factor = road-type-specific multiplier

This is called by cost_service.py for single and batch estimations,
and embedded directly in clustering_service.py for auto-estimation on cluster creation.
"""

from dataclasses import dataclass, field
from typing import Optional


# ===========================================================================
# OUTPUT DATA CLASSES
# ===========================================================================

@dataclass
class CostResult:
    """Complete cost estimation output for a single damage cluster."""
    damage_type:     str
    severity_score:  float
    road_type:       str

    base_cost:         float   # ₹ base before multipliers
    severity_factor:   float   # 1.0 – 4.0
    location_factor:   float   # road-type based
    estimated_cost:    float   # final ₹ value (rounded to nearest 100)

    repair_method:     str     # e.g.  "Full-depth reclamation"
    priority_level:    str     # e.g.  "P1 – Immediate (24h)"
    priority_code:     int     # 1 | 2 | 3 | 4
    currency:          str = "INR"

    # Audit trail
    formula: str = field(default="", repr=False)


# ===========================================================================
# COST MODEL
# ===========================================================================

class RepairCostModel:
    """
    Stateless repair cost estimation engine.

    Base Costs (₹, aligned with Indian PWD Schedule of Rates):
    ----------------------------------------------------------
    pothole         → ₹8,000  (hot-mix patching per event)
    crack           → ₹5,000  (crack sealing per event)
    surface_failure → ₹25,000 (overlay / reclamation per event)
    unknown/other   → ₹6,000  (conservative default)

    Severity Factor:
    ---------------
    1.0 + (severity_score × 3.0)   →  min 1.0 (score=0), max 4.0 (score=1)
    Represents escalating labour + material cost as damage worsens.

    Location Factors (urban-density / road hierarchy):
    --------------------------------------------------
    highway   → 1.8   (specialized machinery, traffic mgmt, highway-grade materials)
    arterial  → 1.4   (city roads — higher labour costs, traffic diversions)
    collector → 1.2   (sub-arterial collector roads)
    local     → 1.0   (rural / residential baselines)
    """

    # ── Base costs per damage type (₹) ──────────────────────────────────────
    BASE_COSTS: dict = {
        "pothole":         8_000.0,
        "crack":           5_000.0,
        "surface_failure": 25_000.0,
    }
    DEFAULT_BASE_COST: float = 6_000.0

    # ── Location factors per road type ───────────────────────────────────────
    LOCATION_FACTORS: dict = {
        "highway":   1.8,
        "arterial":  1.4,
        "collector": 1.2,
        "local":     1.0,
    }
    DEFAULT_LOCATION_FACTOR: float = 1.0

    # ── Severity factor bounds ───────────────────────────────────────────────
    SEVERITY_SCALE: float = 3.0   # multiplies severity_score (0–1)
    SEVERITY_BASE:  float = 1.0   # additive base — ensures min factor = 1.0

    # ── Repair methods (damage_type → {low / high severity}) ─────────────────
    REPAIR_METHODS: dict = {
        "pothole": {
            "low":  "Bituminous patching (cold mix)",
            "high": "Full-depth reclamation (hot mix)",
        },
        "crack": {
            "low":  "Crack sealing (hot-pour sealant)",
            "high": "Micro-surfacing treatment",
        },
        "surface_failure": {
            "low":  "Thin overlay (40 mm DBM layer)",
            "high": "Full road reconstruction",
        },
    }
    DEFAULT_REPAIR_METHOD: dict = {
        "low":  "Surface treatment",
        "high": "Structural repair",
    }
    SEVERITY_THRESHOLD: float = 0.5   # below → low method; at/above → high method

    # ── Priority levels (keyed on risk / severity for standalone use) ─────────
    PRIORITY_LEVELS: list = [
        (0.85, 1, "P1 – Immediate (within 24 hours)"),
        (0.70, 2, "P2 – Urgent (within 72 hours)"),
        (0.50, 3, "P3 – Moderate (within 7 days)"),
        (0.00, 4, "P4 – Routine (within 30 days)"),
    ]

    # ── Cost rounding (nearest ₹) ────────────────────────────────────────────
    ROUND_NEAREST: int = 100

    @classmethod
    def get_base_cost(cls, damage_type: str) -> float:
        """Return the base repair cost (₹) for a damage type."""
        return cls.BASE_COSTS.get(damage_type.lower().strip(), cls.DEFAULT_BASE_COST)

    @classmethod
    def get_severity_factor(cls, severity_score: float) -> float:
        """
        Severity factor linearly scales with severity:
            factor = 1.0 + (severity_score × 3.0)
        Returns a value in [1.0, 4.0].
        """
        score = max(0.0, min(1.0, severity_score))  # clamp to [0, 1]
        return round(cls.SEVERITY_BASE + score * cls.SEVERITY_SCALE, 4)

    @classmethod
    def get_location_factor(cls, road_type: str) -> float:
        """Return the location multiplier for a given road type."""
        return cls.LOCATION_FACTORS.get(road_type.lower().strip(), cls.DEFAULT_LOCATION_FACTOR)

    @classmethod
    def get_repair_method(cls, damage_type: str, severity_score: float) -> str:
        """Return the recommended repair method based on damage type and severity."""
        severity_key = "high" if severity_score >= cls.SEVERITY_THRESHOLD else "low"
        methods = cls.REPAIR_METHODS.get(damage_type.lower().strip(), cls.DEFAULT_REPAIR_METHOD)
        return methods[severity_key]

    @classmethod
    def get_priority_level(cls, risk_score: float) -> tuple:
        """
        Map a risk score to a priority level.
        Returns (priority_label, priority_code).
        Falls back to the severity score if risk_score is not provided.
        """
        for threshold, code, label in cls.PRIORITY_LEVELS:
            if risk_score >= threshold:
                return label, code
        return cls.PRIORITY_LEVELS[-1][2], cls.PRIORITY_LEVELS[-1][1]

    @classmethod
    def estimate(
        cls,
        damage_type:    str,
        severity_score: float,
        road_type:      str           = "local",
        risk_score:     Optional[float] = None,  # from RiskModel; used for priority
    ) -> CostResult:
        """
        Compute the complete repair cost estimate for a single cluster.

        Parameters
        ----------
        damage_type    : "pothole" | "crack" | "surface_failure"
        severity_score : float in [0, 1]
        road_type      : "highway" | "arterial" | "collector" | "local"
        risk_score     : final_risk_score from RiskModel (used for priority; defaults to severity_score)

        Returns
        -------
        CostResult dataclass with all cost components and repair metadata.
        """
        # Normalise inputs
        damage_type = damage_type.lower().strip() if damage_type else "unknown"
        road_type   = road_type.lower().strip()   if road_type   else "local"
        severity    = max(0.0, min(1.0, float(severity_score)))
        risk        = max(0.0, min(1.0, float(risk_score))) if risk_score is not None else severity

        # ── Core cost components ─────────────────────────────────────────────
        base_cost       = cls.get_base_cost(damage_type)
        severity_factor = cls.get_severity_factor(severity)
        location_factor = cls.get_location_factor(road_type)

        # ── Final cost (rounded to nearest ₹100) ────────────────────────────
        raw_cost       = base_cost * severity_factor * location_factor
        estimated_cost = round(raw_cost / cls.ROUND_NEAREST) * cls.ROUND_NEAREST

        # ── Repair metadata ──────────────────────────────────────────────────
        repair_method              = cls.get_repair_method(damage_type, severity)
        priority_label, priority_code = cls.get_priority_level(risk)

        formula = (
            f"₹{base_cost:,.0f} × {severity_factor} (severity) × "
            f"{location_factor} ({road_type}) = ₹{estimated_cost:,.0f}"
        )

        return CostResult(
            damage_type     = damage_type,
            severity_score  = severity,
            road_type       = road_type,
            base_cost       = base_cost,
            severity_factor = severity_factor,
            location_factor = location_factor,
            estimated_cost  = float(estimated_cost),
            repair_method   = repair_method,
            priority_level  = priority_label,
            priority_code   = priority_code,
            currency        = "INR",
            formula         = formula,
        )

    @classmethod
    def estimate_batch(
        cls,
        items: list,            # list of dicts: {damage_type, severity_score, road_type, risk_score?}
    ) -> list:
        """
        Batch-estimate costs for multiple clusters.
        O(n) — single pass over the list, no DB I/O.

        Parameters
        ----------
        items : list of dicts, each with keys:
                damage_type, severity_score, road_type, risk_score (optional)

        Returns
        -------
        list of CostResult objects in the same order as inputs.
        """
        return [
            cls.estimate(
                damage_type    = item.get("damage_type", "unknown"),
                severity_score = item.get("severity_score", 0.5),
                road_type      = item.get("road_type", "local"),
                risk_score     = item.get("risk_score"),
            )
            for item in items
        ]
