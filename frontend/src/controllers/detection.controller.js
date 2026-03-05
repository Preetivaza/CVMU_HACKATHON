/**
 * DETECTION CONTROLLER
 * Business logic for: POST /api/v1/detections/bulk, GET /api/v1/detections
 */
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateDetection } from '@/utils/validators';
import { HTTP_STATUS, PAGINATION } from '@/utils/constants';
import { DetectionModel } from '@/models/detection.model';
import { UploadModel } from '@/models/upload.model';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'sadaksurksha_internal_ml_service_2026';

export class DetectionController {
  /** POST /api/v1/detections/bulk — receive bulk detections from AI engine */
  static async bulkCreate(request) {
    // ── Auth: Accept either user JWT (via middleware) or internal service key ─
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY;
    if (!isInternalCall) {
      // Check for user auth if not an internal service call
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. A valid Bearer token or X-Internal-Key is required.' }, { status: HTTP_STATUS.UNAUTHORIZED });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body = await request.json();
    let originalDetections = [];
    let videoId = null;

    if (Array.isArray(body)) {
      originalDetections = body;
      if (originalDetections.length > 0) {
        videoId = originalDetections[0].video_id || originalDetections[0]?.properties?.video_id;
      }
    } else if (body.detections && Array.isArray(body.detections)) {
      originalDetections = body.detections;
      videoId = body.video_id || (originalDetections.length > 0 ? (originalDetections[0]?.properties?.video_id || originalDetections[0]?.video_id) : null);
    } else {
      return NextResponse.json({ error: 'Invalid payload format. Expected an array of detections or { detections: [...] }' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    if (!videoId) {
      return NextResponse.json({ error: 'video_id is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const validationErrors = [];
    const validDetections = [];

    for (let i = 0; i < originalDetections.length; i++) {
      const detection = originalDetections[i];
      const { isValid, errors } = validateDetection(detection);

      if (!isValid) {
        validationErrors.push({ index: i, errors });
      } else {
        // map condition key to damage_type
        const damageType = Object.keys(detection.conditions || {})[0] || 'Unknown';

        validDetections.push({
          type: 'Feature',
          geometry: null,
          properties: {
            video_id: detection.video_id || videoId,
            frame_id: detection.frame_id,
            timestamp: detection.timestamp,
            damage_type: damageType,
            confidence: detection.confidence_level || 0,
            severity_score: detection.damage_score || 0,
            severity_label: detection.severity || 'Unknown',
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

    let insertCount = 0;
    if (validDetections.length > 0) {
      const insertResult = await DetectionModel.bulkInsert(validDetections);
      insertCount = insertResult.insertedCount;
    }

    await UploadModel.updateStatus(videoId, 'completed', {
      'processing_result.detections_count': validDetections.length,
    });

    try {
      const videoDoc = await UploadModel.findById(videoId);
      if (videoDoc && videoDoc.storage_path) {
        const uploadsDir = path.join(process.cwd(), 'public');
        const fullPath = path.join(uploadsDir, videoDoc.storage_path);
        await fs.unlink(fullPath);
        console.log(`Deleted processed video: ${fullPath}`);
      }
    } catch (err) {
      console.error('Failed to delete video file:', err);
    }

    return NextResponse.json({
      message: 'Detections received successfully',
      inserted_count: insertCount,
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      video_id: videoId,
    }, { status: HTTP_STATUS.CREATED });
  }

  /** GET /api/v1/detections — list with filters, pagination, and optional geo-query */
  static async list(request) {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page')) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};

    if (searchParams.get('video_id')) query['properties.video_id'] = searchParams.get('video_id');
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
    const endDate = searchParams.get('end_date');
    if (startDate || endDate) {
      query['properties.timestamp'] = {};
      if (startDate) query['properties.timestamp'].$gte = new Date(startDate);
      if (endDate) query['properties.timestamp'].$lte = new Date(endDate);
    }

    const lat = parseFloat(searchParams.get('lat'));
    const lon = parseFloat(searchParams.get('lon'));
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
