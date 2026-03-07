import { NextResponse } from 'next/server';
import { HTTP_STATUS, USER_ROLES } from '@/utils/constants';
import { UserModel } from '@/models/user.model';
import { verifyAuth } from '@/lib/auth';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { canAssignRole, isAdminRole } from '@/utils/rbac';

/**
 * PATCH /api/v1/admin/users/[id] — Update role, name, zone or active status
 * DELETE /api/v1/admin/users/[id] — Delete a user
 */

export async function PATCH(request, { params }) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const id = params.id;
    const body = await request.json();
    const updates = {};

    // Enforce role hierarchy when changing roles
    if (body.role) {
      if (!USER_ROLES.includes(body.role)) {
        return NextResponse.json({ error: `Invalid role.` }, { status: HTTP_STATUS.BAD_REQUEST });
      }
      if (!canAssignRole(user.role, body.role)) {
        return NextResponse.json({
          error: `Forbidden. Your role (${user.role}) cannot assign the role "${body.role}".`
        }, { status: HTTP_STATUS.FORBIDDEN });
      }
      updates.role = body.role;
    }

    if (body.name) updates.name = body.name.trim();
    if (body.active !== undefined) updates.active = body.active;

    // authority_zone stores { id, name, code, geometry } — the full zone snapshot
    if (body.authority_zone !== undefined) {
      // Zone Occupancy Check: only if assigning a new zone to a zone_officer
      const targetRole = updates.role || (await UserModel.findById(id))?.role;
      if (targetRole === 'zone_officer' && body.authority_zone?.id) {
        const occupied = await UserModel.findByZoneId(body.authority_zone.id);
        if (occupied && occupied._id.toString() !== id) {
          return NextResponse.json({ 
            error: `Zone "${body.authority_zone.name}" is already assigned to ${occupied.name}.` 
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }
      }
      updates.authority_zone = body.authority_zone; // null to clear
    }

    updates.updated_at = new Date();

    const col = await getCollection(COLLECTIONS.USERS);
    await col.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    const updated = await UserModel.findById(id, true);

    return NextResponse.json({ message: 'User updated', user: updated });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    // Prevent self-deletion
    if (params.id === user.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const col = await getCollection(COLLECTIONS.USERS);
    await col.deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ message: 'User deleted' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
