import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS, PAGINATION } from '@/utils/constants';

/**
 * GET /api/v1/areas
 * Get area grid data for heatmap visualization
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page')) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    
    // Filters
    const riskLevel = searchParams.get('risk_level');
    const month = searchParams.get('month'); // Format: YYYY-MM
    const minRiskScore = parseFloat(searchParams.get('min_risk_score'));
    
    // Bounding box
    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));
    
    // Build query
    const query = {};
    
    if (riskLevel) {
      query['properties.risk_level'] = riskLevel;
    }
    
    if (month) {
      query['properties.month'] = month;
    }
    
    if (!isNaN(minRiskScore)) {
      query['properties.avg_risk_score'] = { $gte: minRiskScore };
    }
    
    // Bounding box query for polygon centroids
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
      query.geometry = {
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
    
    const collection = await getCollection(COLLECTIONS.AREAS);
    
    const total = await collection.countDocuments(query);
    const areas = await collection
      .find(query)
      .sort({ 'properties.avg_risk_score': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    // Return as GeoJSON FeatureCollection
    return NextResponse.json({
      type: 'FeatureCollection',
      features: areas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('List areas error:', error);
    return NextResponse.json(
      { error: 'Failed to list areas', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
