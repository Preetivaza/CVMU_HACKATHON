/**
 * AUTH CONTROLLER
 * Business logic for: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me, PATCH /api/auth/me
 */
import { hashPassword, verifyPassword, generateToken, verifyAuth } from '@/lib/auth';
import { isValidEmail, validatePassword } from '@/utils/validators';
import { HTTP_STATUS, USER_ROLES, EMAIL_DOMAIN_ROLE_MAP } from '@/utils/constants';
import { UserModel } from '@/models/user.model';
import { NextResponse } from 'next/server';

export class AuthController {
  /** POST /api/auth/login */
  static async login(request) {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await UserModel.touchLastLogin(user._id.toString());

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        authority_zone: user.authority_zone || null,
      },
      token,
    });
  }

  /** POST /api/auth/register */
  static async register(request) {
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.errors.join(', ') }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // Auto-detect role suggestion from email domain
    const emailDomain = email.split('@')[1]?.toLowerCase() || '';
    const suggestedRole = EMAIL_DOMAIN_ROLE_MAP[emailDomain] || 'viewer';

    // Requested role must not be higher than suggested (master_admin assigns final role)
    const userRole = role || suggestedRole;
    if (!USER_ROLES.includes(userRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${USER_ROLES.join(', ')}` }, { status: HTTP_STATUS.BAD_REQUEST });
    }
    // New self-registrations can't claim master_admin or city_admin — those require manual assignment
    const selfRegistrationAllowed = ['zone_officer', 'state_authority', 'contractor', 'viewer'];
    const finalRole = selfRegistrationAllowed.includes(userRole) ? userRole : 'viewer';

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await UserModel.create({ email, passwordHash, name, role: finalRole });

    const token = generateToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        authority_zone: newUser.authority_zone || null,
      },
      token,
      suggested_role: suggestedRole, // Hint for admin to confirm/upgrade
    }, { status: HTTP_STATUS.CREATED });
  }

  /** GET /api/auth/me */
  static async getMe(request) {
    const { isValid, user, error } = await verifyAuth(request);
    if (!isValid) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const userData = await UserModel.findById(user.userId, true);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }

    return NextResponse.json({
      user: {
        id: userData._id.toString(),
        email: userData.email,
        name: userData.name,
        role: userData.role,
        authority_zone: userData.authority_zone,
        created_at: userData.created_at,
        last_login: userData.last_login,
      },
    });
  }

  /** PATCH /api/auth/me */
  static async updateMe(request) {
    const { isValid, user, error } = await verifyAuth(request);
    if (!isValid) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const body = await request.json();
    const fields = {};
    if (body.name && body.name.trim().length >= 2) fields.name = body.name.trim();
    if (body.authority_zone !== undefined) fields.authority_zone = body.authority_zone;
    if (body.saved_location !== undefined && body.saved_location !== null) {
      const sl = body.saved_location;
      if (typeof sl.lat === 'number' && typeof sl.lon === 'number') {
        fields.saved_location = { lat: sl.lat, lon: sl.lon };
      }
    }
    if (body.drawn_area !== undefined) {
      // Store the drawn polygon as part of the user's profile
      fields.drawn_area = body.drawn_area || null;
    }

    await UserModel.updateProfile(user.userId, fields);
    const updatedUser = await UserModel.findById(user.userId, true);

    return NextResponse.json({
      message: 'Profile updated',
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        authority_zone: updatedUser.authority_zone,
      },
    });
  }
}
