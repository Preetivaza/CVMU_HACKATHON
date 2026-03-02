import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/db';
import { HTTP_STATUS } from '@/utils/constants';

/**
 * GET /api/v1/analytics/monthly-trend
 * Get monthly statistics trend
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get months parameter (default: last 12 months)
    const months = parseInt(searchParams.get('months')) || 12;
    const authorityZone = searchParams.get('authority_zone');
    
    const collection = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    const clustersCollection = await getCollection(COLLECTIONS.CLUSTERS);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // Aggregate detections by month
    const detectionsPipeline = [
      {
        $match: {
          'properties.timestamp': {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$properties.timestamp' },
            month: { $month: '$properties.timestamp' },
          },
          total_detections: { $sum: 1 },
          avg_severity: { $avg: '$properties.severity_score' },
          damage_types: {
            $push: '$properties.damage_type',
          },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ];
    
    const detectionsStats = await collection.aggregate(detectionsPipeline).toArray();
    
    // Aggregate clusters by month
    const clustersPipeline = [
      {
        $match: {
          created_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          clusters_created: { $sum: 1 },
          avg_risk_score: { $avg: '$properties.final_risk_score' },
          repaired_count: {
            $sum: {
              $cond: [{ $eq: ['$properties.status', 'repaired'] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ];
    
    const clustersStats = await clustersCollection.aggregate(clustersPipeline).toArray();
    
    // Combine results
    const trendData = [];
    
    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      
      const detectionData = detectionsStats.find(
        d => d._id.year === year && d._id.month === month
      ) || { total_detections: 0, avg_severity: 0, damage_types: [] };
      
      const clusterData = clustersStats.find(
        c => c._id.year === year && c._id.month === month
      ) || { clusters_created: 0, avg_risk_score: 0, repaired_count: 0 };
      
      // Count damage types
      const damageTypeCounts = {};
      detectionData.damage_types.forEach(type => {
        damageTypeCounts[type] = (damageTypeCounts[type] || 0) + 1;
      });
      
      trendData.push({
        month: monthStr,
        total_detections: detectionData.total_detections,
        avg_severity: Math.round(detectionData.avg_severity * 100) / 100,
        clusters_created: clusterData.clusters_created,
        avg_risk_score: Math.round(clusterData.avg_risk_score * 100) / 100,
        repairs_completed: clusterData.repaired_count,
        damage_types: damageTypeCounts,
      });
    }
    
    return NextResponse.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        months,
      },
      trend: trendData,
    });
    
  } catch (error) {
    console.error('Monthly trend error:', error);
    return NextResponse.json(
      { error: 'Failed to get monthly trend', details: error.message },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
