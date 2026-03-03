/**
 * DETECTION CONTROLLER
 * Business logic for: POST /api/v1/detections/bulk, GET /api/v1/detections
 */
import { NextResponse } from 'next/server';
import { validateDetection } from '@/utils/validators';
import { HTTP_STATUS, DAMAGE_TYPES, PAGINATION } from '@/utils/constants';
import { DetectionModel } from '@/models/detection.model';
import { UploadModel } from '@/models/upload.model';

export class DetectionController {
  /** POST /api/v1/detections/bulk — receive bulk detections from Member 1 */
  static async bulkCreate(request) {
    const body = await request.json();
    const { video_id, model_version, detections } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    if (!Array.isArray(detections) || detections.length === 0) {
      return NextResponse.json({ error: 'detections array is required and must not be empty' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const validationErrors = [];
    const validDetections = [];

    for (let i = 0; i < detections.length; i++) {
      const { isValid, errors } = validateDetection(detections[i]);
      if (!isValid) {
        validationErrors.push({ index: i, errors });
      } else {
        const d = detections[i];
        validDetections.push({
          type: 'Feature',
          geometry: d.geometry,
          properties: {
            video_id,
            frame_id: d.properties.frame_id,
            timestamp: d.properties.timestamp ? new Date(d.properties.timestamp) : new Date(),
            damage_type: d.properties.damage_type,
            confidence: d.properties.confidence,
            bbox_area_ratio: d.properties.bbox_area_ratio || 0,
            normalized_acceleration: d.properties.normalized_acceleration || 0,
            severity_score: d.properties.severity_score,
            confidence_level: d.properties.confidence_level || 'medium',
            vehicle_speed: d.properties.vehicle_speed || 0,
            possible_duplicate: d.properties.possible_duplicate || false,
            model_version: model_version || 'unknown',
          },
          cluster_id: null,
          processed: false,
          created_at: new Date(),
        });
      }
    }

    if (validationErrors.length > 0 && validDetections.length === 0) {
      return NextResponse.json(
        { error: 'All detections failed validation', validation_errors: validationErrors },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const insertResult = await DetectionModel.bulkInsert(validDetections);

    await UploadModel.updateStatus(video_id, 'completed', {
      'processing_result.detections_count': validDetections.length,
    });

    return NextResponse.json({
      message: 'Detections received successfully',
      inserted_count: insertResult.insertedCount,
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      video_id,
    }, { status: HTTP_STATUS.CREATED });
  }

  /** GET /api/v1/detections — list with filters, pagination, and optional geo-query */
  static async list(request) {
    const { searchParams } = new URL(request.url);

    const page  = parseInt(searchParams.get('page'))  || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};

    if (searchParams.get('video_id'))   query['properties.video_id']    = searchParams.get('video_id');
    if (searchParams.get('damage_type')) query['properties.damage_type'] = searchParams.get('damage_type');

    const minConf = parseFloat(searchParams.get('min_confidence'));
    const maxConf = parseFloat(searchParams.get('max_confidence'));
    if (!isNaN(minConf) || !isNaN(maxConf)) {
      query['properties.confidence'] = {};
      if (!isNaN(minConf)) query['properties.confidence'].$gte = minConf;
      if (!isNaN(maxConf)) query['properties.confidence'].$lte = maxConf;
    }

    const processed = searchParams.get('processed');
    if (processed !== null && processed !== undefined) query.processed = processed === 'true';

    const startDate = searchParams.get('start_date');
    const endDate   = searchParams.get('end_date');
    if (startDate || endDate) {
      query['properties.timestamp'] = {};
      if (startDate) query['properties.timestamp'].$gte = new Date(startDate);
      if (endDate)   query['properties.timestamp'].$lte = new Date(endDate);
    }

    const lat    = parseFloat(searchParams.get('lat'));
    const lon    = parseFloat(searchParams.get('lon'));
    const radius = parseFloat(searchParams.get('radius')) || 1000;
    if (!isNaN(lat) && !isNaN(lon)) {
      query.geometry = {
        $near: { $geometry: { type: 'Point', coordinates: [lon, lat] }, $maxDistance: radius },
      };
    }

    const { total, items } = await DetectionModel.findWithFilters({ query, page, limit });

    return NextResponse.json({
      type: 'FeatureCollection',
      features: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
}
