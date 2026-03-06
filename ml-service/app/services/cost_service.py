"""
cost_service.py — Repair Cost Estimation Service
==================================================
Database-integrated service layer for the repair cost estimation system.
- estimate_single()        → on-the-fly estimate for a single input
- estimate_batch()         → vectorized batch estimate (O(n), no DB I/O)
- estimate_for_clusters()  → fetch clusters from MongoDB, infer road type, estimate

All computation is delegated to RepairCostModel (pure logic, no I/O).
"""

import time
from typing import List, Optional, Dict, Any
from bson import ObjectId

from app.core.database import get_collection, Collections
from app.models.cost_model import RepairCostModel, CostResult


# ===========================================================================
# INTERNAL HELPERS
# ===========================================================================

def _cost_result_to_dict(
    result: CostResult,
    cluster_id: Optional[str],
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """Convert a CostResult dataclass into a dashboard-ready dictionary."""
    return {
        "cluster_id":     cluster_id,
        "location": {
            "latitude":  latitude,
            "longitude": longitude,
        },
        "damage_type":    result.damage_type,
        "severity_score": result.severity_score,
        "road_type":      result.road_type,
        "estimated_cost": result.estimated_cost,
        "currency":       result.currency,
        "breakdown": {
            "base_cost":       result.base_cost,
            "severity_factor": result.severity_factor,
            "location_factor": result.location_factor,
            "formula":         result.formula,
        },
        "repair_method":  result.repair_method,
        "priority_level": result.priority_level,
        "priority_code":  result.priority_code,
    }


def _build_priority_summary(results: List[Dict]) -> Dict[str, int]:
    """Aggregate count of clusters at each priority code."""
    summary = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
    for r in results:
        code = r.get("priority_code", 4)
        key  = f"P{code}"
        summary[key] = summary.get(key, 0) + 1
    return summary


def _infer_road_type_from_cluster(cluster: Dict) -> str:
    """
    Infer road_type from a cluster document.
    Priority:
      1. cluster.properties.road_type (if stored)
      2. road_id linked road document (not fetched here — too expensive for batch)
      3. fallback: 'local'
    """
    props = cluster.get("properties", {})

    # Direct road_type stored on cluster (from road lookup during clustering)
    road_type = props.get("road_type")
    if road_type:
        return road_type.lower()

    # Try damage_type-based heuristic from context (future: replace with road lookup)
    return "local"


# ===========================================================================
# PUBLIC SERVICE FUNCTIONS
# ===========================================================================

async def estimate_single(
    latitude:       float,
    longitude:      float,
    damage_type:    str,
    severity_score: float,
    road_type:      str            = "local",
    risk_score:     Optional[float] = None,
    cluster_id:     Optional[str]  = None,
) -> Dict[str, Any]:
    """
    Estimate repair cost for a single damage cluster.

    Parameters
    ----------
    latitude, longitude : Cluster centroid coordinates
    damage_type         : "pothole" | "crack" | "surface_failure"
    severity_score      : 0–1 normalized severity
    road_type           : "highway" | "arterial" | "collector" | "local"
    risk_score          : Optional RiskModel score for priority mapping
    cluster_id          : Optional MongoDB ObjectId string for reference

    Returns
    -------
    dict — dashboard-ready cost estimation result
    """
    result = RepairCostModel.estimate(
        damage_type    = damage_type,
        severity_score = severity_score,
        road_type      = road_type,
        risk_score     = risk_score,
    )
    return _cost_result_to_dict(result, cluster_id, latitude, longitude)


async def estimate_batch(
    cluster_inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Batch-estimate repair costs for multiple clusters.

    Parameters
    ----------
    cluster_inputs : list of dicts, each with:
        - latitude, longitude (required)
        - damage_type, severity_score (required)
        - road_type (optional, defaults to "local")
        - risk_score (optional)
        - cluster_id (optional)

    Returns
    -------
    BatchCostResponse-compatible dict with all cluster results and summary.
    """
    t_start = time.perf_counter()

    results = []
    total_cost = 0.0

    for item in cluster_inputs:
        result = RepairCostModel.estimate(
            damage_type    = item.get("damage_type", "unknown"),
            severity_score = item.get("severity_score", 0.5),
            road_type      = item.get("road_type", "local"),
            risk_score     = item.get("risk_score"),
        )
        row = _cost_result_to_dict(
            result,
            cluster_id = item.get("cluster_id"),
            latitude   = item.get("latitude", 0.0),
            longitude  = item.get("longitude", 0.0),
        )
        results.append(row)
        total_cost += result.estimated_cost

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

    return {
        "status":               "completed",
        "cluster_count":        len(results),
        "total_estimated_cost": round(total_cost, 2),
        "processing_time_ms":   elapsed_ms,
        "currency":             "INR",
        "clusters":             results,
        "priority_summary":     _build_priority_summary(results),
    }


async def estimate_for_clusters(
    cluster_ids: Optional[List[str]] = None,
    limit:       int                 = 50,
    skip:        int                 = 0,
) -> Dict[str, Any]:
    """
    Fetch clusters from MongoDB and compute repair cost estimates.

    Parameters
    ----------
    cluster_ids : Optional whitelist of cluster IDs. If None, fetches latest clusters.
    limit       : Max clusters to process (default 50, max 500).
    skip        : Pagination offset.

    Returns
    -------
    ClustersCostResponse-compatible dict.
    """
    t_start = time.perf_counter()

    clusters_col = get_collection(Collections.CLUSTERS)
    limit        = min(max(1, limit), 500)   # hard cap at 500

    # Build MongoDB query
    query: Dict = {}
    if cluster_ids:
        try:
            query["_id"] = {"$in": [ObjectId(cid) for cid in cluster_ids]}
        except Exception:
            pass  # invalid ObjectIds are silently ignored

    # Only fetch pending/non-repaired clusters for active repair planning
    # (skip clusters already marked repaired or verified)
    query["properties.status"] = {"$nin": ["repaired", "verified"]}

    # Sort by risk score descending (highest priority first)
    cursor   = clusters_col.find(query).sort("properties.final_risk_score", -1).skip(skip).limit(limit)
    clusters = await cursor.to_list(length=limit)

    if not clusters:
        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)
        return {
            "status":               "completed",
            "source":               "database",
            "cluster_count":        0,
            "total_estimated_cost": 0.0,
            "processing_time_ms":   elapsed_ms,
            "currency":             "INR",
            "clusters":             [],
            "priority_summary":     {"P1": 0, "P2": 0, "P3": 0, "P4": 0},
        }

    results    = []
    total_cost = 0.0

    for cluster in clusters:
        props   = cluster.get("properties", {})
        geom    = cluster.get("geometry", {})
        coords  = geom.get("coordinates", [0.0, 0.0])   # [lon, lat]

        # Determine primary damage type (most common in cluster)
        damage_types: Dict = props.get("damage_types", {})
        if damage_types:
            damage_type = max(damage_types, key=damage_types.get)
        else:
            damage_type = props.get("damage_type", "unknown")

        # Infer road type
        road_type = _infer_road_type_from_cluster(cluster)

        result = RepairCostModel.estimate(
            damage_type    = damage_type,
            severity_score = props.get("avg_severity", 0.5),
            road_type      = road_type,
            risk_score     = props.get("final_risk_score"),
        )

        row = _cost_result_to_dict(
            result,
            cluster_id = str(cluster["_id"]),
            latitude   = float(coords[1]) if len(coords) >= 2 else 0.0,
            longitude  = float(coords[0]) if len(coords) >= 1 else 0.0,
        )
        results.append(row)
        total_cost += result.estimated_cost

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

    return {
        "status":               "completed",
        "source":               "database",
        "cluster_count":        len(results),
        "total_estimated_cost": round(total_cost, 2),
        "processing_time_ms":   elapsed_ms,
        "currency":             "INR",
        "clusters":             results,
        "priority_summary":     _build_priority_summary(results),
    }
