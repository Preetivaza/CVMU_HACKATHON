import { NextResponse } from 'next/server';
import { HTTP_STATUS, USER_ROLES } from '@/utils/constants';
import { UserModel } from '@/models/user.model';
import { hashPassword, verifyAuth } from '@/lib/auth';
import { getCollection, COLLECTIONS } from '@/lib/db';

/** GET /api/v1/admin/users — list all users (admin only) */
export async function GET(request) {
    try {
        const { isValid, user } = await verifyAuth(request);
        if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
        if (!['city_admin', 'admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
        }
        const col = await getCollection(COLLECTIONS.USERS);
        const users = await col.find({}, { projection: { password_hash: 0 } }).sort({ created_at: -1 }).toArray();
        return NextResponse.json({ users, total: users.length });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to list users', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
}

/** POST /api/v1/admin/users — create a new user (admin only) */
export async function POST(request) {
    try {
        const { isValid, user } = await verifyAuth(request);
        if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
        if (!['city_admin', 'admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
        }

        const body = await request.json();
        const { email, name, role, password } = body;

        if (!email || !name || !password) {
            return NextResponse.json({ error: 'email, name, and password are required' }, { status: HTTP_STATUS.BAD_REQUEST });
        }
        if (role && !USER_ROLES.includes(role)) {
            return NextResponse.json({ error: `Invalid role. Must be one of: ${USER_ROLES.join(', ')}` }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        const existing = await UserModel.findByEmail(email);
        if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: HTTP_STATUS.BAD_REQUEST });

        const passwordHash = await hashPassword(password);
        const newUser = await UserModel.create({ email, passwordHash, name, role: role || 'viewer' });

        return NextResponse.json({
            message: 'User created successfully',
            user: { id: newUser._id.toString(), email: newUser.email, name: newUser.name, role: newUser.role }
        }, { status: HTTP_STATUS.CREATED });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
}
