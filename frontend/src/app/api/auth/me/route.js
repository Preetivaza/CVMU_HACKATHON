import { AuthController } from '@/controllers/auth.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await AuthController.getMe(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to get user info', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}

export async function PATCH(request) {
  try { return await AuthController.updateMe(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to update profile', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
