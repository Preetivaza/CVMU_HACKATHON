import { MapDataController } from '@/controllers/mapData.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await MapDataController.getData(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to get map data', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
