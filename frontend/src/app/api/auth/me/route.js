import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { HTTP_STATUS } from '@/utils/constants';

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
export async function GET(request) {
  try {
    // Verify authentication
    const { isValid, user, error } = await verifyAuth(request);
    
    if (!isValid) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.USERS);
    
    // Get full user data from database
    const userData = await collection.findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password_hash: 0 } } // Exclude password
    );
    
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
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
    
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user info', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * PATCH /api/auth/me
 * Update current user profile
 */
export async function PATCH(request) {
  try {
    // Verify authentication
    const { isValid, user, error } = await verifyAuth(request);
    
    if (!isValid) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }
    
    const body = await request.json();
    const { name, authority_zone } = body;
    
    const collection = await getCollection(COLLECTIONS.USERS);
    
    const updateFields = {
      updated_at: new Date(),
    };
    
    if (name && name.trim().length >= 2) {
      updateFields.name = name.trim();
    }
    
    if (authority_zone !== undefined) {
      updateFields.authority_zone = authority_zone;
    }
    
    await collection.updateOne(
      { _id: new ObjectId(user.userId) },
      { $set: updateFields }
    );
    
    // Get updated user
    const updatedUser = await collection.findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password_hash: 0 } }
    );
    
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
    
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
