import { NextResponse } from 'next/server';
import { HTTP_STATUS, USER_ROLES } from '@/utils/constants';
import { UserModel } from '@/models/user.model';
import { verifyAuth } from '@/lib/auth';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/** PATCH /api/v1/admin/users/[id] — update role or deactivate user */
export async function PATCH(request, { params }) {
    try {
        const { isValid, user } = await verifyAuth(request);
        if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
        if (!['city_admin', 'admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
        }
        const id = params.id;
        const body = await request.json();
        const updates = {};
        if (body.role && USER_ROLES.includes(body.role)) updates.role = body.role;
        if (body.name) updates.name = body.name.trim();
        if (body.active !== undefined) updates.active = body.active;
        if (body.authority_zone !== undefined) updates.authority_zone = body.authority_zone;

        updates.updated_at = new Date();
        const col = await getCollection(COLLECTIONS.USERS);
        await col.updateOne({ _id: new ObjectId(id) }, { $set: updates });
        const updated = await UserModel.findById(id, true);
        return NextResponse.json({ message: 'User updated', user: updated });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
}

/** DELETE /api/v1/admin/users/[id] — delete a user */
export async function DELETE(request, { params }) {
    try {
        const { isValid, user } = await verifyAuth(request);
        if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
        if (!['city_admin', 'admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Forbidden.' }, { status: HTTP_STATUS.FORBIDDEN });
        }
        const col = await getCollection(COLLECTIONS.USERS);
        await col.deleteOne({ _id: new ObjectId(params.id) });
        return NextResponse.json({ message: 'User deleted' });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
}
