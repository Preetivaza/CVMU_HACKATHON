import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS, PAGINATION, ML_SERVICE_URL } from '@/utils/constants';

/**
 * GET /api/v1/clusters
 * Get all clusters as GeoJSON FeatureCollection
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
    const status = searchParams.get('status');
    const minRiskScore = parseFloat(searchParams.get('min_risk_score'));
    const maxRiskScore = parseFloat(searchParams.get('max_risk_score'));
    
    // Geospatial filter (bounding box)
    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));
    
    // Build query
    const query = {};
    
    if (riskLevel) {
      query['properties.risk_level'] = riskLevel;
    }
    
    if (status) {
      query['properties.status'] = status;
    }
    
    if (!isNaN(minRiskScore) || !isNaN(maxRiskScore)) {
      query['properties.final_risk_score'] = {};
      if (!isNaN(minRiskScore)) {
        query['properties.final_risk_score'].$gte = minRiskScore;
      }
      if (!isNaN(maxRiskScore)) {
        query['properties.final_risk_score'].$lte = maxRiskScore;
      }
    }
    
    // Bounding box query
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
      query.geometry = {
        $geoWithin: {
          $box: [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
        },
      };
    }
    
    const collection = await getCollection(COLLECTIONS.CLUSTERS);
    
    const total = await collection.countDocuments(query);
    const clusters = await collection
      .find(query)
      .sort({ 'properties.final_risk_score': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    // Return as GeoJSON FeatureCollection
    return NextResponse.json({
      type: 'FeatureCollection',
      features: clusters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('List clusters error:', error);
    return NextResponse.json(
      { error: 'Failed to list clusters', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * POST /api/v1/clusters
 * Trigger clustering process (calls FastAPI ML service)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { video_id, force_recluster } = body;
    
    // Call FastAPI ML service to run clustering
    const mlResponse = await fetch(`${ML_SERVICE_URL}/ml/clustering/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id,
        force_recluster: force_recluster || false,
      }),
    });
    
    if (!mlResponse.ok) {
      const errorData = await mlResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Clustering service failed', details: errorData },
        { status: mlResponse.status }
      );
    }
    
    const result = await mlResponse.json();
    
    return NextResponse.json({
      message: 'Clustering completed',
      ...result,
    });
    
  } catch (error) {
    console.error('Trigger clustering error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger clustering', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
