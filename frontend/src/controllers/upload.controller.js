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
import { UPLOAD_LIMITS, HTTP_STATUS, ML_SERVICE_URL } from '@/utils/constants';

/** 
 * Robust CSV Parsing 
 * Handles multiple header variations: [lat, latitude], [lon, longitude, lng], [timestamp, time]
 */
function parseCSV(content) {
  const lines = content.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Normalize headers
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const mapping = {
    latitude: headers.findIndex(h => h === 'latitude' || h === 'lat'),
    longitude: headers.findIndex(h => h === 'longitude' || h === 'lon' || h === 'lng'),
    timestamp: headers.findIndex(h => h === 'timestamp' || h === 'time'),
    speed: headers.findIndex(h => h === 'speed' || h === 'velocity'),
    x: headers.findIndex(h => h === 'x' || h === 'acc_x'),
    y: headers.findIndex(h => h === 'y' || h === 'acc_y'),
    z: headers.findIndex(h => h === 'z' || h === 'acc_z')
  };

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};

    if (mapping.timestamp !== -1 && values[mapping.timestamp]) {
      row.timestamp = new Date(values[mapping.timestamp]);
    } else {
      row.timestamp = new Date(); // Fallback
    }

    if (mapping.latitude !== -1) row.latitude = parseFloat(values[mapping.latitude]);
    if (mapping.longitude !== -1) row.longitude = parseFloat(values[mapping.longitude]);
    if (mapping.speed !== -1) row.speed = parseFloat(values[mapping.speed]) || 0;
    if (mapping.x !== -1) row.x = parseFloat(values[mapping.x]) || 0;
    if (mapping.y !== -1) row.y = parseFloat(values[mapping.y]) || 0;
    if (mapping.z !== -1) row.z = parseFloat(values[mapping.z]) || 0;

    return (row.latitude || row.x) ? row : null;
  }).filter(Boolean);
}

export class UploadController {
  /** POST /api/upload/video — receives video + GPS + accelerometer files */
  static async uploadVideo(request) {
    try {
      const formData = await request.formData();
      const videoFile = formData.get('video');
      const gpsFile = formData.get('gps');
      const accelerometerFile = formData.get('accelerometer');

      if (!videoFile || !(videoFile instanceof File)) {
        return NextResponse.json({ error: 'Video file is required' }, { status: HTTP_STATUS.BAD_REQUEST });
      }

      const videoId = `upload_${uuidv4().slice(0, 12)}`;
      const fileExtension = path.extname(videoFile.name) || '.mp4';
      const fileName = `${videoId}${fileExtension}`;

      // Ensure directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

      // Save File
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      await writeFile(path.join(uploadsDir, fileName), videoBuffer);

      // Parse Data
      const gpsData = gpsFile instanceof File ? parseCSV(await gpsFile.text()) : [];
      const accelerometerData = accelerometerFile instanceof File ? parseCSV(await accelerometerFile.text()) : [];

      // Create Database Record
      const uploadDoc = await UploadModel.create({
        video_id: videoId,
        original_filename: videoFile.name,
        storage_path: `/uploads/${fileName}`,
        file_size: videoFile.size,
        status: 'processing', // Auto-transition to processing
        gps_data: gpsData,
        accelerometer_data: accelerometerData,
        processing_result: {
          total_frames: null,
          processed_frames: 0,
          detections_count: 0
        },
        created_at: new Date(),
        updated_at: new Date(),
      });

      // ── STEP 1: AI DETECTIONS TRIGGER ─────────────────────────────────────
      // Since we now have the video saved locally, trigger the python script
      const { spawn } = require('child_process');
      const pythonScriptPath = path.resolve(process.cwd(), '../ai-detection/detect_road_damage.py');
      const videoFullPath = path.resolve(uploadsDir, fileName);

      console.log(`[Upload] Triggering AI detection on: ${videoFullPath}`);

      const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'sadaksurksha_internal_ml_service_2026';

      // We run this detached/asynchronously so it doesn't block the API response
      const pythonProcess = spawn('python', [
        pythonScriptPath,
        '--video', videoFullPath,
        '--api_url', 'http://localhost:3000/api/v1/detections/bulk',
        '--export',
        '--video_id', videoId,
        '--internal_key', INTERNAL_KEY
      ], {
        cwd: path.resolve(process.cwd(), '../ai-detection')
      });


      pythonProcess.stdout.on('data', (data) => {
        console.log(`[AI Detection - ${videoId}]: ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[AI Detection Error - ${videoId}]: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`[AI Detection - ${videoId}] child process exited with code ${code}`);
        if (code === 0) {
          // ── STEP 2: ML CLUSTERING TRIGGER ──────────────────────────────
          try {
            const mlTriggerUrl = `${ML_SERVICE_URL}/ml/clustering/run`;
            console.log(`[Upload] AI complete. Triggering ML clustering at: ${mlTriggerUrl}`);

            fetch(mlTriggerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ video_id: videoId, force_recluster: true })
            }).catch(err => console.error('[Upload] ML Trigger failed (async):', err.message));
          } catch (mlErr) {
            console.error('[Upload] ML Trigger sync error:', mlErr.message);
          }
        } else {
          console.error(`[Upload] AI detection failed for ${videoId}. Skipping clustering.`);
          UploadModel.updateStatus(videoId, 'failed');
        }
      });
      // ─────────────────────────────────────────────────────────────────────

      return NextResponse.json({
        success: true,
        video_id: videoId,
        video_url: `/uploads/${fileName}`,
        data_points: {
          gps: gpsData.length,
          accelerometer: accelerometerData.length
        },
        status: 'processing'
      }, { status: HTTP_STATUS.CREATED });

    } catch (error) {
      console.error('[UploadController] Error:', error);
      return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
  }

  /** GET /api/upload/video — list all uploads */
  static async listUploads(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = 20;

    const { total, items } = await UploadModel.findWithFilters({ page, limit });

    return NextResponse.json({
      data: items,
      pagination: { page, total, totalPages: Math.ceil(total / limit) },
    });
  }

  /** GET /api/upload/status/:id — check processing status */
  static async getStatus(request, id) {
    const upload = await UploadModel.findByVideoId(id);
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }
    return NextResponse.json(upload);
  }
}
