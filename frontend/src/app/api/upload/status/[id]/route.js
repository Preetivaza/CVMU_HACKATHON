import { UploadController } from '@/controllers/upload.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    return await UploadController.getStatus(request, id);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get upload status', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
