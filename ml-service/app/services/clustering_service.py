"""
clustering_service.py — Pipeline orchestrator
===============================================
Full DBSCAN clustering pipeline:

  Step 1 → Fetch unprocessed raw detections from MongoDB
  Step 2 → Group detections by damage_type
  Step 3 → For each group, run DBSCAN with the correct per-type radius:
              pothole  → eps = 5 m
              crack    → eps = 12 m
              others   → eps = 10 m (default)
  Step 4 → For each cluster:
              a. Compute centroid, radius, avg severity, avg confidence
              b. Check if a cluster already exists nearby (repeat detection)
              c. Calculate final risk score using the Risk Model
              d. Insert new cluster OR increment repeat_count of existing one
  Step 5 → Write cluster_id back to each detection and mark processed=True
"""

import numpy as np
from datetime import datetime
import dateutil.parser
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.core.config import settings
from app.core.database import get_collection, Collections
from app.models.clustering_model import DBSCANClusteringModel, DAMAGE_TYPE_RADIUS
from app.models.risk_model import RiskModel
from app.models.cost_model import RepairCostModel
from app.services import satellite_service


async def run_clustering(
    video_id: Optional[str] = None,
    force_recluster: bool = False,
    eps_meters: Optional[float] = None,    # Global override (ignores per-type radii)
    min_samples: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Run the full DBSCAN clustering pipeline on raw road-damage detections.

    Args
    ----
    video_id        : Limit clustering to one video's detections (None = all).
    force_recluster : If True, re-cluster detections that were already processed.
    eps_meters      : Optional global radius override (uses per-type radius if None).
    min_samples     : DBSCAN min_samples. Defaults to 1 so single points form clusters.

    Returns
    -------
    dict with status, clusters_created, detections_processed, and per-type breakdown.
    """

    # ── Defaults ──────────────────────────────────────────────────────────────
    min_samp = min_samples if min_samples is not None else 1

    detections_col = get_collection(Collections.RAW_DETECTIONS)
    clusters_col   = get_collection(Collections.CLUSTERS)

    # ── Pre-flight: database-level idempotency guard ─────────────────────────
    # If this video_id was already successfully clustered and force_recluster
    # is not explicitly requested, skip the entire pipeline.
    if video_id and not force_recluster:
        uploads_col = get_collection(Collections.VIDEO_UPLOADS)
        upload_doc = await uploads_col.find_one({"video_id": video_id})
        if upload_doc and upload_doc.get("clustered") is True:
            print(f"[Clustering] video_id='{video_id}' already clustered. Skipping (use force_recluster=True to override).")
            return {
                "status": "already_clustered",
                "clusters_created": 0,
                "detections_processed": 0,
                "per_type_breakdown": {},
                "pothole_summary": [],
                "message": f"video_id='{video_id}' was already clustered. No changes made.",
            }

    # ── Step 1: Fetch detections ───────────────────────────────────────────────
    query: Dict = {}
    if video_id:
        query["properties.video_id"] = video_id
    if not force_recluster:
        query["processed"] = False

    raw_detections = await detections_col.find(query).to_list(length=None)

    # ── Quarantine Malformed Data ─────────────────────────────────────────────
    # Sometimes legacy/broken data has geometry: null, which crashes DBSCAN.
    detections = []
    broken_ids = []
    for det in raw_detections:
        geom = det.get("geometry")
        if not geom or "coordinates" not in geom or not isinstance(geom["coordinates"], list) or len(geom["coordinates"]) < 2:
            broken_ids.append(det["_id"])
        else:
            detections.append(det)
            
    if broken_ids:
        print(f"[Clustering] Quarantined {len(broken_ids)} malformed detections (missing coordinates).")
        await detections_col.update_many(
            {"_id": {"$in": broken_ids}},
            {"$set": {"processed": True, "cluster_id": "malformed_geometry_error"}}
        )

    if not detections:
        return {
            "status": "skipped",
            "clusters_created": 0,
            "detections_processed": 0,
            "message": "No unprocessed detections found.",
        }

    print(f"[Clustering] Fetched {len(detections)} detections.")

    # ── Step 2: Group by damage_type ──────────────────────────────────────────
    groups = DBSCANClusteringModel.group_by_damage_type(detections)
    print(f"[Clustering] Damage-type groups: { {k: len(v) for k, v in groups.items()} }")

    # ── Step 3 + 4 + 5: Cluster each group ────────────────────────────────────
    total_clusters_created = 0
    total_processed        = 0
    per_type_summary       = {}
    session_cluster_ids    = set()

    for damage_type, group_detections in groups.items():

        print(f"[Clustering] Processing '{damage_type}': {len(group_detections)} detections")

        # 3a. Build model — use global override or per-type radius
        if eps_meters:
            model = DBSCANClusteringModel(eps_meters=eps_meters, min_samples=min_samp)
        else:
            model = DBSCANClusteringModel.for_damage_type(damage_type, min_samples=min_samp)

        print(f"[Clustering]  → eps = {model.eps_meters} m  (converted: {model._eps_rad:.8f} rad)")

        # 3b. Extract [lon, lat] tuples for DBSCAN
        coordinates = [
            (det["geometry"]["coordinates"][0], det["geometry"]["coordinates"][1])
            for det in group_detections
        ]

        # 3c. Run DBSCAN
        result = model.fit_predict(coordinates)
        labels = result.labels

        print(f"[Clustering]  → {result.n_clusters} cluster(s), {result.noise_count} noise point(s)")

        # ── Step 4: Process each cluster label ────────────────────────────────
        group_clusters_created = 0

        for label in set(labels):
            #  Label -1 → noise (isolated detection). Still mark as processed.
            is_noise = label == -1

            cluster_indices  = [i for i, l in enumerate(labels) if l == label]
            cluster_dets     = [group_detections[i] for i in cluster_indices]
            cluster_coords   = [coordinates[i] for i in cluster_indices]

            # 4a. Cluster geometry
            centroid     = model.compute_centroid(cluster_coords)
            max_radius   = model.compute_radius(centroid, cluster_coords) if not is_noise else 0.0

            # 4b. Aggregate stats
            severities   = [d["properties"].get("severity_score", 0.5) for d in cluster_dets]
            confidences  = [d["properties"].get("confidence", 0.5)     for d in cluster_dets]
            avg_severity = float(np.mean(severities))
            avg_conf     = float(np.mean(confidences))

            damage_type_counts: Dict[str, int] = {}
            for d in cluster_dets:
                dt = d["properties"].get("damage_type", "unknown")
                damage_type_counts[dt] = damage_type_counts.get(dt, 0) + 1

            detection_ids = [d["_id"] for d in cluster_dets]

            raw_timestamps = [
                d["properties"].get("timestamp") or d.get("created_at")
                for d in cluster_dets
            ]
            timestamps = []
            for t in raw_timestamps:
                if t:
                    if isinstance(t, str):
                        try:
                            timestamps.append(dateutil.parser.isoparse(t))
                        except Exception:
                            timestamps.append(datetime.utcnow())
                    elif isinstance(t, datetime):
                        timestamps.append(t)
            
            first_detected = min(timestamps) if timestamps else datetime.utcnow()
            last_detected  = max(timestamps) if timestamps else datetime.utcnow()

            # ── TEMPORAL CHECK: Calculate current session unique days ──
            session_days = {t.date() for t in timestamps} if timestamps else {datetime.utcnow().date()}

            # ── ROAD CHECK (Member 3 Requirement) ──────────────────────────────────
            # Step A: Distance to Road Centerline
            on_road = True
            try:
                roads_col = get_collection(Collections.ROADS)
                road_count = await roads_col.estimated_document_count()
                
                if road_count > 0:
                    nearby_road = await roads_col.find_one({
                        "geometry": {
                            "$near": {
                                "$geometry": {"type": "Point", "coordinates": list(centroid)},
                                "$maxDistance": 10  # 10 meters — Discard Threshold
                            }
                        }
                    })
                    if not nearby_road:
                        on_road = False
                        print(f"[Clustering]   ⚠ Centroid {centroid} > 10m from road. Discarding as Noise.")
                
                # Step B: Satellite-Aided Verification (Sentinel-1/2) 
                # If distance is borderline or we want higher assurance
                if on_road:
                    sat_verify = await satellite_service.validate_road_material(list(centroid))
                    if sat_verify["status"] == "completed" and not sat_verify["likely_road"]:
                        on_road = False
                        print(f"[Clustering]   ⚠ Satellite (NDVI={sat_verify.get('ndvi')}) says NOT A ROAD. Discarding.")

            except Exception as e:
                # If 2dsphere index missing or other DB error, assume on road to be safe
                pass

            # Update noise status if road check failed
            if not on_road:
                is_noise = True

            # Noise points: mark processed but don't create a cluster
            if is_noise:
                await detections_col.update_many(
                    {"_id": {"$in": detection_ids}},
                    {"$set": {"processed": True, "cluster_id": None}}
                )
                total_processed += len(cluster_dets)
                continue

            # 4c. Repeat detection check —
            #     Is there already a cluster within eps meters at this location?
            existing = None
            try:
                existing = await clusters_col.find_one({
                    "geometry": {
                        "$near": {
                            "$geometry": {"type": "Point", "coordinates": list(centroid)},
                            "$maxDistance": model.eps_meters
                        }
                    },
                    "properties.damage_types": {"$exists": True}
                })
            except Exception:
                pass  # 2dsphere index may not exist yet; treat as new

            repeat_count  = 1
            aging_index   = None
            unique_days   = len(session_days)
            status        = "pending"
            
            if existing:
                repeat_count  = existing["properties"].get("repeat_count", 1) + 1
                aging_index   = existing["properties"].get("aging_index")
                status        = existing["properties"].get("status", "pending")
                
                # Combine session days with existing cluster days
                existing_first = existing.get("first_detected")
                existing_last  = existing.get("last_detected")
                all_days = set(session_days)
                if isinstance(existing_first, datetime): all_days.add(existing_first.date())
                if isinstance(existing_last, datetime): all_days.add(existing_last.date())
                
                # If unique_days == 1 → Status: DUPLICATE (handled by RiskModel internally)
                # If unique_days > 1 → Status: REPEAT (RiskModel increases score by 20% per day)
                unique_days = len(all_days)
                
                print(f"[Clustering]   ↳ Repeat #{repeat_count} over {unique_days} unique day(s)")

            # Contractor Compliance Logic
            temporal_status = "REPEAT" if unique_days > 1 else "DUPLICATE"
            if existing and status in ["repaired", "verified"]:
                print(f"[Clustering]   ⚠ Contractor Compliance Violation! Repaired cluster detected again.")
                temporal_status = "compliance_violation"
                status = "pending" # Re-open the ticket

            # 4d. Risk model
            risk_result = RiskModel.calculate(
                avg_severity=avg_severity, 
                aging_index=aging_index, 
                repeat_count=repeat_count,
                unique_days=unique_days
            )

            # 4e. Persist cluster
            if existing:
                # Merge into existing cluster (update in place)
                merged_ids = list(set(
                    [str(d) for d in existing["properties"].get("detection_ids", [])] +
                    [str(d) for d in detection_ids]
                ))
                merged_count    = existing["properties"].get("points_count", 0) + len(cluster_dets)
                merged_severity = round(
                    (existing["properties"].get("avg_severity", avg_severity) + avg_severity) / 2, 4
                )
                merged_conf     = round(
                    (existing["properties"].get("avg_confidence", avg_conf) + avg_conf) / 2, 4
                )

                # 4e. Calculate Cost
                cost_result = RepairCostModel.estimate(
                    damage_type    = damage_type,
                    severity_score = merged_severity,
                    road_type      = "local",  # fallback, can be enriched later
                    risk_score     = risk_result.final_risk_score,
                )
                repair_cost_dict = {
                    "estimated_cost":  cost_result.estimated_cost,
                    "base_cost":       cost_result.base_cost,
                    "severity_factor": cost_result.severity_factor,
                    "location_factor": cost_result.location_factor,
                    "repair_method":   cost_result.repair_method,
                    "priority_level":  cost_result.priority_level,
                    "priority_code":   cost_result.priority_code,
                    "currency":        cost_result.currency,
                }

                await clusters_col.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "properties.detection_ids":   merged_ids,
                        "properties.points_count":    merged_count,
                        "properties.avg_severity":    merged_severity,
                        "properties.avg_confidence":  merged_conf,
                        "properties.repeat_count":    repeat_count,
                        "properties.final_risk_score": risk_result.final_risk_score,
                        "properties.risk_level":       risk_result.risk_level,
                        "properties.temporal_status":  temporal_status,
                        "properties.status":           status, # Updated status
                        "properties.repair_cost":      repair_cost_dict,
                        "last_detected":               last_detected,
                        "updated_at":                  datetime.utcnow(),
                    }}
                )
                cluster_id = existing["_id"]
                session_cluster_ids.add(cluster_id)

                # Trigger Satellite Analysis in background if it's a significant repeat
                import asyncio
                if unique_days > 1 and aging_index is None:
                    asyncio.create_task(satellite_service.run_satellite_analysis(str(cluster_id), list(centroid)))

            else:
                # 4e. Calculate Cost
                cost_result = RepairCostModel.estimate(
                    damage_type    = damage_type,
                    severity_score = avg_severity,
                    road_type      = "local",  # fallback, can be enriched later
                    risk_score     = risk_result.final_risk_score,
                )
                repair_cost_dict = {
                    "estimated_cost":  cost_result.estimated_cost,
                    "base_cost":       cost_result.base_cost,
                    "severity_factor": cost_result.severity_factor,
                    "location_factor": cost_result.location_factor,
                    "repair_method":   cost_result.repair_method,
                    "priority_level":  cost_result.priority_level,
                    "priority_code":   cost_result.priority_code,
                    "currency":        cost_result.currency,
                }

                # Create new cluster document
                cluster_doc = {
                    "type":     "Feature",
                    "geometry": {"type": "Point", "coordinates": list(centroid)},
                    "properties": {
                        "detection_ids":    detection_ids,
                        "points_count":     len(cluster_dets),
                        "radius_meters":    round(max_radius, 2),
                        "eps_used_meters":  model.eps_meters,
                        "video_id":         video_id,          # Added for session tracking
                        "damage_type":      damage_type,       # primary type of this cluster
                        "damage_types":     damage_type_counts,
                        "avg_severity":     round(avg_severity, 4),
                        "avg_confidence":   round(avg_conf, 4),
                        "aging_index":      aging_index,
                        "final_risk_score": risk_result.final_risk_score,
                        "risk_level":       risk_result.risk_level,
                        "repeat_count":     repeat_count,
                        "temporal_status":  temporal_status,
                        "status":           "pending",
                        "repair_cost":      repair_cost_dict,
                        "repair_history":   [],
                    },
                    "road_id":       None,
                    "area_id":       None,
                    "first_detected": first_detected,
                    "last_detected":  last_detected,
                    "created_at":     datetime.utcnow(),
                    "updated_at":     datetime.utcnow(),
                }
                res        = await clusters_col.insert_one(cluster_doc)
                cluster_id = res.inserted_id
                session_cluster_ids.add(cluster_id)
                group_clusters_created += 1

                import asyncio
                asyncio.create_task(satellite_service.run_satellite_analysis(str(cluster_id), list(centroid)))

            # Step 5: Write cluster_id back to detections + mark processed
            await detections_col.update_many(
                {"_id": {"$in": detection_ids}},
                {"$set": {"cluster_id": cluster_id, "processed": True}}
            )
            total_processed += len(cluster_dets)

        total_clusters_created += group_clusters_created
        per_type_summary[damage_type] = {
            "detections":        len(group_detections),
            "clusters_created":  group_clusters_created,
            "eps_meters":        model.eps_meters,
        }

    # ── Step 6: Update Video Upload Status + mark clustered ──────────────────
    if video_id:
        uploads_col = get_collection(Collections.VIDEO_UPLOADS)
        await uploads_col.update_one(
            {"video_id": video_id},
            {
                "$set": {
                    "status": "completed",
                    "clustered": True,          # idempotency guard — prevents re-run
                    "updated_at": datetime.utcnow()
                }
            }
        )


    # --- Step 4 Output Formatting: JSON list of unique Pothole IDs with Centroid and Risk ---
    final_potholes = []
    try:
        # Fetch the clusters that were actually hit during this session
        cluster_list = await clusters_col.find(
            {"_id": {"$in": list(session_cluster_ids)}}
        ).to_list(None)
        
        for c in cluster_list:
            # We filter for Potholes specifically as requested by Step 4
            dtype = c["properties"].get("damage_type", "unknown")
            if dtype.lower() == "pothole":
                final_potholes.append({
                    "id": str(c["_id"]),
                    "centroid": c["geometry"]["coordinates"],
                    "damage_type": dtype,
                    "final_risk_score": c["properties"]["final_risk_score"]
                })
    except Exception:
        pass

    return {
        "status":               "completed",
        "clusters_created":     total_clusters_created,
        "detections_processed": total_processed,
        "per_type_breakdown":   per_type_summary,
        "pothole_summary":      final_potholes, # The requested Step 4 Output
        "message": (
            f"Clustering complete. {total_clusters_created} new cluster(s) created "
            f"from {total_processed} detection(s). Road and Temporal checks applied."
        ),
    }
