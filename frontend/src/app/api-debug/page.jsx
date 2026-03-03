'use client';

import { useState, useEffect } from 'react';

export default function ApiDebugPage() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tests, setTests] = useState([]);
    const [activeTab, setActiveTab] = useState('health');

    const checkHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/debug');
            const data = await res.json();
            setHealth(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { checkHealth(); }, []);

    const runApiTest = async (name, endpoint, method = 'GET', body = null) => {
        const testId = Date.now();
        setTests(prev => [{ id: testId, name, status: 'running', endpoint, result: null }, ...prev]);
        
        try {
            const options = { method };
            if (body) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }
            const res = await fetch(endpoint, options);
            const data = await res.json();
            
            setTests(prev => prev.map(t => t.id === testId ? {
                ...t, 
                status: res.ok ? 'success' : 'failed',
                result: data,
                code: res.status
            } : t));
        } catch (e) {
            setTests(prev => prev.map(t => t.id === testId ? {
                ...t, 
                status: 'failed',
                result: { error: e.message }
            } : t));
        }
    };

    // Preset tests
    const testCases = [
        { name: 'Fetch Clusters', endpoint: '/api/v1/clusters', method: 'GET' },
        { name: 'Fetch Detections', endpoint: '/api/v1/detections?limit=5', method: 'GET' },
        { name: 'Simulate Duplicate AI Detect', endpoint: '/api/v1/test-duplicates', method: 'POST' },
        { name: 'Check Monthly Trends', endpoint: '/api/v1/analytics/monthly-trend', method: 'GET' },
        { name: 'Check Priority Ranking', endpoint: '/api/v1/analytics/priority-ranking', method: 'GET' },
    ];

    return (
        <div className="debug-container">
            <style jsx>{`
                .debug-container {
                    padding: 2rem;
                    background: #0f172a;
                    min-height: 100vh;
                    color: #f8fafc;
                    font-family: 'Inter', sans-serif;
                }
                .glass-card {
                    background: rgba(30, 41, 59, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .status-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2.5rem;
                }
                .status-item {
                    padding: 1.5rem;
                    border-radius: 12px;
                    background: #1e293b;
                    border-left: 4px solid #64748b;
                }
                .status-item.success { border-left-color: #22c55e; }
                .status-item.failed { border-left-color: #ef4444; }
                .status-item.pending { border-left-color: #f59e0b; }
                
                .label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .value { font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem; display: flex; align-items: center; justify-content: space-between; }
                
                .test-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .btn {
                    padding: 0.75rem 1.25rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .btn-test { background: #3b82f6; color: white; }
                .btn-test:hover { background: #2563eb; transform: translateY(-2px); }
                .btn-refresh { background: #64748b; color: white; }

                .test-log {
                    margin-top: 2rem;
                }
                .log-entry {
                    background: #1e293b;
                    border-radius: 10px;
                    margin-bottom: 1rem;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .log-header {
                    padding: 1rem 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    background: rgba(255,255,255,0.02);
                }
                .log-content {
                    padding: 1.5rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    background: #0a0f1d;
                }
                pre { font-size: 0.85rem; color: #cbd5e1; overflow-x: auto; max-height: 300px; }
                
                .badge {
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 800;
                }
                .badge-success { background: #166534; color: #4ade80; }
                .badge-failed { background: #991b1b; color: #f87171; }
                .badge-running { background: #1e40af; color: #60a5fa; }
            `}</style>

            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Frontend API Debug Suite</h1>
                        <p style={{ color: '#94a3b8', margin: '0.5rem 0 0' }}>Comprehensive verification for Member 1 & 2 integration</p>
                    </div>
                    <button className="btn btn-refresh" onClick={checkHealth} disabled={loading}>
                        {loading ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                </div>

                <div className="status-grid">
                    <div className={`status-item ${health?.connectivity?.mongodb?.status === 'connected' ? 'success' : 'failed'}`}>
                        <div className="label">Database (MongoDB)</div>
                        <div className="value">
                            {health?.connectivity?.mongodb?.status || 'Searching...'}
                            {health?.connectivity?.mongodb?.status === 'connected' && <span style={{ fontSize: '0.7rem' }}>{health.connectivity.mongodb.database}</span>}
                        </div>
                    </div>
                    <div className={`status-item ${health?.connectivity?.ml_service?.status === 'connected' ? 'success' : 'failed'}`}>
                        <div className="label">ML Service (FastAPI)</div>
                        <div className="value">
                            {health?.connectivity?.ml_service?.status || 'Connecting...'}
                            <span style={{ fontSize: '0.7rem' }}>Port: {health?.connectivity?.ml_service?.url?.split(':').pop()}</span>
                        </div>
                    </div>
                    <div className="status-item success">
                        <div className="label">System Load</div>
                        <div className="value">
                            {health?.data_summary?.detections_count || 0}
                            <span style={{ fontSize: '0.7rem' }}>Raw Detections</span>
                        </div>
                    </div>
                </div>

                <h3>Available Tests</h3>
                <div className="test-actions">
                    {testCases.map((tc, i) => (
                        <button key={i} className="btn btn-test" onClick={() => runApiTest(tc.name, tc.endpoint, tc.method)}>
                            {tc.name}
                        </button>
                    ))}
                </div>

                <div className="test-log">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Test Execution Log 
                        {tests.length > 0 && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>({tests.length} ran)</span>}
                    </h3>
                    {tests.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', background: '#1e293b', borderRadius: '12px', border: '1px dashed #475569', color: '#94a3b8' }}>
                            No tests executed in this session. Click a button above to start.
                        </div>
                    )}
                    {tests.map(test => (
                        <details key={test.id} className="log-entry" open>
                            <summary className="log-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span className={`badge badge-${test.status}`}>{test.status.toUpperCase()}</span>
                                    <span style={{ fontWeight: 600 }}>{test.name}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{test.endpoint}</span>
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{new Date(test.id).toLocaleTimeString()}</span>
                            </summary>
                            <div className="log-content">
                                <div style={{ marginBottom: '1rem', display: 'flex', gap: '20px' }}>
                                    <div className="label">HTTP Code: <span style={{color: test.code < 400 ? '#4ade80' : '#f87171'}}>{test.code || '...'}</span></div>
                                    <div className="label">Method: <span style={{color: '#f8fafc'}}>{test.method || 'GET'}</span></div>
                                </div>
                                <pre>{JSON.stringify(test.result, null, 2)}</pre>
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    );
}
