"""
clustering_model.py — DBSCAN Clustering ML Model
==================================================
Encapsulates the sklearn DBSCAN algorithm with haversine metric.
This is the M (Model) in FastAPI's MVC — a pure algorithm class
with no I/O side effects, called by clustering_service.py.
"""

import numpy as np
from sklearn.cluster import DBSCAN
from dataclasses import dataclass, field
from typing import List, Tuple, Dict


@dataclass
class ClusteringResult:
    """Typed output from the DBSCAN model."""
    labels: List[int]           # -1 = noise, 0..N = cluster label
    n_clusters: int             # Number of unique clusters (excluding noise)
    noise_count: int            # Points labelled as noise


class DBSCANClusteringModel:
    """
    Wrapper for sklearn DBSCAN with geographic (haversine) distance.

    Parameters
    ----------
    eps_meters    : float — cluster radius in metres (default 10 m)
    min_samples   : int   — minimum points to form a cluster (default 3)
    """

    EARTH_RADIUS_METERS = 6_371_000

    def __init__(self, eps_meters: float = 10.0, min_samples: int = 3):
        self.eps_meters  = eps_meters
        self.min_samples = min_samples
        # Convert eps from metres to radians for haversine metric
        self._eps_rad    = eps_meters / self.EARTH_RADIUS_METERS

    def fit_predict(self, coordinates: List[Tuple[float, float]]) -> ClusteringResult:
        """
        Run DBSCAN on a list of (longitude, latitude) coordinate pairs.

        Returns ClusteringResult with labels array.
        """
        if not coordinates:
            return ClusteringResult(labels=[], n_clusters=0, noise_count=0)

        coords_array = np.array(coordinates)     # shape (N, 2) — [lon, lat]
        coords_rad   = np.radians(coords_array)  # convert to radians for haversine

        model = DBSCAN(
            eps=self._eps_rad,
            min_samples=self.min_samples,
            metric='haversine',
            algorithm='ball_tree',
        )
        labels = model.fit_predict(coords_rad)

        unique_labels = set(labels)
        n_clusters    = len(unique_labels - {-1})
        noise_count   = int(np.sum(labels == -1))

        return ClusteringResult(
            labels=labels.tolist(),
            n_clusters=n_clusters,
            noise_count=noise_count,
        )

    @staticmethod
    def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        Calculate haversine distance between two [lon, lat] points in metres.
        Used to compute cluster radius after fitting.
        """
        R = DBSCANClusteringModel.EARTH_RADIUS_METERS
        lon1, lat1 = np.radians(coord1)
        lon2, lat2 = np.radians(coord2)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
        return float(R * 2 * np.arcsin(np.sqrt(a)))

    @staticmethod
    def compute_centroid(coordinates: List[Tuple[float, float]]) -> Tuple[float, float]:
        """Return the mean [lon, lat] centroid of a set of coordinates."""
        arr = np.array(coordinates)
        return tuple(arr.mean(axis=0).tolist())

    @staticmethod
    def compute_radius(centroid: Tuple[float, float], coordinates: List[Tuple[float, float]]) -> float:
        """Return the maximum haversine distance from centroid to any point (cluster radius)."""
        if not coordinates:
            return 0.0
        return max(
            DBSCANClusteringModel.haversine_distance(centroid, coord)
            for coord in coordinates
        )
