import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS } from '@/utils/constants';

/**
 * GET /api/upload/status/[id]
 * Check upload processing status
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    const upload = await collection.findOne({ video_id: id });
    
    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    
    return NextResponse.json({
      video_id: upload.video_id,
      status: upload.status,
      video_url: upload.storage_path,
      processing_result: upload.processing_result,
      created_at: upload.created_at,
      updated_at: upload.updated_at,
    });
    
  } catch (error) {
    console.error('Get upload status error:', error);
    return NextResponse.json(
      { error: 'Failed to get upload status' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * PATCH /api/upload/status/[id]
 * Update upload status (used by Member 1 after processing)
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    
    const updateFields = {
      updated_at: new Date(),
    };
    
    // Allow updating specific fields
    if (body.status) {
      updateFields.status = body.status;
    }
    if (body.duration_seconds !== undefined) {
      updateFields.duration_seconds = body.duration_seconds;
    }
    if (body.fps !== undefined) {
      updateFields.fps = body.fps;
    }
    if (body.processing_result) {
      updateFields.processing_result = body.processing_result;
    }
    
    const result = await collection.updateOne(
      { video_id: id },
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    
    const updated = await collection.findOne({ video_id: id });
    
    return NextResponse.json({
      message: 'Upload status updated',
      data: updated,
    });
    
  } catch (error) {
    console.error('Update upload status error:', error);
    return NextResponse.json(
      { error: 'Failed to update upload status' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
