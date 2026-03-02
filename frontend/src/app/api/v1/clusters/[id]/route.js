import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS, REPAIR_STATUSES } from '@/utils/constants';
import { isValidObjectId } from '@/utils/validators';

/**
 * GET /api/v1/clusters/[id]
 * Get single cluster details
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'Valid cluster ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.CLUSTERS);
    const cluster = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!cluster) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    
    // Optionally fetch related detections
    const detectionsCollection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    const detections = await detectionsCollection
      .find({ cluster_id: new ObjectId(id) })
      .toArray();
    
    return NextResponse.json({
      ...cluster,
      related_detections: detections,
    });
    
  } catch (error) {
    console.error('Get cluster error:', error);
    return NextResponse.json(
      { error: 'Failed to get cluster', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * PATCH /api/v1/clusters/[id]
 * Update cluster (primarily for status updates)
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'Valid cluster ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.CLUSTERS);
    const cluster = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!cluster) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    
    const updateFields = {
      updated_at: new Date(),
    };
    
    // Handle status update with history tracking
    if (body.status) {
      if (!REPAIR_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${REPAIR_STATUSES.join(', ')}` },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
      
      updateFields['properties.status'] = body.status;
      
      // Add to repair history
      const historyEntry = {
        status: body.status,
        changed_by: body.changed_by || null, // TODO: Get from auth
        changed_at: new Date(),
        notes: body.notes || '',
      };
      
      await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateFields,
          $push: { 'properties.repair_history': historyEntry },
        }
      );
    } else {
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
    }
    
    const updated = await collection.findOne({ _id: new ObjectId(id) });
    
    return NextResponse.json({
      message: 'Cluster updated',
      data: updated,
    });
    
  } catch (error) {
    console.error('Update cluster error:', error);
    return NextResponse.json(
      { error: 'Failed to update cluster', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * DELETE /api/v1/clusters/[id]
 * Delete a cluster (admin only)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'Valid cluster ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    const collection = await getCollection(COLLECTIONS.CLUSTERS);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    
    // Unlink detections from this cluster
    const detectionsCollection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    await detectionsCollection.updateMany(
      { cluster_id: new ObjectId(id) },
      { $set: { cluster_id: null, processed: false } }
    );
    
    return NextResponse.json({
      message: 'Cluster deleted',
    });
    
  } catch (error) {
    console.error('Delete cluster error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cluster', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
