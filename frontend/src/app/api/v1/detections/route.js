import { DetectionController } from '@/controllers/detection.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await DetectionController.list(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to list detections', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
