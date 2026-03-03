/**
 * ROAD CONTROLLER
 * Business logic for: GET /api/v1/roads
 */
import { NextResponse } from 'next/server';
import { RoadModel } from '@/models/road.model';
import { HTTP_STATUS, PAGINATION, ROAD_TYPES } from '@/utils/constants';

export class RoadController {
  /** GET /api/v1/roads — road risk data with filters */
  static async list(request) {
    const { searchParams } = new URL(request.url);
    const page  = parseInt(searchParams.get('page'))  || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const query = {};
    if (searchParams.get('risk_level'))    query['properties.risk_level']    = searchParams.get('risk_level');
    if (searchParams.get('authority_zone')) query['properties.authority_zone'] = searchParams.get('authority_zone');

    const roadType = searchParams.get('road_type');
    if (roadType) {
      if (!ROAD_TYPES.includes(roadType)) {
        return NextResponse.json(
          { error: `Invalid road_type. Must be one of: ${ROAD_TYPES.join(', ')}` },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
      query['properties.road_type'] = roadType;
    }

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

    const { total, items } = await RoadModel.findWithFilters({ query, page, limit });

    return NextResponse.json({
      type: 'FeatureCollection',
      features: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
}
