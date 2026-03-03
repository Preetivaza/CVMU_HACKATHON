import { AuthController } from '@/controllers/auth.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try { return await AuthController.login(request); }
  catch (e) { return NextResponse.json({ error: 'Login failed', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
