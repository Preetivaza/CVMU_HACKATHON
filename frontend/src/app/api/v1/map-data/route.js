import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS, ZOOM_LEVELS } from '@/utils/constants';

/**
 * GET /api/v1/map-data
 * Combined map data endpoint with zoom-based filtering
 * 
 * Zoom levels:
 * - 0-12: Returns heatmap (areas)
 * - 12-15: Returns cluster circles
 * - 15+: Returns individual detection points
 * - Roads are always returned
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Required parameters
    const zoom = parseFloat(searchParams.get('zoom'));
    
    // Bounding box
    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));
    
    // Validate zoom
    if (isNaN(zoom)) {
      return NextResponse.json(
        { error: 'zoom parameter is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Build bounding box query
    const bboxQuery = {};
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
      bboxQuery.geometry = {
        $geoIntersects: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat],
            ]],
          },
        },
      };
    }
    
    const response = {
      zoom_level: zoom,
      layers: {},
    };
    
    // Always include roads
    const roadsCollection = await getCollection(COLLECTIONS.ROADS);
    const roads = await roadsCollection
      .find(bboxQuery)
      .limit(500)
      .toArray();
    
    response.layers.roads = {
      type: 'FeatureCollection',
      features: roads,
    };
    
    // Zoom-based layer selection
    if (zoom <= ZOOM_LEVELS.HEATMAP_MAX) {
      // Low zoom: Return heatmap areas
      const areasCollection = await getCollection(COLLECTIONS.AREAS);
      const areas = await areasCollection
        .find(bboxQuery)
        .limit(500)
        .toArray();
      
      response.layers.heatmap = {
        type: 'FeatureCollection',
        features: areas,
      };
      response.display_mode = 'heatmap';
      
    } else if (zoom <= ZOOM_LEVELS.CLUSTER_MAX) {
      // Medium zoom: Return cluster circles
      const clustersCollection = await getCollection(COLLECTIONS.CLUSTERS);
      const clusters = await clustersCollection
        .find(bboxQuery)
        .limit(500)
        .toArray();
      
      response.layers.clusters = {
        type: 'FeatureCollection',
        features: clusters,
      };
      response.display_mode = 'clusters';
      
    } else {
      // High zoom: Return individual points
      const detectionsCollection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
      
      // Use point-based query for detections
      const pointBboxQuery = {};
      if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
        pointBboxQuery.geometry = {
          $geoWithin: {
            $box: [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
          },
        };
      }
      
      const detections = await detectionsCollection
        .find(pointBboxQuery)
        .limit(1000)
        .toArray();
      
      // Also include clusters at high zoom for context
      const clustersCollection = await getCollection(COLLECTIONS.CLUSTERS);
      const clusters = await clustersCollection
        .find(bboxQuery)
        .limit(200)
        .toArray();
      
      response.layers.points = {
        type: 'FeatureCollection',
        features: detections,
      };
      response.layers.clusters = {
        type: 'FeatureCollection',
        features: clusters,
      };
      response.display_mode = 'points';
    }
    
    // Add summary counts
    const clustersCollection = await getCollection(COLLECTIONS.CLUSTERS);
    const totalClusters = await clustersCollection.countDocuments(bboxQuery);
    const criticalClusters = await clustersCollection.countDocuments({
      ...bboxQuery,
      'properties.risk_level': 'Critical',
    });
    const highRiskClusters = await clustersCollection.countDocuments({
      ...bboxQuery,
      'properties.risk_level': 'High',
    });
    
    response.summary = {
      total_clusters: totalClusters,
      critical_clusters: criticalClusters,
      high_risk_clusters: highRiskClusters,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Map data error:', error);
    return NextResponse.json(
      { error: 'Failed to get map data', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
