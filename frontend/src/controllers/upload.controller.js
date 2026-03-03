/**
 * UPLOAD CONTROLLER
 * Business logic for: POST /api/upload/video, GET /api/upload/video, GET /api/upload/status/:id
 */
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UploadModel } from '@/models/upload.model';
import { UPLOAD_LIMITS, HTTP_STATUS } from '@/utils/constants';

/** Parse CSV content into array of objects for GPS or accelerometer data */
function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      if (header === 'timestamp') row.timestamp = new Date(values[idx]);
      else if (['latitude', 'longitude', 'speed', 'x', 'y', 'z'].includes(header))
        row[header] = parseFloat(values[idx]);
    });
    return Object.keys(row).length > 0 ? row : null;
  }).filter(Boolean);
}

export class UploadController {
  /** POST /api/upload/video — receives video + GPS + accelerometer files */
  static async uploadVideo(request) {
    const formData = await request.formData();
    const videoFile = formData.get('video');
    const gpsFile = formData.get('gps');
    const accelerometerFile = formData.get('accelerometer');

    if (!videoFile || !(videoFile instanceof File)) {
      return NextResponse.json({ error: 'Video file is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    if (!UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
      return NextResponse.json({ error: 'Invalid video format. Allowed: MP4, MPEG, MOV, AVI' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    if (videoFile.size > UPLOAD_LIMITS.MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: 'Video file too large. Maximum size: 500MB' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const videoId = `upload_${uuidv4().slice(0, 12)}`;
    const fileExtension = path.extname(videoFile.name) || '.mp4';
    const fileName = `${videoId}${fileExtension}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(path.join(uploadsDir, fileName), videoBuffer);

    const gpsData = gpsFile instanceof File ? parseCSV(await gpsFile.text()) : [];
    const accelerometerData = accelerometerFile instanceof File ? parseCSV(await accelerometerFile.text()) : [];

    await UploadModel.create({
      video_id: videoId,
      original_filename: videoFile.name,
      storage_path: `/uploads/${fileName}`,
      file_size: videoFile.size,
      duration_seconds: null,
      fps: null,
      status: 'uploaded',
      gps_data: gpsData,
      accelerometer_data: accelerometerData,
      processing_result: null,
      uploaded_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      video_id: videoId,
      video_url: `/uploads/${fileName}`,
      gps_data: gpsData,
      accelerometer_data: accelerometerData,
      metadata: {
        uploaded_at: new Date().toISOString(),
        file_size: videoFile.size,
        duration_seconds: null,
        fps: null,
      },
    }, { status: HTTP_STATUS.CREATED });
  }

  /** GET /api/upload/video — list all uploads with pagination */
  static async listUploads(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    const status = searchParams.get('status');

    const query = {};
    if (status) query.status = status;

    const { total, items } = await UploadModel.findWithFilters({ query, page, limit });

    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  /** GET /api/upload/status/:id — check processing status of an upload */
  static async getStatus(request, id) {
    const upload = await UploadModel.findByVideoId(id);
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }
    return NextResponse.json({
      video_id: upload.video_id,
      status: upload.status,
      processing_result: upload.processing_result,
      created_at: upload.created_at,
      updated_at: upload.updated_at,
    });
  }
}
