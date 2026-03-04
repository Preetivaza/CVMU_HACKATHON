'use client';

import React, { useState, useRef } from 'react';

const IconUpload = ({ size = 28, color = '#94a3b8' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
);

const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

function DropZone({ label, required, accept, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <div>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </p>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 10,
          background: dragging ? '#eff6ff' : '#f8fafc',
          padding: '32px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#2563eb' }}>
            <IconFile />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <IconUpload color={dragging ? '#2563eb' : '#94a3b8'} />
            </div>
            <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 4 }}>Drop file here or click to browse</p>
            {hint && <p style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setResult({ success: true, message: 'Files uploaded successfully. AI processing started.' });
    setSubmitting(false);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Data Ingestion Module
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
          Upload Survey Data
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
          Submit dashcam footage and sensor logs for AI processing and cluster analysis.
        </p>
      </div>

      {/* Info Banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 24,
      }}>
        <div style={{ marginTop: 1 }}><IconInfo /></div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginBottom: 3 }}>Processing Pipeline</p>
          <p style={{ fontSize: 12, color: '#3b82f6', lineHeight: 1.6 }}>
            After upload, the AI engine will automatically extract road damage detections, apply DBSCAN clustering, and calculate risk scores within minutes.
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {/* Section Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
            <IconFile />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Survey File Submission</h2>
          </div>

          {/* Video Upload — Full Width */}
          <div style={{ marginBottom: 24 }}>
            <DropZone
              label="Dashcam Video File"
              required
              accept="video/mp4,video/avi,.mov"
              hint="MP4, AVI, MOV — max 500MB"
            />
          </div>

          {/* GPS + Accelerometer — Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <DropZone
              label="GPS Trace File (Optional)"
              accept=".csv,.json"
              hint="CSV or JSON with lat/lon columns"
            />
            <DropZone
              label="Accelerometer Data (Optional)"
              accept=".csv,.json"
              hint="CSV or JSON with IMU readings"
            />
          </div>

          {/* Result Message */}
          {result && (
            <div style={{
              background: result.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${result.success ? '#bbf7d0' : '#fca5a5'}`,
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: result.success ? '#15803d' : '#dc2626',
              marginBottom: 16,
            }}>
              {result.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '11px 28px',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            {submitting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <IconUpload size={16} color="white" />
                Submit for AI Processing
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
