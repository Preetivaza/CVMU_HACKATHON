/**
 * ANALYTICS CONTROLLER
 * Business logic for:
 *   GET /api/v1/analytics/monthly-trend
 *   GET /api/v1/analytics/priority-ranking
 */
import { NextResponse } from 'next/server';
import { ClusterModel } from '@/models/cluster.model';
import { DetectionModel } from '@/models/detection.model';
import { HTTP_STATUS } from '@/utils/constants';

export class AnalyticsController {
  /** GET /api/v1/analytics/monthly-trend */
  static async monthlyTrend(request) {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months')) || 12;

    const endDate   = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const detectionsPipeline = [
      { $match: { 'properties.timestamp': { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { year: { $year: '$properties.timestamp' }, month: { $month: '$properties.timestamp' } },
          total_detections: { $sum: 1 },
          avg_severity:    { $avg: '$properties.severity_score' },
          damage_types:    { $push: '$properties.damage_type' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ];

    const clustersPipeline = [
      { $match: { created_at: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { year: { $year: '$created_at' }, month: { $month: '$created_at' } },
          clusters_created: { $sum: 1 },
          avg_risk_score:   { $avg: '$properties.final_risk_score' },
          repaired_count:   { $sum: { $cond: [{ $eq: ['$properties.status', 'repaired'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ];

    const [detectionsStats, clustersStats] = await Promise.all([
      DetectionModel.aggregate(detectionsPipeline),
      ClusterModel.aggregate(clustersPipeline),
    ]);

    const trendData = [];
    for (let i = 0; i < months; i++) {
      const date  = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const year  = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const dStats = detectionsStats.find(d => d._id.year === year && d._id.month === month)
        || { total_detections: 0, avg_severity: 0, damage_types: [] };
      const cStats = clustersStats.find(c => c._id.year === year && c._id.month === month)
        || { clusters_created: 0, avg_risk_score: 0, repaired_count: 0 };

      const damageTypeCounts = {};
      dStats.damage_types.forEach(t => { damageTypeCounts[t] = (damageTypeCounts[t] || 0) + 1; });

      trendData.push({
        month: monthStr,
        total_detections:   dStats.total_detections,
        avg_severity:       Math.round(dStats.avg_severity * 100) / 100,
        clusters_created:   cStats.clusters_created,
        avg_risk_score:     Math.round(cStats.avg_risk_score * 100) / 100,
        repairs_completed:  cStats.repaired_count,
        damage_types:       damageTypeCounts,
      });
    }

    return NextResponse.json({ period: { start: startDate.toISOString(), end: endDate.toISOString(), months }, trend: trendData });
  }

  /** GET /api/v1/analytics/priority-ranking */
  static async priorityRanking(request) {
    const { searchParams } = new URL(request.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    const status = searchParams.get('status') || 'pending';

    const query = {};
    if (status && status !== 'all') query['properties.status'] = status;

    const clusters = await ClusterModel.findTopRisk({ query, limit });

    const ranking = clusters.map((cluster, index) => ({
      rank:           index + 1,
      cluster_id:     cluster._id.toString(),
      location:       { type: 'Point', coordinates: cluster.geometry.coordinates },
      risk_score:     Math.round(cluster.properties.final_risk_score * 100) / 100,
      risk_level:     cluster.properties.risk_level,
      points_count:   cluster.properties.points_count,
      avg_severity:   Math.round(cluster.properties.avg_severity * 100) / 100,
      status:         cluster.properties.status,
      first_detected: cluster.first_detected,
      last_detected:  cluster.last_detected,
      damage_types:   cluster.properties.damage_types,
    }));

    const [totalPending, totalCritical, totalHigh] = await Promise.all([
      ClusterModel.count({ 'properties.status': 'pending' }),
      ClusterModel.count({ 'properties.risk_level': 'Critical' }),
      ClusterModel.count({ 'properties.risk_level': 'High' }),
    ]);

    return NextResponse.json({
      ranking,
      summary: { total_pending: totalPending, total_critical: totalCritical, total_high_risk: totalHigh, showing: ranking.length },
    });
  }
}
