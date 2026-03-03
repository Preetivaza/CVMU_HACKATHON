import { NextResponse } from 'next/server';
import { DetectionModel } from '@/models/detection.model';
import { ClusterModel } from '@/models/cluster.model';
import { v4 as uuidv4 } from 'uuid';
import { ML_SERVICE_URL } from '@/utils/constants';

export async function GET() {
  return NextResponse.json({
    message: "Test Duplicates API is ready.",
    endpoints: {
        run: "POST /api/v1/test-duplicates",
        status: "GET /api/v1/test-duplicates"
    }
  });
}

export async function POST(request) {
  try {
    const video_id = `test_dup_${uuidv4().slice(0, 8)}`;
    const baseLat = 28.6139; // Delhi center
    const baseLon = 77.2090;

    // 1. Create duplicate detections
    const detections = [];
    for (let i = 0; i < 5; i++) {
        const offset = i * 0.000005; // ~0.5m increments
        detections.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [baseLon + offset, baseLat + offset]
            },
            properties: {
                video_id,
                frame_id: i * 10,
                timestamp: new Date(),
                damage_type: 'pothole',
                confidence: 0.95,
                severity_score: 0.85,
                model_version: 'test-v1',
                possible_duplicate: false
            },
            cluster_id: null,
            processed: false,
            created_at: new Date()
        });
    }

    await DetectionModel.bulkInsert(detections);

    // 2. Trigger Clustering
    // We try the URL from constants, then fallback to 8001 if it's different
    const urlsToTry = [ML_SERVICE_URL];
    if (!ML_SERVICE_URL.includes('8001')) urlsToTry.push('http://localhost:8001');
    if (!ML_SERVICE_URL.includes('8000')) urlsToTry.push('http://localhost:8000');
    
    // De-duplicate URLs
    const finalUrls = [...new Set(urlsToTry)];
    
    let clusteringResult = null;
    let errorLog = [];

    for (const url of finalUrls) {
        try {
            const res = await fetch(`${url}/ml/clustering/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_id: video_id,
                    force_recluster: true,
                    eps_meters: 10,
                    min_samples: 2
                })
            });
            if (res.ok) {
                clusteringResult = await res.json();
                break;
            } else {
                errorLog.push(`${url}: ${res.status} ${res.statusText}`);
            }
        } catch (e) {
            errorLog.push(`${url}: ${e.message}`);
        }
    }

    if (!clusteringResult) {
        return NextResponse.json({
            success: false,
            message: "Failed to reach ML clustering service.",
            errors: errorLog,
            video_id
        }, { status: 502 });
    }

    // 3. Verify
    const { items: processed } = await DetectionModel.findWithFilters({
        query: { 'properties.video_id': video_id },
        limit: 10
    });

    const clusters = [...new Set(processed.map(d => d.cluster_id?.toString()).filter(Boolean))];
    const isMerged = clusters.length === 1;

    // Fetch cluster details if merged
    let clusterData = null;
    if (isMerged) {
        clusterData = await ClusterModel.findById(clusters[0]);
    }

    return NextResponse.json({
        success: true,
        test_result: isMerged ? "PASSED" : "FAILED",
        summary: isMerged 
            ? `Successfully merged 5 duplicates into Cluster [${clusters[0]}]` 
            : `Found ${clusters.length} clusters for 5 duplicates. Expected exactly 1.`,
        data: {
            video_id,
            detections_count: 5,
            clusters_found: clusters.length,
            cluster_ids: clusters,
            cluster_details: clusterData,
            ml_response: clusteringResult
        }
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
