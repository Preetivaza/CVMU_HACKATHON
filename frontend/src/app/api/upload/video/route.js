import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { UPLOAD_LIMITS, HTTP_STATUS } from '@/utils/constants';

// Disable body parsing, we handle it manually for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Parse CSV data for GPS or accelerometer
 * @param {string} content - CSV content
 * @param {string} type - 'gps' or 'accelerometer'
 * @returns {Array}
 */
function parseCSV(content, type) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    
    headers.forEach((header, index) => {
      if (header === 'timestamp') {
        row.timestamp = new Date(values[index]);
      } else if (['latitude', 'longitude', 'speed', 'x', 'y', 'z'].includes(header)) {
        row[header] = parseFloat(values[index]);
      }
    });
    
    if (Object.keys(row).length > 0) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * POST /api/upload/video
 * Upload video file with optional GPS and accelerometer data
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const videoFile = formData.get('video');
    const gpsFile = formData.get('gps');
    const accelerometerFile = formData.get('accelerometer');
    
    // Validate video file
    if (!videoFile || !(videoFile instanceof File)) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Check file type
    if (!UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
      return NextResponse.json(
        { error: 'Invalid video format. Allowed: MP4, MPEG, MOV, AVI' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Check file size
    if (videoFile.size > UPLOAD_LIMITS.MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum size: 500MB' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Generate unique video ID
    const videoId = `upload_${uuidv4().slice(0, 12)}`;
    const fileExtension = path.extname(videoFile.name) || '.mp4';
    const fileName = `${videoId}${fileExtension}`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    // Save video file
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const videoPath = path.join(uploadsDir, fileName);
    await writeFile(videoPath, videoBuffer);
    
    // Parse GPS data if provided
    let gpsData = [];
    if (gpsFile && gpsFile instanceof File) {
      const gpsContent = await gpsFile.text();
      gpsData = parseCSV(gpsContent, 'gps');
    }
    
    // Parse accelerometer data if provided
    let accelerometerData = [];
    if (accelerometerFile && accelerometerFile instanceof File) {
      const accContent = await accelerometerFile.text();
      accelerometerData = parseCSV(accContent, 'accelerometer');
    }
    
    // Create video upload document
    const collection = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    const uploadDoc = {
      video_id: videoId,
      original_filename: videoFile.name,
      storage_path: `/uploads/${fileName}`,
      file_size: videoFile.size,
      duration_seconds: null, // Will be set by Member 1 after processing
      fps: null,
      status: 'uploaded',
      gps_data: gpsData,
      accelerometer_data: accelerometerData,
      processing_result: null,
      uploaded_by: null, // TODO: Get from auth
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    await collection.insertOne(uploadDoc);
    
    // Return response for Member 1
    return NextResponse.json({
      video_id: videoId,
      video_url: `/uploads/${fileName}`,
      gps_data: gpsData,
      accelerometer_data: accelerometerData,
      metadata: {
        uploaded_at: uploadDoc.created_at.toISOString(),
        file_size: videoFile.size,
        duration_seconds: null,
        fps: null,
      },
    }, { status: HTTP_STATUS.CREATED });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * GET /api/upload/video
 * List all uploaded videos
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    
    const collection = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const total = await collection.countDocuments(query);
    const uploads = await collection
      .find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    return NextResponse.json({
      data: uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('List uploads error:', error);
    return NextResponse.json(
      { error: 'Failed to list uploads' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
