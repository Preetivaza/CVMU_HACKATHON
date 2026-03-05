'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { authFetch } from '@/utils/authFetch';

const STATUS_INFO = {
  pending: { label: 'Pending', color: '#64748b', bg: '#f1f5f9', icon: '⏳' },
  processing: { label: 'Processing', color: '#2563eb', bg: '#eff6ff', icon: '🔄' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
  failed: { label: 'Failed', color: '#dc2626', bg: '#fee2e2', icon: '❌' },
};

function StatusBadge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: info.bg, color: info.color,
      fontSize: 12, fontWeight: 700,
    }}>
      {info.icon} {info.label}
    </span>
  );
}

function DropZone({ label, required, accept, hint, onFile, file }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, letterSpacing: '0.02em' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#2563eb' : file ? '#22c55e' : '#cbd5e1'}`,
          borderRadius: 10,
          background: dragging ? '#eff6ff' : file ? '#f0fdf4' : '#f8fafc',
          padding: '24px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{file.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <span style={{ marginLeft: 8, color: '#22c55e', fontSize: 16 }}>✓</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{dragging ? '📥' : '📤'}</div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 3 }}>
              {dragging ? 'Drop file here' : 'Click to browse or drag & drop'}
            </div>
            {hint && <div style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [videoFile, setVideoFile] = useState(null);
  const [gpsFile, setGpsFile] = useState(null);
  const [accelFile, setAccelFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadUploads = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await authFetch('/api/upload/video');
      const data = await res.json();
      setUploads(data.data || []);
    } catch { setUploads([]); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) return;
    setUploading(true);
    setProgress(0);
    setResult(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('rdd_token') : null;
    const formData = new FormData();
    formData.append('video', videoFile);
    if (gpsFile) formData.append('gps', gpsFile);
    if (accelFile) formData.append('accelerometer', accelFile);

    // Use XHR for upload progress
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setResult({ success: true, message: `✅ Upload successful! Video ID: ${data.video_id}. AI processing started.`, data });
          setVideoFile(null); setGpsFile(null); setAccelFile(null);
          setTimeout(loadUploads, 1000);
        } else {
          setResult({ success: false, message: `❌ Upload failed: ${data.error || 'Unknown error'}` });
        }
      } catch {
        setResult({ success: false, message: '❌ Upload failed: Invalid server response.' });
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setResult({ success: false, message: '❌ Network error. Check your connection and try again.' });
    });

    xhr.open('POST', '/api/upload/video');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  };

  const handleCluster = async (videoId) => {
    try {
      const res = await authFetch('/api/v1/clusters', {
        method: 'POST',
        body: JSON.stringify({ video_id: videoId, force_recluster: true }),
      });
      if (res.ok) {
        setResult({ success: true, message: `🔄 Clustering triggered for video ${videoId}. Check Damage Map for results.` });
      } else {
        setResult({ success: false, message: '⚠️ Could not trigger clustering. ML service may be offline.' });
      }
    } catch {
      setResult({ success: false, message: '❌ Network error triggering clustering.' });
    }
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p className="page-eyebrow">Data Ingestion</p>
        <h1 className="page-title">Upload Survey Data</h1>
        <p className="page-subtitle">Submit dashcam footage and sensor logs for AI detection and cluster analysis.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>

        {/* Upload Form */}
        <div>
          {/* Info Banner */}
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>ℹ️</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Automated Processing Pipeline</div>
              <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                After upload, the AI engine extracts detections, applies DBSCAN clustering, and calculates risk scores automatically within minutes.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">📹 Survey File Submission</div>
                  <div className="panel-subtitle">Upload dashcam video with optional GPS and sensor data</div>
                </div>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                <DropZone
                  label="Dashcam Video File"
                  required
                  accept="video/mp4,video/avi,.mov,.mp4"
                  hint="MP4, AVI, MOV — max 500MB"
                  file={videoFile}
                  onFile={setVideoFile}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <DropZone
                    label="GPS Trace File (Optional)"
                    accept=".csv,.json"
                    hint="CSV/JSON with lat, lon columns"
                    file={gpsFile}
                    onFile={setGpsFile}
                  />
                  <DropZone
                    label="Accelerometer Data (Optional)"
                    accept=".csv,.json"
                    hint="CSV/JSON with x, y, z readings"
                    file={accelFile}
                    onFile={setAccelFile}
                  />
                </div>

                {/* Progress Bar */}
                {uploading && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Uploading...</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{progress}%</span>
                    </div>
                    <div className="progress-track" style={{ height: 8 }}>
                      <div className="progress-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2563eb, #7c3aed)' }} />
                    </div>
                  </div>
                )}

                {/* Result */}
                {result && (
                  <div className={`alert ${result.success ? 'alert-success' : 'alert-danger'}`}>
                    <span>{result.message}</span>
                  </div>
                )}

                {/* Submit */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={uploading || !videoFile}
                    className="btn btn-primary"
                    style={{
                      opacity: !videoFile ? 0.5 : 1,
                      cursor: !videoFile || uploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {uploading ? <><span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} /> Uploading...</> : '📤 Upload & Process'}
                  </button>
                  {!uploading && videoFile && (
                    <button
                      type="button"
                      onClick={() => { setVideoFile(null); setGpsFile(null); setAccelFile(null); setResult(null); }}
                      className="btn btn-secondary"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Processing Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">💡 Best Practices</div>
            </div>
            <div className="panel-body">
              {[
                { icon: '🎥', title: 'Video Quality', desc: 'Use at least 480p resolution. Higher quality = better AI detection accuracy.' },
                { icon: '📍', title: 'GPS Data', desc: 'Include a GPS trace CSV with lat, lon columns for precise damage mapping.' },
                { icon: '📐', title: 'Accelerometer', desc: 'IMU data (x, y, z) helps correlate vibrations with road damage severity.' },
                { icon: '⚡', title: 'Auto-Processing', desc: 'Clustering and risk scoring starts automatically after upload completes.' },
              ].map(({ icon, title, desc }, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 16 : 0 }}>
                  <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">📊 Supported Formats</div>
            </div>
            <div className="panel-body">
              {[
                { type: 'Video', formats: 'MP4, AVI, MOV', size: 'Max 500MB' },
                { type: 'GPS', formats: 'CSV, JSON', size: 'lat, lon columns' },
                { type: 'IMU', formats: 'CSV, JSON', size: 'x, y, z columns' },
              ].map(({ type, formats, size }, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{type}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{size}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>{formats}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upload History */}
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">📋 Upload History</div>
            <div className="panel-subtitle">Recent survey data submissions and processing status</div>
          </div>
          <button onClick={loadUploads} className="btn btn-secondary btn-sm">🔄 Refresh</button>
        </div>

        {loadingList ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading upload history...</div>
        ) : uploads.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>No Uploads Yet</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Upload your first survey footage above to get started.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Video ID</th>
                  <th>File Name</th>
                  <th>File Size</th>
                  <th>GPS Points</th>
                  <th>Detections</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{u.video_id}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.original_filename || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {u.file_size ? `${(u.file_size / 1024 / 1024).toFixed(1)} MB` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{u.gps_data?.length || 0}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{u.processing_result?.detections_count || 0}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {u.status === 'completed' && (
                        <button
                          onClick={() => handleCluster(u.video_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11 }}
                        >
                          Re-cluster
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
