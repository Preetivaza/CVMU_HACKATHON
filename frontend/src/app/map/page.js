'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { authFetch } from '@/utils/authFetch';
import { useSearchParams } from 'next/navigation';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14, borderRadius: 12,
    }}>
      Loading map...
    </div>
  ),
});

const RISK_COLORS = { Critical: '#dc2626', High: '#dc2626', Medium: '#ca8a04', Low: '#16a34a' };
const RISK_BG = { Critical: '#fee2e2', High: '#fee2e2', Medium: '#fefce8', Low: '#f0fdf4' };
const STATUS_LABELS = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', repaired: 'Repaired', verified: 'Verified' };
const STATUS_COLORS = { pending: '#f97316', scheduled: '#8b5cf6', in_progress: '#2563eb', repaired: '#16a34a', verified: '#0891b2' };

function RiskBadge({ level }) {
  const l = (level === 'High' ? 'Critical' : level) || 'Low';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: RISK_BG[l] || '#f1f5f9', color: RISK_COLORS[l] || '#64748b',
    }}>{l}</span>
  );
}

function getScopeInfo(user) {
  const role = user?.role;
  if (role === 'zone_officer') {
    const zName = user?.authority_zone?.name || user?.authority_zone?.code || 'Assigned Zone';
    return { icon: '🗺️', label: zName, sub: 'Zone boundary enforced', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' };
  }
  if (role === 'state_authority') return { icon: '🏢', label: 'State — Highways', sub: 'Highway corridors only', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
  if (role === 'city_admin') return { icon: '🏛️', label: 'City — Full View', sub: 'All zones & areas', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
  if (role === 'master_admin') return { icon: '👑', label: 'Master Admin', sub: 'All data, full access', color: '#7e22ce', bg: '#faf5ff', border: '#d8b4fe' };
  if (role === 'contractor') return { icon: '🔧', label: 'Contractor', sub: 'Assigned roads only', color: '#a16207', bg: '#fefce8', border: '#fde68a' };
  return null;
}

function MapContent() {
  const [clusters, setClusters] = useState([]);
  const [detections, setDetections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [riskFilter, setRiskFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // Zone officer location pick
  const [pickMode, setPickMode] = useState(false);
  const [pickedCoord, setPickedCoord] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [areaSaveMsg, setAreaSaveMsg] = useState(null);
  const debounceRef = useRef(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('id');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rdd_user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch (_) { }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clusterRes, detRes] = await Promise.all([
        authFetch('/api/v1/clusters?limit=200'),
        authFetch('/api/v1/detections?limit=200'),
      ]);
      const clusterData = await clusterRes.json();
      const detData = await detRes.json();
      if (clusterData.features) {
        const mapped = clusterData.features.map(f => {
          if (f.properties?.risk_level === 'High') f.properties.risk_level = 'Critical';
          return f;
        });
        setClusters(mapped);
        if (highlightId) {
          const match = mapped.find(c => c.properties?._id === highlightId || c._id === highlightId);
          if (match) setSelected(match);
        }
      }
      setDetections((detData.features || []).filter(d => d.geometry?.coordinates));
    } finally {
      setLoading(false);
    }
  }, [highlightId]);

  useEffect(() => { load(); }, [load]);

  // Save picked coordinate as zone officer's patrol location (with duplicate check)
  const handleSaveLocation = async () => {
    if (!pickedCoord) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      // Duplicate check: no two zone officers at the same spot
      try {
        const usersRes = await authFetch('/api/v1/admin/users');
        if (usersRes.ok) {
          const { users } = await usersRes.json();
          const dup = (users || []).find(u =>
            u.role === 'zone_officer' &&
            u._id?.toString() !== currentUser?.id &&
            u.saved_location &&
            Math.abs(u.saved_location.lat - pickedCoord.lat) < 0.0005 &&
            Math.abs(u.saved_location.lon - pickedCoord.lon) < 0.0005
          );
          if (dup) {
            setSaveMsg({ ok: false, text: `⚠️ Location already taken by: ${dup.name || dup.email}` });
            setSaving(false);
            return;
          }
        }
      } catch (_) { /* non-admin can't list users; skip duplicate check */ }

      const res = await authFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ saved_location: pickedCoord }),
      });
      if (res.ok) {
        const newUser = { ...currentUser, saved_location: pickedCoord };
        localStorage.setItem('rdd_user', JSON.stringify(newUser));
        setCurrentUser(newUser);
        setSaveMsg({ ok: true, text: `📍 Saved: ${pickedCoord.lat.toFixed(5)}, ${pickedCoord.lon.toFixed(5)}` });
        setPickMode(false);
        setPickedCoord(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveMsg({ ok: false, text: d.error || 'Failed to save location.' });
      }
    } catch { setSaveMsg({ ok: false, text: 'Network error.' }); }
    finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  };

  // Save a drawn polygon area + auto-calculated centroid to the user's profile
  const handleAreaSaved = async ({ polygon, centroid, geojson }) => {
    setAreaSaveMsg({ ok: null, text: 'Saving area...' });
    try {
      const res = await authFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          saved_location: centroid,
          drawn_area: { polygon, centroid, geojson },
        }),
      });
      if (res.ok) {
        const newUser = { ...currentUser, saved_location: centroid, drawn_area: { polygon, centroid, geojson } };
        localStorage.setItem('rdd_user', JSON.stringify(newUser));
        setCurrentUser(newUser);
        setAreaSaveMsg({ ok: true, text: `✅ Area saved! Center: ${centroid.lat.toFixed(5)}, ${centroid.lon.toFixed(5)}` });
      } else {
        const d = await res.json().catch(() => ({}));
        setAreaSaveMsg({ ok: false, text: d.error || 'Failed to save area.' });
      }
    } catch { setAreaSaveMsg({ ok: false, text: 'Network error saving area.' }); }
    finally { setTimeout(() => setAreaSaveMsg(null), 6000); }
  };

  const filtered = clusters.filter(c => {
    const level = c.properties?.risk_level || 'Low';
    const matchRisk = riskFilter === 'All' || level.toLowerCase() === riskFilter.toLowerCase();
    if (!matchRisk) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const damageStr = Object.keys(c.properties?.damage_types || {}).join(' ') + ' ' + (c.properties?.damage_type || '');
    const coords = c.geometry?.coordinates ? `${c.geometry.coordinates[1].toFixed(4)} ${c.geometry.coordinates[0].toFixed(4)}` : '';
    const status = c.properties?.status || '';
    return damageStr.toLowerCase().includes(q) || coords.includes(q) || status.toLowerCase().includes(q) || level.toLowerCase().includes(q);
  });

  const handleStatusUpdate = async (status) => {
    if (!selected || updating) return;
    setUpdating(true);
    setStatusMsg(null);
    try {
      const resp = await authFetch(`/api/v1/clusters/${selected.properties?._id || selected._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: `Updated via Map — ${new Date().toISOString()}` }),
      });
      if (resp.ok) {
        setClusters(prev => prev.map(c => {
          const id = c.properties?._id || c._id;
          const targetId = selected.properties?._id || selected._id;
          return id === targetId ? { ...c, properties: { ...c.properties, status } } : c;
        }));
        setSelected(s => ({ ...s, properties: { ...s.properties, status } }));
        setStatusMsg({ ok: true, text: `Marked as ${STATUS_LABELS[status] || status}` });
      } else {
        setStatusMsg({ ok: false, text: 'Update failed.' });
      }
    } catch {
      setStatusMsg({ ok: false, text: 'Network error.' });
    } finally {
      setUpdating(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const riskCounts = ['Critical', 'Medium', 'Low'].reduce((acc, l) => {
    acc[l] = clusters.filter(c => (c.properties?.risk_level || '').toLowerCase() === l.toLowerCase()).length;
    return acc;
  }, {});

  const scopeInfo = getScopeInfo(currentUser);
  const selectedId = selected?.properties?._id || selected?._id || highlightId;

  return (
    <div style={{ height: 'calc(100vh - 116px)', display: 'flex', flexDirection: 'column', gap: 0 }} className="fade-in">

      {/* ─── Top Bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <p className="page-eyebrow">Live Infrastructure</p>
          <h1 className="page-title" style={{ marginBottom: 2 }}>Road Damage Map</h1>
          <p className="page-subtitle" style={{ fontSize: 12 }}>
            <strong>{filtered.length}</strong> clusters · <strong>{detections.length}</strong> detections
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '5px 14px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live</span>
          </div>
          <button onClick={load} className="btn btn-secondary btn-sm">🔄 Refresh</button>
          {/* Zone Officer Pick Location Button */}
          {currentUser?.role === 'zone_officer' && (
            <button
              onClick={() => { setPickMode(p => !p); setPickedCoord(null); }}
              style={{
                padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: pickMode ? '#dc2626' : '#1d4ed8',
                color: 'white', fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              📍 {pickMode ? 'Cancel Pick' : 'Pin My Location'}
            </button>
          )}
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

      {/* ─── Main Layout ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>

        {/* ─── Left Sidebar ─── */}
        <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

          {/* Risk Filter */}
          <div className="panel" style={{ flexShrink: 0 }}>
            <div style={{ padding: '10px 10px 6px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['All', 'Critical', 'Medium', 'Low'].map(f => (
                <button
                  key={f}
                  onClick={() => setRiskFilter(f)}
                  style={{
                    flex: 1, minWidth: 40, padding: '5px 4px', borderRadius: 6, border: 'none',
                    background: riskFilter === f ? (f === 'Critical' ? '#dc2626' : f === 'Medium' ? '#ca8a04' : f === 'Low' ? '#16a34a' : '#2563eb') : '#f1f5f9',
                    color: riskFilter === f ? 'white' : '#64748b',
                    fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'All' ? `All\n(${clusters.length})` : `${f}\n(${riskCounts[f] || 0})`}
                </button>
              ))}
            </div>
          </div>

          {/* Cluster List */}
          <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>📍 Clusters</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {loading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  {search ? `No clusters match "${search}"` : 'No clusters in this filter'}
                </div>
              ) : filtered.map((c, i) => {
                const isActive = selected && (selected.properties?._id === c.properties?._id || selected._id === c._id);
                const level = c.properties?.risk_level || 'Low';
                const types = Object.keys(c.properties?.damage_types || {});
                const mainType = c.properties?.damage_type || types[0] || 'unknown';
                const coords = c.geometry?.coordinates;
                return (
                  <div
                    key={c.properties?._id || i}
                    onClick={() => setSelected(isActive ? null : c)}
                    style={{
                      padding: '9px 10px', borderRadius: 8, marginBottom: 3, cursor: 'pointer',
                      background: isActive ? '#eff6ff' : 'transparent',
                      borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>#{i + 1}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'capitalize', padding: '1px 6px',
                          borderRadius: 4, background: '#f1f5f9', color: '#475569', letterSpacing: '0.05em',
                        }}>{mainType}</span>
                      </div>
                      <RiskBadge level={level} />
                    </div>
                    {coords && (
                      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                        {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      <span>Risk: <strong style={{ color: RISK_COLORS[level] || '#64748b' }}>{Math.round((c.properties?.final_risk_score || 0) * 100)}%</strong></span>
                      <span style={{ textTransform: 'capitalize', color: STATUS_COLORS[c.properties?.status] || '#94a3b8' }}>
                        {STATUS_LABELS[c.properties?.status] || 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ─── Map ─── */}
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minWidth: 0 }}>

          {/* Confirm card for picked coordinate */}
          {pickMode && pickedCoord && (
            <div style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, background: 'white', borderRadius: 12, padding: '12px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '2px solid #2563eb',
              display: 'flex', alignItems: 'center', gap: 12, minWidth: 360, maxWidth: '90%',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', marginBottom: 2 }}>📍 SELECTED LOCATION</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                  {pickedCoord.lat.toFixed(6)}, {pickedCoord.lon.toFixed(6)}
                </div>
              </div>
              <button onClick={handleSaveLocation} disabled={saving} style={{
                padding: '8px 16px', borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer',
                background: '#2563eb', color: 'white', fontSize: 12, fontWeight: 700, opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Saving...' : '✔ Save'}
              </button>
              <button onClick={() => setPickedCoord(null)} style={{
                padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
                background: '#f8fafc', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 600,
              }}>Clear</button>
            </div>
          )}

          {/* Save feedback toast (point pin) */}
          {saveMsg && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 1200,
              background: saveMsg.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${saveMsg.ok ? '#bbf7d0' : '#fca5a5'}`,
              color: saveMsg.ok ? '#15803d' : '#dc2626',
              padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxWidth: 280,
            }}>
              {saveMsg.text}
            </div>
          )}

          {/* Save feedback toast (polygon draw) */}
          {areaSaveMsg && (
            <div style={{
              position: 'absolute', top: saveMsg ? 60 : 12, right: 12, zIndex: 1200,
              background: areaSaveMsg.ok === true ? '#f0fdf4' : areaSaveMsg.ok === false ? '#fef2f2' : '#f0f9ff',
              border: `1px solid ${areaSaveMsg.ok === true ? '#bbf7d0' : areaSaveMsg.ok === false ? '#fca5a5' : '#bae6fd'}`,
              color: areaSaveMsg.ok === true ? '#15803d' : areaSaveMsg.ok === false ? '#dc2626' : '#0369a1',
              padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxWidth: 280,
            }}>
              {areaSaveMsg.text}
            </div>
          )}

          <MapComponent
            clusters={filtered}
            detections={detections}
            onClusterClick={setSelected}
            showHeatmap={showHeatmap}
            selectedId={selectedId}
            zone={currentUser?.authority_zone}
            pickMode={pickMode}
            onLocationPick={setPickedCoord}
            onAreaSaved={handleAreaSaved}
          />
        </div>

        {/* ─── Detail Panel ─── */}
        {selected && (
          <div className="panel" style={{
            width: 300, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            borderLeft: '2px solid #2563eb',
          }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Cluster Details</div>
              <button onClick={() => setSelected(null)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 5, width: 26, height: 26,
                cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            <div style={{ padding: '14px 16px', flex: 1 }}>
              {/* Risk + Type */}
              <div style={{ marginBottom: 14 }}>
                <RiskBadge level={selected.properties?.risk_level} />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 6, textTransform: 'capitalize' }}>
                  {Object.keys(selected.properties?.damage_types || {}).join(', ') || selected.properties?.damage_type || 'Multiple Damage Types'}
                </div>
                {selected.geometry?.coordinates && (
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📍 {selected.geometry.coordinates[1].toFixed(6)}, {selected.geometry.coordinates[0].toFixed(6)}
                    <button
                      onClick={() => navigator.clipboard.writeText(`${selected.geometry.coordinates[1]},${selected.geometry.coordinates[0]}`)}
                      style={{ fontSize: 9, color: '#2563eb', background: 'none', border: '1px solid #bfdbfe', borderRadius: 3, cursor: 'pointer', padding: '1px 4px' }}
                    >Copy</button>
                  </div>
                )}
              </div>

              {/* Key Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Risk Score', value: `${Math.round((selected.properties?.final_risk_score || 0) * 100)}%` },
                  { label: 'Confidence', value: `${Math.round((selected.properties?.avg_confidence || 0) * 100)}%` },
                  { label: 'Detections', value: selected.properties?.points_count || '—' },
                  { label: 'Repeat Count', value: `${selected.properties?.repeat_count || 1}×` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 7, padding: '8px 10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Satellite Aging */}
              {selected.properties?.aging_index != null && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, padding: '8px 10px', marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#0369a1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>🛰️ Satellite Aging Index</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0369a1' }}>{Math.round(selected.properties.aging_index * 100)}%</div>
                </div>
              )}

              {/* Status Feedback */}
              {statusMsg && (
                <div style={{
                  padding: '8px 10px', borderRadius: 7, marginBottom: 10, fontSize: 12, fontWeight: 600,
                  background: statusMsg.ok ? '#f0fdf4' : '#fef2f2',
                  color: statusMsg.ok ? '#15803d' : '#dc2626',
                  border: `1px solid ${statusMsg.ok ? '#bbf7d0' : '#fca5a5'}`,
                }}>
                  {statusMsg.ok ? '✅' : '❌'} {statusMsg.text}
                </div>
              )}

              {/* Status Update */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Update Repair Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {Object.entries(STATUS_LABELS).map(([s, label]) => {
                    const isActive = selected.properties?.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusUpdate(s)}
                        disabled={updating || isActive}
                        style={{
                          padding: '8px 12px', borderRadius: 7, border: 'none', cursor: isActive ? 'default' : 'pointer',
                          background: isActive ? '#eff6ff' : '#f8fafc',
                          color: isActive ? '#1d4ed8' : '#64748b',
                          fontSize: 12, fontWeight: 700, textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                          borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                          transition: 'all 0.12s',
                          opacity: updating && !isActive ? 0.5 : 1,
                        }}
                      >
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: isActive ? '#2563eb' : (STATUS_COLORS[s] || '#94a3b8'),
                        }} />
                        {label}
                        {isActive && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓ Current</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
        Loading Map...
      </div>
    }>
      <MapContent />
    </Suspense>
  );
}
