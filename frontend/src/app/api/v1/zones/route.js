import { NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/utils/constants';
import { ZoneModel } from '@/models/zone.model';
import { verifyAuth } from '@/lib/auth';
import { isAdminRole } from '@/utils/rbac';

/**
 * GET /api/v1/zones — List all city zones (any authenticated user)
 * POST /api/v1/zones — Create a new zone (master_admin / city_admin only)
 */

export async function GET(request) {
  try {
    const { isValid } = await verifyAuth(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const zones = await ZoneModel.findAll();
    return NextResponse.json({ zones, total: zones.length });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to list zones', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

export async function POST(request) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const body = await request.json();
    const { name, code, description, geometry } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'name and code are required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // Validate geometry if provided
    if (geometry && geometry.type !== 'Polygon') {
      return NextResponse.json({ error: 'geometry must be a GeoJSON Polygon' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // Check for duplicate code
    const existing = await ZoneModel.findByName(name);
    if (existing) {
      return NextResponse.json({ error: `Zone "${name}" already exists` }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const zone = await ZoneModel.create({ name, code, description, geometry: geometry || null });
    return NextResponse.json({ message: 'Zone created successfully', zone }, { status: HTTP_STATUS.CREATED });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create zone', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
