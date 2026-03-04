"""
Road Simulator — Simulates a car driving along a real Ahmedabad road.

Loads roads.json (OSM Overpass data for Ahmedabad), picks a random road,
and simulates driving with variable speed based on road type.
Coordinates follow road curves naturally via geometry interpolation.
"""

import json
import math
import random
import bisect
from pathlib import Path


# ── Road type → realistic speed ranges (km/h) ─────────────────────
# Each type has (min_speed, max_speed) — actual speed is randomized per second
ROAD_SPEED_RANGES = {
    "motorway":       (80, 110),
    "motorway_link":  (40, 60),
    "trunk":          (60, 90),
    "trunk_link":     (30, 50),
    "primary":        (40, 70),
    "primary_link":   (25, 40),
    "secondary":      (30, 55),
    "secondary_link": (20, 35),
    "tertiary":       (25, 45),
    "tertiary_link":  (15, 30),
    "residential":    (15, 30),
    "living_street":  (10, 20),
    "unclassified":   (20, 40),
}

MIN_ROAD_POINTS = 5
PREFERRED_HIGHWAY_TYPES = set(ROAD_SPEED_RANGES.keys())


# ── Haversine helpers ──────────────────────────────────────────────

def haversine_distance(lat1, lon1, lat2, lon2):
    """Return distance in meters between two (lat, lon) points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_point(lat1, lon1, lat2, lon2, fraction):
    """Linearly interpolate between two geo-points by a 0-1 fraction."""
    return (
        lat1 + (lat2 - lat1) * fraction,
        lon1 + (lon2 - lon1) * fraction,
    )


# ── Road Simulator class ──────────────────────────────────────────

class RoadSimulator:
    """
    Simulates a car driving along a real Ahmedabad road with variable speed.

    Speed varies per second based on road type:
      - Motorway: 80-110 km/h
      - Primary road: 40-70 km/h
      - Residential: 15-30 km/h
      etc.

    Usage:
        sim = RoadSimulator("roads.json")
        lat, lon, speed = sim.get_position(elapsed_seconds=5.0)
    """

    def __init__(self, roads_json_path, seed=None):
        if seed is not None:
            random.seed(seed)

        # Load and filter roads
        roads_path = Path(roads_json_path)
        if not roads_path.exists():
            raise FileNotFoundError(f"roads.json not found at {roads_path}")

        with open(roads_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Filter candidate roads — store (geometry, highway_type)
        candidates = []
        for element in data.get("elements", []):
            if element.get("type") != "way":
                continue
            geom = element.get("geometry", [])
            if len(geom) < MIN_ROAD_POINTS:
                continue
            tags = element.get("tags", {})
            highway = tags.get("highway", "")
            if highway in PREFERRED_HIGHWAY_TYPES:
                candidates.append((geom, highway))

        if not candidates:
            raise ValueError("No suitable roads found in roads.json")

        print(f"[RoadSimulator] Found {len(candidates)} candidate roads in Ahmedabad")

        # Pick a random road, weighted by length (longer roads = more likely)
        lengths = []
        for geom, _ in candidates:
            total = 0
            for i in range(len(geom) - 1):
                total += haversine_distance(
                    geom[i]["lat"], geom[i]["lon"],
                    geom[i + 1]["lat"], geom[i + 1]["lon"]
                )
            lengths.append(total)

        chosen_idx = random.choices(range(len(candidates)), weights=lengths, k=1)[0]
        chosen_geom, self.road_type = candidates[chosen_idx]
        chosen_length = lengths[chosen_idx]

        # Get speed range for this road type
        self.speed_min, self.speed_max = ROAD_SPEED_RANGES.get(self.road_type, (30, 50))
        self.road_name = self.road_type.replace("_", " ").title()

        print(f"[RoadSimulator] Selected: {self.road_name} road, {len(chosen_geom)} points, "
              f"{chosen_length:.0f}m")
        print(f"[RoadSimulator] Speed range: {self.speed_min}-{self.speed_max} km/h")

        # Build path
        self.path = [(pt["lat"], pt["lon"]) for pt in chosen_geom]

        # Randomly decide direction
        if random.random() < 0.5:
            self.path = list(reversed(self.path))

        # Pick a random starting segment
        max_start = max(0, len(self.path) - MIN_ROAD_POINTS)
        start_pct = random.uniform(0, 0.6)
        start_idx = int(start_pct * max_start)
        self.path = self.path[start_idx:]

        # Pre-compute cumulative distances
        self.cum_distances = [0.0]
        for i in range(1, len(self.path)):
            d = haversine_distance(
                self.path[i - 1][0], self.path[i - 1][1],
                self.path[i][0], self.path[i][1]
            )
            self.cum_distances.append(self.cum_distances[-1] + d)

        self.total_path_length = self.cum_distances[-1]

        # Pre-generate realistic speeds for each second (with smooth transitions)
        # Start with a base speed, then vary smoothly (±5 km/h per second)
        self._speed_cache = {}
        max_secs = int(self.total_path_length / (self.speed_min * 1000 / 3600)) + 10
        current_speed = random.uniform(self.speed_min, self.speed_max)
        for s in range(max_secs + 1):
            # Smooth random walk: change by ±0-5 km/h per second
            delta = random.uniform(-5, 5)
            current_speed = max(self.speed_min, min(self.speed_max, current_speed + delta))
            self._speed_cache[s] = round(current_speed, 1)

        # Pre-compute cumulative distance traveled per second (variable speed)
        self._cum_distance_at_sec = [0.0]
        for s in range(1, max_secs + 1):
            speed_mps = self._speed_cache.get(s - 1, self.speed_min) * 1000 / 3600
            self._cum_distance_at_sec.append(self._cum_distance_at_sec[-1] + speed_mps)

        print(f"[RoadSimulator] Path: {len(self.path)} points, {self.total_path_length:.0f}m")
        print(f"[RoadSimulator] Start: ({self.path[0][0]:.6f}, {self.path[0][1]:.6f})")

    def get_speed_at(self, elapsed_seconds):
        """Returns the vehicle speed (km/h) at a given second."""
        sec = int(elapsed_seconds)
        return self._speed_cache.get(sec, self.speed_min)

    def get_position(self, elapsed_seconds):
        """
        Returns (lat, lon, speed_kmh) with variable speed driving.

        Speed fluctuates realistically within the road type's range,
        with smooth transitions between seconds.
        """
        sec = int(elapsed_seconds)
        frac = elapsed_seconds - sec
        speed_kmh = self.get_speed_at(elapsed_seconds)

        # Calculate total distance traveled up to this point
        if sec < len(self._cum_distance_at_sec):
            base_dist = self._cum_distance_at_sec[sec]
        else:
            base_dist = self._cum_distance_at_sec[-1]

        # Add fractional second distance
        speed_mps = speed_kmh * 1000 / 3600
        distance_traveled = base_dist + (frac * speed_mps)

        # Clamp to path
        if distance_traveled >= self.total_path_length:
            return (*self.path[-1], speed_kmh)
        if distance_traveled <= 0:
            return (*self.path[0], speed_kmh)

        # Binary search for segment
        seg_idx = bisect.bisect_right(self.cum_distances, distance_traveled) - 1
        seg_idx = max(0, min(seg_idx, len(self.path) - 2))

        seg_start_dist = self.cum_distances[seg_idx]
        seg_end_dist = self.cum_distances[seg_idx + 1]
        seg_length = seg_end_dist - seg_start_dist

        if seg_length > 0:
            fraction = (distance_traveled - seg_start_dist) / seg_length
        else:
            fraction = 0.0

        lat, lon = interpolate_point(
            self.path[seg_idx][0], self.path[seg_idx][1],
            self.path[seg_idx + 1][0], self.path[seg_idx + 1][1],
            fraction
        )

        return (round(lat, 6), round(lon, 6), speed_kmh)

    def get_total_drive_time(self):
        """Returns approximate max drive time (seconds) at average speed."""
        avg_speed_mps = ((self.speed_min + self.speed_max) / 2) * 1000 / 3600
        return self.total_path_length / avg_speed_mps


# ── Standalone test ────────────────────────────────────────────────

if __name__ == "__main__":
    sim = RoadSimulator("roads.json", seed=42)
    print(f"\nRoad type: {sim.road_name}")
    print(f"Speed range: {sim.speed_min}-{sim.speed_max} km/h")
    print(f"Approx max drive time: {sim.get_total_drive_time():.1f}s\n")
    print("Second-by-second driving:")
    for t in range(15):
        lat, lon, spd = sim.get_position(t)
        print(f"  t={t:3d}s | lat={lat:.6f}, lon={lon:.6f} | speed={spd:.0f} km/h")
