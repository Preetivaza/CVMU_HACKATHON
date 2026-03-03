import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ML_SERVICE_URL, HTTP_STATUS } from '@/utils/constants';

/**
 * DEBUG API - Comprehensive System Check
 * Tests: DB connection, ML Service, Data retrieval
 */
export async function GET() {
    const results = {
        timestamp: new Date().toISOString(),
        frontend: { status: 'OK', version: '1.0.0' },
        connectivity: {
            mongodb: { status: 'pending', database: null, error: null },
            ml_service: { status: 'pending', url: ML_SERVICE_URL, error: null }
        },
        data_summary: {
            detections_count: 0,
            clusters_count: 0,
            uploads_count: 0
        }
    };

    // 1. Check MongoDB
    try {
        const db = await getDb();
        results.connectivity.mongodb.status = 'connected';
        results.connectivity.mongodb.database = db.databaseName;
        
        results.data_summary.detections_count = await db.collection('raw_detections').countDocuments();
        results.data_summary.clusters_count = await db.collection('clusters').countDocuments();
        results.data_summary.uploads_count = await db.collection('video_uploads').countDocuments();
    } catch (e) {
        results.connectivity.mongodb.status = 'failed';
        results.connectivity.mongodb.error = e.message;
    }

    // 2. Check ML Service
    try {
        const mlHealthRes = await fetch(`${ML_SERVICE_URL}/ml/health`, { signal: AbortSignal.timeout(3000) });
        if (mlHealthRes.ok) {
            const mlHealth = await mlHealthRes.json();
            results.connectivity.ml_service.status = 'connected';
            results.connectivity.ml_service.data = mlHealth;
        } else {
            results.connectivity.ml_service.status = 'degraded';
            results.connectivity.ml_service.error = `HTTP ${mlHealthRes.status}`;
        }
    } catch (e) {
        results.connectivity.ml_service.status = 'unavailable';
        results.connectivity.ml_service.error = e.message;
    }

    return NextResponse.json(results);
}
