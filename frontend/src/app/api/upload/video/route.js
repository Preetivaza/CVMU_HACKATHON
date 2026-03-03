// Disable body parsing for multipart form data
export const config = { api: { bodyParser: false } };

import { UploadController } from '@/controllers/upload.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try { return await UploadController.uploadVideo(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to upload video', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}

export async function GET(request) {
  try { return await UploadController.listUploads(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to list uploads' }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
