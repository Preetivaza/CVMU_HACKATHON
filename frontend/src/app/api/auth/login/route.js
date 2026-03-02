import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { isValidEmail } from '@/utils/validators';
import { HTTP_STATUS } from '@/utils/constants';

/**
 * POST /api/auth/login
 * User login
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate input
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.USERS);
    
    // Find user by email
    const user = await collection.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }
    
    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });
    
    // Update last login
    await collection.updateOne(
      { _id: user._id },
      { $set: { last_login: new Date() } }
    );
    
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
