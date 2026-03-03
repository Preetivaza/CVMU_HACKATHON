/**
 * MAP DATA CONTROLLER
 * Business logic for: GET /api/v1/map-data
 * Returns zoom-aware layered GeoJSON for the map dashboard.
 */
import { NextResponse } from 'next/server';
import { AreaModel } from '@/models/area.model';
import { ClusterModel } from '@/models/cluster.model';
import { DetectionModel } from '@/models/detection.model';
import { RoadModel } from '@/models/road.model';
import { HTTP_STATUS, ZOOM_LEVELS } from '@/utils/constants';

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

    const response = { zoom_level: zoom, layers: {} };

    // Roads are always returned regardless of zoom
    const roads = await RoadModel.findInBBox(bboxQuery, 500);
    response.layers.roads = { type: 'FeatureCollection', features: roads };

    if (zoom <= ZOOM_LEVELS.HEATMAP_MAX) {
      // Low zoom → heatmap areas
      const areas = await AreaModel.findInBBox(bboxQuery, 500);
      response.layers.heatmap = { type: 'FeatureCollection', features: areas };
      response.display_mode   = 'heatmap';

    } else if (zoom <= ZOOM_LEVELS.CLUSTER_MAX) {
      // Medium zoom → cluster circles
      const { items } = await ClusterModel.findWithFilters({ query: bboxQuery, limit: 500 });
      response.layers.clusters = { type: 'FeatureCollection', features: items };
      response.display_mode    = 'clusters';

    } else {
      // High zoom → individual detection points + clusters for context
      const [{ items: detections }, { items: clusters }] = await Promise.all([
        DetectionModel.findWithFilters({ query: pointBboxQuery, limit: 1000 }),
        ClusterModel.findWithFilters({ query: bboxQuery, limit: 200 }),
      ]);
      response.layers.points   = { type: 'FeatureCollection', features: detections };
      response.layers.clusters = { type: 'FeatureCollection', features: clusters };
      response.display_mode    = 'points';
    }

    // Summary counts
    const [totalClusters, criticalClusters, highRiskClusters] = await Promise.all([
      ClusterModel.count(bboxQuery),
      ClusterModel.count({ ...bboxQuery, 'properties.risk_level': 'Critical' }),
      ClusterModel.count({ ...bboxQuery, 'properties.risk_level': 'High' }),
    ]);

    response.summary = { total_clusters: totalClusters, critical_clusters: criticalClusters, high_risk_clusters: highRiskClusters };

    return NextResponse.json(response);
  }
}
