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
import { verifyAuth } from '@/lib/auth';
import { UserModel } from '@/models/user.model';

export class ClusterController {
  /** GET /api/v1/clusters */
  static async list(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};
    if (searchParams.get('risk_level')) query['properties.risk_level'] = searchParams.get('risk_level');
    if (searchParams.get('status')) query['properties.status'] = searchParams.get('status');

    // --- SMART DATA MASKING (Member 3 Requirement) ---
    const { isValid, user: tokenUser } = await verifyAuth(request);
    if (isValid) {
      const user = await UserModel.findById(tokenUser.userId);

      if (user.role === 'zone_officer' && user.authority_zone) {
        // Only see risks within their assigned Polygon/Ward
        query.geometry = {
          $geoWithin: { $geometry: user.authority_zone }
        };
      } else if (user.role === 'state_authority') {
        // State level only cares about Highways
        query['road_type'] = 'highway';
      } else if (user.role === 'contractor') {
        // Contractors only see roads they are assigned to
        query['properties.assigned_to_user_id'] = user._id.toString();
      }
      // city_admin sees everything (no additional filter)
    }

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
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat) && !query.geometry) {
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

    try {
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
    } catch (error) {
      console.error('[ML Proxy Error] Connection to FastAPI failed:', error.message);
      return NextResponse.json({
        error: 'Machine Learning Backend is offline or unreachable.',
        details: error.message
      }, { status: 503 }); // 503 Service Unavailable
    }
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

      // --- ML SYNC (Member 3 Requirement) ---
      // Notify the ML Service to reset risk/aging if 'repaired'
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

        const response = await fetch(`${ML_SERVICE_URL}/ml/risk/update-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cluster_id: id,
            status: body.status,
            notes: body.notes || 'Status updated via Frontend Management System'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[ML Sync] Warning: ML service returned ${response.status} for ${id}`);
        }
      } catch (err) {
        console.warn(`[ML Sync] FastAPI unreachable or timed out. ML Sync failed for ${id}:`, err.message);
      }
    }

    if (body.assigned_to_user_id) {
      await ClusterModel.updateById(id, { 'properties.assigned_to_user_id': body.assigned_to_user_id });
    }

    if (!body.status && !body.assigned_to_user_id) {
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
