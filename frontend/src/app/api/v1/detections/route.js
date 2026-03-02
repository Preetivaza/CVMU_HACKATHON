import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS, PAGINATION } from '@/utils/constants';

/**
 * GET /api/v1/detections
 * List detections with filters
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
    const videoId = searchParams.get('video_id');
    const damageType = searchParams.get('damage_type');
    const minConfidence = parseFloat(searchParams.get('min_confidence'));
    const maxConfidence = parseFloat(searchParams.get('max_confidence'));
    const processed = searchParams.get('processed');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Geospatial filter
    const lat = parseFloat(searchParams.get('lat'));
    const lon = parseFloat(searchParams.get('lon'));
    const radius = parseFloat(searchParams.get('radius')) || 1000; // meters
    
    // Build query
    const query = {};
    
    if (videoId) {
      query['properties.video_id'] = videoId;
    }
    
    if (damageType) {
      query['properties.damage_type'] = damageType;
    }
    
    if (!isNaN(minConfidence) || !isNaN(maxConfidence)) {
      query['properties.confidence'] = {};
      if (!isNaN(minConfidence)) {
        query['properties.confidence'].$gte = minConfidence;
      }
      if (!isNaN(maxConfidence)) {
        query['properties.confidence'].$lte = maxConfidence;
      }
    }
    
    if (processed !== null && processed !== undefined) {
      query.processed = processed === 'true';
    }
    
    if (startDate || endDate) {
      query['properties.timestamp'] = {};
      if (startDate) {
        query['properties.timestamp'].$gte = new Date(startDate);
      }
      if (endDate) {
        query['properties.timestamp'].$lte = new Date(endDate);
      }
    }
    
    // Geospatial query (near a point)
    if (!isNaN(lat) && !isNaN(lon)) {
      query.geometry = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat],
          },
          $maxDistance: radius,
        },
      };
    }
    
    const collection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    
    const total = await collection.countDocuments(query);
    const detections = await collection
      .find(query)
      .sort({ 'properties.timestamp': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    // Return as GeoJSON FeatureCollection
    return NextResponse.json({
      type: 'FeatureCollection',
      features: detections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('List detections error:', error);
    return NextResponse.json(
      { error: 'Failed to list detections', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
