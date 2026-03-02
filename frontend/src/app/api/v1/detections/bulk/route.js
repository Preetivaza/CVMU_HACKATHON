import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { validateDetection } from '@/utils/validators';
import { HTTP_STATUS, DAMAGE_TYPES } from '@/utils/constants';

/**
 * POST /api/v1/detections/bulk
 * Receive bulk detections from Member 1's AI engine
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    const { video_id, model_version, detections } = body;
    
    // Validate required fields
    if (!video_id) {
      return NextResponse.json(
        { error: 'video_id is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    if (!detections || !Array.isArray(detections) || detections.length === 0) {
      return NextResponse.json(
        { error: 'detections array is required and must not be empty' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate each detection
    const validationErrors = [];
    const validDetections = [];
    
    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];
      const { isValid, errors } = validateDetection(detection);
      
      if (!isValid) {
        validationErrors.push({
          index: i,
          errors,
        });
      } else {
        // Prepare detection document for MongoDB
        validDetections.push({
          type: 'Feature',
          geometry: detection.geometry,
          properties: {
            video_id,
            frame_id: detection.properties.frame_id,
            timestamp: detection.properties.timestamp ? new Date(detection.properties.timestamp) : new Date(),
            damage_type: detection.properties.damage_type,
            confidence: detection.properties.confidence,
            bbox_area_ratio: detection.properties.bbox_area_ratio || 0,
            normalized_acceleration: detection.properties.normalized_acceleration || 0,
            severity_score: detection.properties.severity_score,
            confidence_level: detection.properties.confidence_level || 'medium',
            vehicle_speed: detection.properties.vehicle_speed || 0,
            possible_duplicate: detection.properties.possible_duplicate || false,
            model_version: model_version || 'unknown',
          },
          cluster_id: null,
          processed: false,
          created_at: new Date(),
        });
      }
    }
    
    // If there are validation errors, return them
    if (validationErrors.length > 0 && validDetections.length === 0) {
      return NextResponse.json(
        { 
          error: 'All detections failed validation',
          validation_errors: validationErrors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Insert valid detections
    const detectionsCollection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    const insertResult = await detectionsCollection.insertMany(validDetections);
    
    // Update video upload status
    const uploadsCollection = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    await uploadsCollection.updateOne(
      { video_id },
      {
        $set: {
          status: 'completed',
          'processing_result.detections_count': validDetections.length,
          updated_at: new Date(),
        },
      }
    );
    
    return NextResponse.json({
      message: 'Detections received successfully',
      inserted_count: insertResult.insertedCount,
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      video_id,
    }, { status: HTTP_STATUS.CREATED });
    
  } catch (error) {
    console.error('Bulk detection upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process detections', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
