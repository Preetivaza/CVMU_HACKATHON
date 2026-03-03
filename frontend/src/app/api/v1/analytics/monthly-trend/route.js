import { AnalyticsController } from '@/controllers/analytics.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try { return await AnalyticsController.monthlyTrend(request); }
  catch (e) { return NextResponse.json({ error: 'Failed to get monthly trend', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
