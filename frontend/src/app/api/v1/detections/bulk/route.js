import { DetectionController } from '@/controllers/detection.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try { return await DetectionController.bulkCreate(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to process detections', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
