import { NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/utils/constants';
import { ZoneModel } from '@/models/zone.model';
import { verifyAuth } from '@/lib/auth';
import { isAdminRole } from '@/utils/rbac';
import { isValidObjectId } from '@/utils/validators';

/**
 * GET    /api/v1/zones/[id] — Get a single zone
 * PATCH  /api/v1/zones/[id] — Update zone (admin only)
 * DELETE /api/v1/zones/[id] — Delete zone (master_admin only)
 */

export async function GET(request, { params }) {
  try {
    const { isValid } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });

    const id = params.id;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid zone ID' }, { status: HTTP_STATUS.BAD_REQUEST });

    const zone = await ZoneModel.findById(id);
    if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: HTTP_STATUS.NOT_FOUND });

    return NextResponse.json({ zone });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get zone', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    if (!isAdminRole(user.role)) return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });

    const id = params.id;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid zone ID' }, { status: HTTP_STATUS.BAD_REQUEST });

    const body = await request.json();
    const updates = {};
    if (body.name) updates.name = body.name.trim();
    if (body.code) updates.code = body.code.trim().toUpperCase();
    if (body.description !== undefined) updates.description = body.description;
    if (body.geometry) updates.geometry = body.geometry;

    await ZoneModel.updateById(id, updates);
    const updated = await ZoneModel.findById(id);
    return NextResponse.json({ message: 'Zone updated', zone: updated });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update zone', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    // Only master_admin can delete zones
    if (user.role !== 'master_admin') {
      return NextResponse.json({ error: 'Forbidden. Only Master Admin can delete zones.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const id = params.id;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid zone ID' }, { status: HTTP_STATUS.BAD_REQUEST });

    const result = await ZoneModel.deleteById(id);
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Zone not found' }, { status: HTTP_STATUS.NOT_FOUND });

    return NextResponse.json({ message: 'Zone deleted' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete zone', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
