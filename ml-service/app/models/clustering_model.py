"""
clustering_model.py — DBSCAN Clustering ML Model
==================================================
Encapsulates the sklearn DBSCAN algorithm with haversine metric.
This is the M (Model) in FastAPI's MVC — a pure algorithm class
with no I/O side effects, called by clustering_service.py.

Key Features:
  - Per-damage-type radius:  pothole=5m, crack=12m, others=10m
  - Haversine metric for real GPS distance calculation
  - Radius is correctly converted from meters → radians
  - min_samples=1 ensures even single detections form a cluster
"""

import numpy as np
from sklearn.cluster import DBSCAN
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional


# ── Per damage-type epsilon radii (in meters) ─────────────────────────────────
# These define the spatial "fusion" radius for each damage category.
# Two detections of the SAME type within this radius → merged into one cluster.
DAMAGE_TYPE_RADIUS: Dict[str, float] = {
    "pothole":        5.0,   # Small, localised — tight radius
    "crack":         12.0,   # Can span several meters longitudinally
    "rutting":       10.0,   # Wheel ruts: medium
    "raveling":      10.0,
    "alligator":      8.0,   # Fatigue cracking — compact area
    "depression":     6.0,
    "sinkhole":       4.0,
    "default":       10.0,   # Fallback for unknown types
}

EARTH_RADIUS_M = 6_371_000  # WGS-84 mean radius in metres


@dataclass
class ClusteringResult:
    """Typed output from the DBSCAN model for a single damage-type run."""
    labels:    List[int]    # -1 = noise (isolated point), 0..N = cluster label
    n_clusters: int         # Number of real clusters found (excluding noise)
    noise_count: int        # Points marked as noise
    eps_used_m: float       # Epsilon actually used for this run


class DBSCANClusteringModel:
    """
    Wrapper for sklearn DBSCAN with geographic (haversine) distance.

    Usage (per damage type):
        model  = DBSCANClusteringModel.for_damage_type("pothole")
        result = model.fit_predict(list_of_lon_lat_tuples)

    Parameters
    ----------
    eps_meters  : float — cluster fusion radius in metres
    min_samples : int   — minimum points to form a dense core (use 1 to keep singletons)
    """

    def __init__(self, eps_meters: float = 10.0, min_samples: int = 1):
        self.eps_meters   = eps_meters
        self.min_samples  = min_samples
        # Convert once; haversine expects radians
        self._eps_rad     = eps_meters / EARTH_RADIUS_M

    # ── Factory ───────────────────────────────────────────────────────────────
    @classmethod
    def for_damage_type(cls, damage_type: str, min_samples: int = 1) -> "DBSCANClusteringModel":
        """
        Return a model pre-configured with the correct radius for the damage type.

        Example
        -------
        model = DBSCANClusteringModel.for_damage_type("crack")
        # → eps_meters = 12.0
        """
        eps = DAMAGE_TYPE_RADIUS.get(damage_type.lower(), DAMAGE_TYPE_RADIUS["default"])
        return cls(eps_meters=eps, min_samples=min_samples)

    # ── Core ML ───────────────────────────────────────────────────────────────
    def fit_predict(self, coordinates: List[Tuple[float, float]]) -> ClusteringResult:
        """
        Run DBSCAN on a list of (longitude, latitude) coordinate pairs.

        Parameters
        ----------
        coordinates : list of (lon, lat) tuples — WGS-84 decimal degrees

        Returns
        -------
        ClusteringResult
            labels      — parallel array to `coordinates`; same label = same cluster
            n_clusters  — unique real clusters (label != -1)
            noise_count — isolated points (label == -1)
        """
        if not coordinates:
            return ClusteringResult(labels=[], n_clusters=0, noise_count=0, eps_used_m=self.eps_meters)

        # DBSCAN with haversine expects [lat, lon] order (row = [lat, lon])
        coords_array = np.array([(lat, lon) for lon, lat in coordinates])
        coords_rad   = np.radians(coords_array)

        model = DBSCAN(
            eps=self._eps_rad,
            min_samples=self.min_samples,
            metric="haversine",
            algorithm="ball_tree",
        )
        labels = model.fit_predict(coords_rad)

        unique_labels = set(labels)
        n_clusters    = len(unique_labels - {-1})
        noise_count   = int(np.sum(labels == -1))

        return ClusteringResult(
            labels=labels.tolist(),
            n_clusters=n_clusters,
            noise_count=noise_count,
            eps_used_m=self.eps_meters
        )

    # ── Geometry helpers ──────────────────────────────────────────────────────
    @staticmethod
    def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        Calculate haversine distance between two (lon, lat) points in metres.
        Used to compute cluster spread after fitting.
        """
        lon1, lat1 = np.radians(coord1)
        lon2, lat2 = np.radians(coord2)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
        return float(EARTH_RADIUS_M * 2 * np.arcsin(np.sqrt(a)))

    @staticmethod
    def compute_centroid(coordinates: List[Tuple[float, float]]) -> Tuple[float, float]:
        """Return the mean (lon, lat) centroid of a cluster."""
        arr = np.array(coordinates)
        return tuple(arr.mean(axis=0).tolist())

    @staticmethod
    def compute_radius(centroid: Tuple[float, float], coordinates: List[Tuple[float, float]]) -> float:
        """Return max haversine distance from centroid to any member point (metres)."""
        if not coordinates:
            return 0.0
        return max(
            DBSCANClusteringModel.haversine_distance(centroid, c)
            for c in coordinates
        )

    @staticmethod
    def group_by_damage_type(
        detections: List[dict],
    ) -> Dict[str, List[dict]]:
        """
        Partition a flat list of detection documents into groups by damage_type.

        Returns
        -------
        dict  { "pothole": [...], "crack": [...], ... }
        """
        groups: Dict[str, List[dict]] = {}
        for det in detections:
            dtype = det.get("properties", {}).get("damage_type", "default")
            groups.setdefault(dtype, []).append(det)
        return groups
