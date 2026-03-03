/**
 * CLUSTER CONTROLLER
 * Business logic for:
 *   GET  /api/v1/clusters
 *   POST /api/v1/clusters          (trigger clustering via ML service)
 *   GET  /api/v1/clusters/:id
 *   PATCH /api/v1/clusters/:id     (status update)
 *   DELETE /api/v1/clusters/:id
 */
import { NextResponse } from 'next/server';
import { ClusterModel } from '@/models/cluster.model';
import { DetectionModel } from '@/models/detection.model';
import { HTTP_STATUS, REPAIR_STATUSES, PAGINATION, ML_SERVICE_URL } from '@/utils/constants';
import { isValidObjectId } from '@/utils/validators';

export class ClusterController {
  /** GET /api/v1/clusters */
  static async list(request) {
    const { searchParams } = new URL(request.url);
    const page  = parseInt(searchParams.get('page'))  || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};
    if (searchParams.get('risk_level')) query['properties.risk_level'] = searchParams.get('risk_level');
    if (searchParams.get('status'))     query['properties.status']     = searchParams.get('status');

    const minScore = parseFloat(searchParams.get('min_risk_score'));
    const maxScore = parseFloat(searchParams.get('max_risk_score'));
    if (!isNaN(minScore) || !isNaN(maxScore)) {
      query['properties.final_risk_score'] = {};
      if (!isNaN(minScore)) query['properties.final_risk_score'].$gte = minScore;
      if (!isNaN(maxScore)) query['properties.final_risk_score'].$lte = maxScore;
    }

    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
      query.geometry = { $geoWithin: { $box: [[minLon, minLat], [maxLon, maxLat]] } };
    }

    const { total, items } = await ClusterModel.findWithFilters({ query, page, limit });

    return NextResponse.json({
      type: 'FeatureCollection',
      features: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  /** POST /api/v1/clusters — proxy to FastAPI ML service */
  static async triggerClustering(request) {
    const body = await request.json();
    const mlResponse = await fetch(`${ML_SERVICE_URL}/ml/clustering/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: body.video_id, force_recluster: body.force_recluster || false }),
    });

    if (!mlResponse.ok) {
      const errorData = await mlResponse.json().catch(() => ({}));
      return NextResponse.json({ error: 'Clustering service failed', details: errorData }, { status: mlResponse.status });
    }

    const result = await mlResponse.json();
    return NextResponse.json({ message: 'Clustering completed', ...result });
  }

  /** GET /api/v1/clusters/:id */
  static async getById(request, id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Valid cluster ID is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const cluster = await ClusterModel.findById(id);
    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }

    const relatedDetections = await DetectionModel.findByClusterId(id);
    return NextResponse.json({ ...cluster, related_detections: relatedDetections });
  }

  /** PATCH /api/v1/clusters/:id — update repair status */
  static async updateStatus(request, id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Valid cluster ID is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const body = await request.json();
    const cluster = await ClusterModel.findById(id);
    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }

    if (body.status) {
      if (!REPAIR_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${REPAIR_STATUSES.join(', ')}` },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
      const historyEntry = {
        status: body.status,
        changed_by: body.changed_by || null,
        changed_at: new Date(),
        notes: body.notes || '',
      };
      await ClusterModel.updateStatus(id, body.status, historyEntry);
    } else {
      await ClusterModel.updateById(id, {});
    }

    const updated = await ClusterModel.findById(id);
    return NextResponse.json({ message: 'Cluster updated', data: updated });
  }

  /** DELETE /api/v1/clusters/:id */
  static async deleteById(request, id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Valid cluster ID is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const result = await ClusterModel.deleteById(id);
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }

    await DetectionModel.unlinkCluster(id);
    return NextResponse.json({ message: 'Cluster deleted' });
  }
}
