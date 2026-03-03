'use client';

import { useState } from 'react';

export default function TestDuplicatesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/v1/test-duplicates', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Test failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="test-container">
      <style jsx>{`
        .test-container {
          min-height: 100vh;
          background: radial-gradient(circle at top left, #1a1a2e, #16213e);
          color: #e94560;
          font-family: 'Inter', sans-serif;
          padding: 3rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2.5rem;
          width: 100%;
          max-width: 800px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          transition: transform 0.3s ease;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
        }
        .description {
            color: #94a3b8;
            text-align: center;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        .btn-container {
            display: flex;
            justify-content: center;
            margin-bottom: 2rem;
        }
        .action-btn {
          background: linear-gradient(135deg, #e94560, #fb5b5a);
          color: white;
          border: none;
          padding: 1rem 2.5rem;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
        }
        .action-btn:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 8px 25px rgba(233, 69, 96, 0.6);
        }
        .action-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }
        .result-panel {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.875rem;
            font-weight: bold;
            margin-bottom: 1rem;
        }
        .badge-success { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
        .badge-error { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
        
        .summary-box {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.75rem;
            color: #cbd5e1;
        }
        .summary-item .label { color: #94a3b8; }
        .summary-item .value { font-weight: 600; }
        
        pre {
            background: #0f172a;
            color: #94a3b8;
            padding: 1rem;
            border-radius: 8px;
            font-size: 0.8rem;
            overflow-x: auto;
            max-height: 200px;
        }
        .loader {
            width: 20px;
            height: 20px;
            border: 2px solid #fff;
            border-bottom-color: transparent;
            border-radius: 50%;
            display: inline-block;
            box-sizing: border-box;
            animation: rotation 1s linear infinite;
            margin-right: 10px;
        }
        @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="card">
        <h1>Duplicate Data Test</h1>
        <p className="description">
          This tool tests the de-duplication logic by injecting 5 detections in close proximity (~1m radius)
          and verifying if the ML Clustering Service merges them into a single cluster.
        </p>

        <div className="btn-container">
          <button 
            className="action-btn" 
            onClick={runTest}
            disabled={loading}
          >
            {loading && <span className="loader"></span>}
            {loading ? 'Processing...' : 'Run De-duplication Test'}
          </button>
        </div>

        {error && (
            <div className="result-panel">
                <div className="badge badge-error">ERROR</div>
                <div className="summary-box">
                    <p style={{ color: '#f87171' }}>{error}</p>
                </div>
            </div>
        )}

        {result && (
          <div className="result-panel">
            <div className={`badge ${result.test_result === 'PASSED' ? 'badge-success' : 'badge-error'}`}>
                {result.test_result}
            </div>
            
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                {result.summary}
            </p>

            <div className="summary-box">
                <div className="summary-item">
                    <span className="label">Video ID:</span>
                    <span className="value">{result.data.video_id}</span>
                </div>
                <div className="summary-item">
                    <span className="label">Detections Created:</span>
                    <span className="value">{result.data.detections_count}</span>
                </div>
                <div className="summary-item">
                    <span className="label">Clusters Found:</span>
                    <span className="value">{result.data.clusters_found}</span>
                </div>
                {result.data.cluster_details && (
                    <div className="summary-item">
                        <span className="label">Final Risk Score:</span>
                        <span className="value">{(result.data.cluster_details.properties.final_risk_score * 100).toFixed(1)}%</span>
                    </div>
                )}
            </div>

            <p className="label" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>ML SERVICE RAW RESPONSE</p>
            <pre>{JSON.stringify(result.data.ml_response, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
