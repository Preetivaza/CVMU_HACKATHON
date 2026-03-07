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
import { verifyAuth } from '@/lib/auth';
import { UserModel } from '@/models/user.model';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'sadaksurksha_internal_ml_service_2026';

export class DetectionController {
  /** POST /api/v1/detections/bulk — receive bulk detections from AI engine */
  static async bulkCreate(request) {
    // ── Auth: Accept either user JWT (via middleware) or internal service key ─
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY;
    
    let tokenUser = null;
    if (!isInternalCall) {
      const { isValid, user } = await verifyAuth(request);
      if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized. A valid Bearer token or X-Internal-Key is required.' }, { status: HTTP_STATUS.UNAUTHORIZED });
      }
      tokenUser = user;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body = await request.json();
    let originalDetections = [];
    let videoId = null;

    // Fetch full user if this is a zone_officer to get their geometry
    let dbUser = null;
    if (tokenUser && tokenUser.role === 'zone_officer') {
      dbUser = await UserModel.findById(tokenUser.userId);
    }

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
        // Handle both GeoJSON Feature format (from AI script) and flat format (legacy)
        let doc;
        if (detection.type === 'Feature' && detection.properties) {
          // GeoJSON Feature format — pass through with tracking fields
          doc = {
            type: 'Feature',
            geometry: detection.geometry || null,
            properties: {
              ...detection.properties,
              video_id: detection.properties.video_id || videoId,
            },
            cluster_id: null,
            processed: false,
            created_at: new Date(),
          };
        } else {
          // Legacy flat format (conditions/damage_score)
          const damageType = Object.keys(detection.conditions || {})[0] || 'Unknown';
          doc = {
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
          };
        }
        // Check zone boundaries if this is a zone_officer
        if (dbUser && dbUser.authority_zone?.geometry?.coordinates) {
          const coords = detection.geometry?.coordinates || 
                        [props.longitude || props.lon, props.latitude || props.lat];
          
          if (coords[0] && coords[1]) {
            const polygon = dbUser.authority_zone.geometry.coordinates[0]; // Exterior ring
            let inside = false;
            for (let ii = 0, jj = polygon.length - 1; ii < polygon.length; jj = ii++) {
              const xi = polygon[ii][0], yi = polygon[ii][1];
              const xj = polygon[jj][0], yj = polygon[jj][1];
              const intersect = ((yi > coords[1]) !== (yj > coords[1])) &&
                (coords[0] < (xj - xi) * (coords[1] - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            if (!inside) {
              validationErrors.push({ index: i, errors: [`Coordinate [${coords[1]}, ${coords[0]}] is outside your assigned zone: ${dbUser.authority_zone.name}`] });
              continue; 
            }
          }
        }

        validDetections.push(doc);
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

    // If no GPS CSV was uploaded, backfill gps_data from AI detection coordinates
    const extraFields = {
      'processing_result.detections_count': validDetections.length,
    };
    try {
      const videoDoc = await UploadModel.findByVideoId(videoId);
      if (videoDoc && (!videoDoc.gps_data || videoDoc.gps_data.length === 0)) {
        const gpsPoints = validDetections
          .filter(d => d.geometry && d.geometry.coordinates)
          .map(d => ({
            timestamp: d.properties?.timestamp ? new Date(d.properties.timestamp) : new Date(),
            latitude: d.geometry.coordinates[1],
            longitude: d.geometry.coordinates[0],
            speed: d.properties?.vehicle_speed || 0,
          }));
        if (gpsPoints.length > 0) {
          extraFields.gps_data = gpsPoints;
        }
      }
    } catch (err) {
      console.error('Failed to backfill gps_data:', err);
    }

    await UploadModel.updateStatus(videoId, 'completed', extraFields);

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
