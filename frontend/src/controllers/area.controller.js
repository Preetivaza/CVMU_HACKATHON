/**
 * AREA CONTROLLER
 * Business logic for: GET /api/v1/areas
 */
import { NextResponse } from 'next/server';
import { AreaModel } from '@/models/area.model';
import { HTTP_STATUS, PAGINATION } from '@/utils/constants';
import { verifyAuth } from '@/lib/auth';
import { UserModel } from '@/models/user.model';
import { getDataFilter } from '@/utils/rbac';

export class AreaController {
  /** GET /api/v1/areas — heatmap grid data with filters (role-filtered) */
  static async list(request) {
    const { searchParams } = new URL(request.url);
    const page  = parseInt(searchParams.get('page'))  || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};
    if (searchParams.get('risk_level')) query['properties.risk_level'] = searchParams.get('risk_level');
    if (searchParams.get('month'))      query['properties.month']      = searchParams.get('month');

    const minScore = parseFloat(searchParams.get('min_risk_score'));
    if (!isNaN(minScore)) query['properties.avg_risk_score'] = { $gte: minScore };

    const minLon = parseFloat(searchParams.get('min_lon'));
    const maxLon = parseFloat(searchParams.get('max_lon'));
    const minLat = parseFloat(searchParams.get('min_lat'));
    const maxLat = parseFloat(searchParams.get('max_lat'));
    if (!isNaN(minLon) && !isNaN(maxLon) && !isNaN(minLat) && !isNaN(maxLat)) {
      query.geometry = {
        $geoIntersects: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]],
          },
        },
      };
    }

    // --- ROLE-BASED DATA MASKING ---
    const { isValid, user: tokenUser } = await verifyAuth(request);
    if (isValid) {
      const user = await UserModel.findById(tokenUser.userId);
      const roleFilter = getDataFilter(user);
      // If zone_officer has a geometry filter, it overrides the bbox (their zone IS their viewport)
      if (roleFilter.geometry) {
        query.geometry = roleFilter.geometry;
      } else {
        Object.assign(query, roleFilter);
      }
    }

    const { total, items } = await AreaModel.findWithFilters({ query, page, limit });

    return NextResponse.json({
      type: 'FeatureCollection',
      features: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
}

