import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS } from '@/utils/constants';

/**
 * GET /api/v1/analytics/priority-ranking
 * Get top priority clusters ranked by risk score
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parameters
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    const status = searchParams.get('status') || 'pending'; // Default to pending clusters
    const authorityZone = searchParams.get('authority_zone');
    
    const collection = await getCollection(COLLECTIONS.CLUSTERS);
    
    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query['properties.status'] = status;
    }
    
    if (authorityZone) {
      // Find clusters within authority zone using geospatial query
      // This would require the authority zone polygon to be passed
    }
    
    // Get top priority clusters
    const clusters = await collection
      .find(query)
      .sort({ 'properties.final_risk_score': -1 })
      .limit(limit)
      .toArray();
    
    // Format ranking data
    const ranking = clusters.map((cluster, index) => ({
      rank: index + 1,
      cluster_id: cluster._id.toString(),
      location: {
        type: 'Point',
        coordinates: cluster.geometry.coordinates,
      },
      risk_score: Math.round(cluster.properties.final_risk_score * 100) / 100,
      risk_level: cluster.properties.risk_level,
      points_count: cluster.properties.points_count,
      avg_severity: Math.round(cluster.properties.avg_severity * 100) / 100,
      status: cluster.properties.status,
      first_detected: cluster.first_detected,
      last_detected: cluster.last_detected,
      damage_types: cluster.properties.damage_types,
    }));
    
    // Get summary statistics
    const totalPending = await collection.countDocuments({ 'properties.status': 'pending' });
    const totalCritical = await collection.countDocuments({ 'properties.risk_level': 'Critical' });
    const totalHigh = await collection.countDocuments({ 'properties.risk_level': 'High' });
    
    return NextResponse.json({
      ranking,
      summary: {
        total_pending: totalPending,
        total_critical: totalCritical,
        total_high_risk: totalHigh,
        showing: ranking.length,
      },
    });
    
  } catch (error) {
    console.error('Priority ranking error:', error);
    return NextResponse.json(
      { error: 'Failed to get priority ranking', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
