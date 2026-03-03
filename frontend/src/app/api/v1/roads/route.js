import { RoadController } from '@/controllers/road.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await RoadController.list(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to list roads', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
