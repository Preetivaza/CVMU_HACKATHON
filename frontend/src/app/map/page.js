'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { authFetch } from '@/utils/authFetch';

const TIME_RANGES = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'All Time', value: 'all' },
];

function TimeFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
      {TIME_RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            background: value === r.value ? '#2563eb' : 'transparent',
            color: value === r.value ? 'white' : '#64748b',
            transition: 'all 0.15s',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14,
    }}>
      Loading map...
    </div>
  ),
});

const RISK_FILTERS = ['All', 'Critical', 'High', 'Medium', 'Low'];
const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', repaired: 'Repaired', compliance_violation: '⚠️ Violation' };
const STATUS_COLORS = { pending: '#f97316', in_progress: '#2563eb', repaired: '#16a34a', compliance_violation: '#dc2626' };
const RISK_COLORS = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' };
const RISK_BG = { Critical: '#fee2e2', High: '#fff7ed', Medium: '#fefce8', Low: '#f0fdf4' };

function RiskBadge({ level }) {
  const l = level || 'Low';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: RISK_BG[l] || '#f1f5f9', color: RISK_COLORS[l] || '#64748b',
    }}>
      {l}
    </span>
  );
}

function StatusBtn({ status, current, onClick }) {
  const active = status === current;
  return (
    <button
      onClick={() => onClick(status)}
      style={{
        padding: '9px 14px', borderRadius: 8, border: 'none',
        background: active ? '#2563eb' : '#f8fafc',
        color: active ? 'white' : '#64748b',
        fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 8,
        borderLeft: active ? '3px solid #1d4ed8' : '3px solid transparent',
        transition: 'all 0.15s',
        boxShadow: active ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? 'white' : STATUS_COLORS[status] || '#94a3b8',
        flexShrink: 0,
      }} />
      {STATUS_LABELS[status]}
      {active && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
    </button>
  );
}

export default function MapPage() {
  const [clusters, setClusters] = useState([]);
  const [detections, setDetections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const debounceRef = useRef(null);

  const load = useCallback(async (tr = timeFilter) => {
    setLoading(true);
    try {
      const trParam = tr !== 'all' ? `&time_range=${tr}` : '';
      const [clusterRes, detRes] = await Promise.all([
        authFetch(`/api/v1/clusters?limit=100${trParam}`),
        authFetch('/api/v1/detections?limit=100'),
      ]);
      const clusterData = await clusterRes.json();
      const detData = await detRes.json();
      if (clusterData.features) setClusters(clusterData.features);
      const rawDetections = detData.features || [];
      const validDetections = rawDetections.filter(d => d.geometry?.coordinates);
      setDetections(validDetections);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => { load(); }, [load]);

  // Debounced re-fetch when timeFilter changes (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(timeFilter), 300);
    return () => clearTimeout(debounceRef.current);
  }, [timeFilter]); // eslint-disable-line

  const filtered = filter === 'All'
    ? clusters
    : clusters.filter(c => (c.properties?.risk_level || '').toLowerCase() === filter.toLowerCase());

  const handleStatusUpdate = async (status) => {
    if (!selected || updating) return;
    setUpdating(true);
    setMsg(null);
    try {
      const resp = await authFetch(`/api/v1/clusters/${selected.properties?._id || selected._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: `Updated via Map Dashboard - ${new Date().toISOString()}` }),
      });
      if (resp.ok) {
        const { data: updated } = await resp.json();
        setClusters(prev => prev.map(c => {
          const id = c.properties?._id || c._id;
          return id === (updated._id || updated.properties?._id || selected._id) ? { ...c, properties: { ...c.properties, status } } : c;
        }));
        setSelected(s => ({ ...s, properties: { ...s.properties, status } }));
        setMsg({ type: 'success', text: `Status updated to "${STATUS_LABELS[status]}"` });
      } else {
        setMsg({ type: 'error', text: 'Update failed. Please try again.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error during update.' });
    } finally {
      setUpdating(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const riskCounts = ['Critical', 'High', 'Medium', 'Low'].reduce((acc, level) => {
    acc[level] = clusters.filter(c => (c.properties?.risk_level || '').toLowerCase() === level.toLowerCase()).length;
    return acc;
  }, {});

  return (
    <div style={{ height: 'calc(100vh - 60px - 56px)', display: 'flex', flexDirection: 'column', gap: 0 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <p className="page-eyebrow">Live Infrastructure</p>
          <h1 className="page-title">Road Damage Map</h1>
          <p className="page-subtitle">
            Showing <strong>{filtered.length}</strong> clusters and <strong>{detections.length}</strong> damage points
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '5px 14px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Feed</span>
          </div>
          <TimeFilter value={timeFilter} onChange={setTimeFilter} />
          <button onClick={() => load(timeFilter)} className="btn btn-secondary btn-sm">🔄 Refresh</button>
          <button
            onClick={() => setShowHeatmap(h => !h)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: showHeatmap ? '#7c3aed' : '#f1f5f9',
              color: showHeatmap ? 'white' : '#64748b',
              fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
            }}
          >
            🌡️ {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>

        {/* Left Sidebar — Filters + Cluster List */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Risk Filter */}
          <div className="panel">
            <div className="panel-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 16px' }}>
              <div className="panel-title" style={{ fontSize: 13 }}>🎯 Filter by Risk Level</div>
            </div>
            <div style={{ padding: '10px 10px' }}>
              {RISK_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none',
                    background: filter === f ? '#eff6ff' : 'transparent',
                    color: filter === f ? '#2563eb' : '#64748b',
                    fontSize: 13, fontWeight: filter === f ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                    borderLeft: filter === f ? '3px solid #2563eb' : '3px solid transparent',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{f === 'All' ? '📍 All Clusters' : `🔴 ${f}`}</span>
                  <span style={{
                    background: filter === f ? '#2563eb' : '#f1f5f9',
                    color: filter === f ? 'white' : '#94a3b8',
                    borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>
                    {f === 'All' ? clusters.length : (riskCounts[f] || 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cluster List */}
          <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 16px', flexShrink: 0 }}>
              <div className="panel-title" style={{ fontSize: 13 }}>📋 Cluster List</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No clusters matching filter</div>
              ) : filtered.map((c, i) => {
                const isActive = selected && (selected.properties?._id === c.properties?._id);
                const level = c.properties?.risk_level || 'Low';
                return (
                  <div
                    key={i}
                    onClick={() => setSelected(isActive ? null : c)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                      background: isActive ? '#eff6ff' : 'transparent',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                        Cluster #{i + 1}
                      </span>
                      <RiskBadge level={level} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                      {c.geometry?.coordinates
                        ? `${c.geometry.coordinates[1].toFixed(4)}, ${c.geometry.coordinates[0].toFixed(4)}`
                        : '—'
                      }
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                      Risk: <strong style={{ color: RISK_COLORS[level] }}>{Math.round((c.properties?.final_risk_score || 0) * 100)}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Map */}
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
          <MapComponent clusters={filtered} detections={detections} onClusterClick={setSelected} showHeatmap={showHeatmap} />
        </div>

        {/* Right Sidebar — Cluster Detail */}
        {selected && (
          <div className="panel slide-right" style={{
            width: 320, flexShrink: 0, overflowY: 'auto',
            borderLeft: '3px solid #2563eb',
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="panel-title">Cluster Details</div>
              <button onClick={() => setSelected(null)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 6,
                width: 28, height: 28, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            <div style={{ padding: '18px' }}>
              {/* Risk Level */}
              <div style={{ marginBottom: 18 }}>
                <RiskBadge level={selected.properties?.risk_level} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>
                  {selected.properties?.damage_type || 'Multiple Anomalies'}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
                  📍 {selected.geometry?.coordinates?.[1]?.toFixed(6)}, {selected.geometry?.coordinates?.[0]?.toFixed(6)}
                  <button
                    onClick={() => {
                      if (selected.geometry?.coordinates) {
                        navigator.clipboard.writeText(`${selected.geometry.coordinates[1]},${selected.geometry.coordinates[0]}`);
                      }
                    }}
                    style={{ marginLeft: 8, fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >Copy</button>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {[
                  { label: 'Overall Risk Index', value: `${Math.round((selected.properties?.final_risk_score || 0) * 100)}%` },
                  { label: 'Satellite Risk (Aging)', value: selected.properties?.aging_index != null ? `${Math.round(selected.properties.aging_index * 100)}%` : 'Pending GEE' },
                  { label: 'AI Confidence', value: `${Math.round((selected.properties?.avg_confidence || 0) * 100)}%` },
                  { label: 'Frames/Points', value: selected.properties?.points_count || '—' },
                  { label: 'Repeat Count', value: `${selected.properties?.repeat_count || 1}×` },
                ].map(({ label, value }, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Message */}
              {msg && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                  background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: msg.type === 'success' ? '#15803d' : '#dc2626',
                  fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fca5a5'}`,
                }}>
                  {msg.type === 'success' ? '✅' : '❌'} {msg.text}
                </div>
              )}

              {/* Status Update */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Update Status
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.keys(STATUS_LABELS).map(s => (
                    <StatusBtn
                      key={s}
                      status={s}
                      current={selected.properties?.status}
                      onClick={handleStatusUpdate}
                    />
                  ))}
                </div>
              </div>

              {/* Timeline */}
              {selected.first_detected && (
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    🕐 Detection Timeline
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    First detected: {new Date(selected.first_detected).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
