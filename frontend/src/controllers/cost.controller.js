import { authFetch } from '@/utils/authFetch';
import { ML_SERVICE_URL, HTTP_STATUS } from '@/utils/constants';
import { NextResponse } from 'next/server';

export class CostController {
  static async getClusterEstimates(request) {
    try {
      const url = new URL(request.url);
      const limit = url.searchParams.get('limit') || 50;
      const skip = url.searchParams.get('skip') || 0;
      const clusterIds = url.searchParams.get('cluster_ids') || '';

      let mlUrl = `${ML_SERVICE_URL}/ml/cost/clusters?limit=${limit}&skip=${skip}`;
      if (clusterIds) {
        mlUrl += `&cluster_ids=${clusterIds}`;
      }

      const mlRes = await fetch(mlUrl);
      if (!mlRes.ok) {
        console.error(`ML Cost Service error: ${mlRes.status}`);
        return NextResponse.json({ error: 'Failed to fetch estimates from ML service' }, { status: mlRes.status });
      }

      const data = await mlRes.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('Error in CostController:', error);
      return NextResponse.json(
        { error: 'Internal server error while fetching cost estimates', details: error.message },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }
  }
}
