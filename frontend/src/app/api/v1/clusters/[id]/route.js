import { ClusterController } from '@/controllers/cluster.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try { const { id } = await params; return await ClusterController.getById(request, id); }
  catch (e) { return NextResponse.json({ error: 'Failed to get cluster', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}

export async function PATCH(request, { params }) {
  try { const { id } = await params; return await ClusterController.updateStatus(request, id); }
  catch (e) { return NextResponse.json({ error: 'Failed to update cluster', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}

export async function DELETE(request, { params }) {
  try { const { id } = await params; return await ClusterController.deleteById(request, id); }
  catch (e) { return NextResponse.json({ error: 'Failed to delete cluster', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
