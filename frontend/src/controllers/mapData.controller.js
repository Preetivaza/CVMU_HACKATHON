/**
 * MAP DATA CONTROLLER
 * Business logic for: GET /api/v1/map-data
 * Returns zoom-aware layered GeoJSON for the map dashboard.
 * Applies role-based data filtering for zone_officer, state_authority, contractor.
 */
import { NextResponse } from 'next/server';
import { AreaModel } from '@/models/area.model';
import { ClusterModel } from '@/models/cluster.model';
import { DetectionModel } from '@/models/detection.model';
import { RoadModel } from '@/models/road.model';
import { HTTP_STATUS, ZOOM_LEVELS } from '@/utils/constants';
import { verifyAuth } from '@/lib/auth';
import { UserModel } from '@/models/user.model';
import { getDataFilter } from '@/utils/rbac';

/** Build a GeoJSON $geoIntersects bounding-box query */
function buildBBoxQuery(minLon, maxLon, minLat, maxLat) {
  if (isNaN(minLon) || isNaN(maxLon) || isNaN(minLat) || isNaN(maxLat)) return {};
  return {
    geometry: {
      $geoIntersects: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]],
        },
      },
    },
  };
}

/** Build a $geoWithin box query for point-type collections */
function buildPointBoxQuery(minLon, maxLon, minLat, maxLat) {
  if (isNaN(minLon) || isNaN(maxLon) || isNaN(minLat) || isNaN(maxLat)) return {};
  return { geometry: { $geoWithin: { $box: [[minLon, minLat], [maxLon, maxLat]] } } };
}

export class MapDataController {
  /** GET /api/v1/map-data */
  static async getData(request) {
    const { searchParams } = new URL(request.url);
    const zoom   = parseFloat(searchParams.get('zoom'));
    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));

    if (isNaN(zoom)) {
      return NextResponse.json({ error: 'zoom parameter is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const bboxQuery      = buildBBoxQuery(minLon, maxLon, minLat, maxLat);
    const pointBboxQuery = buildPointBoxQuery(minLon, maxLon, minLat, maxLat);

    // --- ROLE-BASED DATA MASKING for map layers ---
    let roleFilter = {};
    const { isValid, user: tokenUser } = await verifyAuth(request);
    if (isValid) {
      const user = await UserModel.findById(tokenUser.userId);
      roleFilter = getDataFilter(user);
    }

    // Merge bbox + role filter. Note: if roleFilter has 'geometry', it overrides bbox.
    // For zone_officer, their zone polygon IS their viewport — bbox not needed.
    const clusterQuery = Object.keys(roleFilter).length
      ? { ...bboxQuery, ...roleFilter }
      : bboxQuery;

    const pointQuery = Object.keys(roleFilter).length
      ? { ...pointBboxQuery, ...roleFilter }
      : pointBboxQuery;

    const response = { zoom_level: zoom, layers: {} };

    // Roads are always returned regardless of zoom
    const roads = await RoadModel.findInBBox(bboxQuery, 500);
    response.layers.roads = { type: 'FeatureCollection', features: roads };

    if (zoom <= ZOOM_LEVELS.HEATMAP_MAX) {
      // Low zoom → heatmap areas
      const areas = await AreaModel.findInBBox(clusterQuery, 500);
      response.layers.heatmap = { type: 'FeatureCollection', features: areas };
      response.display_mode   = 'heatmap';

    } else if (zoom <= ZOOM_LEVELS.CLUSTER_MAX) {
      // Medium zoom → cluster circles
      const { items } = await ClusterModel.findWithFilters({ query: clusterQuery, limit: 500 });
      response.layers.clusters = { type: 'FeatureCollection', features: items };
      response.display_mode    = 'clusters';

    } else {
      // High zoom → individual detection points + clusters for context
      const [{ items: detections }, { items: clusters }] = await Promise.all([
        DetectionModel.findWithFilters({ query: pointQuery, limit: 1000 }),
        ClusterModel.findWithFilters({ query: clusterQuery, limit: 200 }),
      ]);
      response.layers.points   = { type: 'FeatureCollection', features: detections };
      response.layers.clusters = { type: 'FeatureCollection', features: clusters };
      response.display_mode    = 'points';
    }

    // Summary counts (role-filtered)
    const [totalClusters, criticalClusters, highRiskClusters] = await Promise.all([
      ClusterModel.count(clusterQuery),
      ClusterModel.count({ ...clusterQuery, 'properties.risk_level': 'Critical' }),
      ClusterModel.count({ ...clusterQuery, 'properties.risk_level': 'High' }),
    ]);

    response.summary = { total_clusters: totalClusters, critical_clusters: criticalClusters, high_risk_clusters: highRiskClusters };

    return NextResponse.json(response);
  }
}
