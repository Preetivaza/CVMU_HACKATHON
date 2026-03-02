import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { hashPassword, generateToken, verifyPassword } from '@/lib/auth';
import { isValidEmail, validatePassword } from '@/utils/validators';
import { HTTP_STATUS, USER_ROLES } from '@/utils/constants';

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name, role } = body;
    
    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(', ') },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate name
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate role
    const userRole = role || 'viewer';
    if (!USER_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${USER_ROLES.join(', ')}` },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.USERS);
    
    // Check if email already exists
    const existingUser = await collection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user document
    const userDoc = {
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name.trim(),
      role: userRole,
      authority_zone: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await collection.insertOne(userDoc);
    
    // Generate token
    const token = generateToken({
      userId: result.insertedId.toString(),
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role,
    });
    
    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: result.insertedId.toString(),
        email: userDoc.email,
        name: userDoc.name,
        role: userDoc.role,
      },
      token,
    }, { status: HTTP_STATUS.CREATED });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
