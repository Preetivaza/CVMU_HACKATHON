import { AreaController } from '@/controllers/area.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await AreaController.list(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to list areas', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
