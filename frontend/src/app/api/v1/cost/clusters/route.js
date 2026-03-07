import { CostController } from '@/controllers/cost.controller';
import { HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { isValid } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    return await CostController.getClusterEstimates(request);
  }
  catch (e) { return NextResponse.json({ error: 'Failed to fetch cluster cost estimates', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR }); }
}
