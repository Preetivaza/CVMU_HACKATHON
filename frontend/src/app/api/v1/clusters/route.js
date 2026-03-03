import { ClusterController } from '@/controllers/cluster.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await ClusterController.list(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to list clusters', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}

export async function POST(request) {
  try { return await ClusterController.triggerClustering(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to trigger clustering', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
