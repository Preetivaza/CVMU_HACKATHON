import { NextResponse } from 'next/server';
import { HTTP_STATUS, USER_ROLES } from '@/utils/constants';
import { UserModel } from '@/models/user.model';
import { hashPassword, verifyAuth } from '@/lib/auth';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { canAssignRole, isAdminRole, getVisibleRoles } from '@/utils/rbac';

/**
 * GET /api/v1/admin/users — List users (admin only, filtered by role hierarchy)
 * POST /api/v1/admin/users — Create a new user (admin only, role hierarchy enforced)
 */

export async function GET(request) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const col = await getCollection(COLLECTIONS.USERS);
    const query = {};

    // city_admin cannot see master_admin accounts
    const visibleRoles = getVisibleRoles(user.role);
    if (visibleRoles) {
      query.role = { $in: visibleRoles };
    }

    const users = await col
      .find(query, { projection: { password_hash: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ users, total: users.length });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to list users', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

export async function POST(request) {
  try {
    const { isValid, user } = await verifyAuth(request);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const body = await request.json();
    const { email, name, role, password, authority_zone } = body;

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, and password are required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const targetRole = role || 'viewer';
    if (!USER_ROLES.includes(targetRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${USER_ROLES.join(', ')}` }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // Enforce role hierarchy — cannot create a user with equal or higher role
    if (!canAssignRole(user.role, targetRole)) {
      return NextResponse.json({
        error: `Forbidden. Your role (${user.role}) cannot create a user with role "${targetRole}".`
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: HTTP_STATUS.BAD_REQUEST });

    // Zone Occupancy Check: one officer per zone
    if (targetRole === 'zone_officer' && authority_zone?.id) {
      const occupied = await UserModel.findByZoneId(authority_zone.id);
      if (occupied) {
        return NextResponse.json({ 
          error: `Zone "${authority_zone.name || authority_zone.code}" is already assigned to ${occupied.name}.` 
        }, { status: HTTP_STATUS.BAD_REQUEST });
      }
    }

    const passwordHash = await hashPassword(password);
    const newUser = await UserModel.create({
      email,
      passwordHash,
      name,
      role: targetRole,
      authority_zone: authority_zone || null,
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        authority_zone: newUser.authority_zone,
      }
    }, { status: HTTP_STATUS.CREATED });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create user', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
