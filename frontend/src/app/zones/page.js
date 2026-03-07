'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authFetch } from '@/utils/authFetch';

/**
 * ZONES MANAGEMENT PAGE
 * Accessible to: master_admin, city_admin
 * Allows creating city zones (by name/code) and viewing zone ↔ officer assignments.
 */

// Predefined city zones for Anand / typical Indian municipality
const PRESET_ZONES = [
    { name: 'Zone A – North', code: 'ZN-A', description: 'Northern ward area' },
    { name: 'Zone B – South', code: 'ZN-B', description: 'Southern ward area' },
    { name: 'Zone C – East', code: 'ZN-C', description: 'Eastern ward area' },
    { name: 'Zone D – West', code: 'ZN-D', description: 'Western ward area' },
    { name: 'Zone E – Central', code: 'ZN-E', description: 'Central city area' },
    { name: 'Highway Zone', code: 'ZN-HWY', description: 'State highway corridors' },
];

const ZONE_ICON_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#9333ea'];

export default function ZonesPage() {
    const [zones, setZones] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(null);

    const [form, setForm] = useState({ name: '', code: '', description: '' });

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rdd_user');
            if (raw) setCurrentUser(JSON.parse(raw));
        } catch (_) { }
    }, []);

    const loadZones = useCallback(async () => {
        setLoading(true);
        try {
            const [zRes, uRes] = await Promise.all([
                authFetch('/api/v1/zones'),
                authFetch('/api/v1/admin/users'),
            ]);
            const zData = await zRes.json();
            const uData = await uRes.json();
            if (zData.zones) setZones(zData.zones);
            if (uData.users) setUsers(uData.users);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadZones(); }, [loadZones]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4000);
    };

    const handlePreset = (preset) => {
        setForm({ name: preset.name, code: preset.code, description: preset.description });
        setShowForm(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await authFetch('/api/v1/zones', {
                method: 'POST',
                body: JSON.stringify({ name: form.name, code: form.code, description: form.description }),
            });
            const data = await res.json();
            if (res.ok) {
                showMsg('success', `Zone "${data.zone.name}" created!`);
                setShowForm(false);
                setForm({ name: '', code: '', description: '' });
                loadZones();
            } else {
                showMsg('error', data.error || 'Failed to create zone.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (zoneId, zoneName) => {
        if (!confirm(`Delete zone "${zoneName}"? Officers assigned to this zone will lose their zone association.`)) return;
        setDeleting(zoneId);
        try {
            const res = await authFetch(`/api/v1/zones/${zoneId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                setZones(prev => prev.filter(z => z._id !== zoneId));
                showMsg('success', `Zone "${zoneName}" deleted.`);
            } else {
                showMsg('error', data.error || 'Failed to delete zone.');
            }
        } finally {
            setDeleting(null);
        }
    };

    // Map zone_id -> officers assigned to that zone
    const officersByZone = {};
    users.filter(u => u.role === 'zone_officer' && u.authority_zone?.id).forEach(u => {
        const zid = u.authority_zone.id;
        if (!officersByZone[zid]) officersByZone[zid] = [];
        officersByZone[zid].push(u);
    });

    const isAdmin = ['master_admin', 'city_admin', 'admin'].includes(currentUser?.role);
    const isMasterAdmin = currentUser?.role === 'master_admin';

    if (!isAdmin) {
        return (
            <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>🚫</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Admin Access Required</h2>
                <p style={{ color: '#64748b' }}>You need City Admin or Master Admin privileges to manage zones.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }} className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <p className="page-eyebrow">Administration</p>
                    <h1 className="page-title">City Zone Management</h1>
                    <p className="page-subtitle">
                        Define municipal zones and assign zone officers. Zone officers can only view risk data within their assigned zone.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <a href="/admin" style={{
                        padding: '8px 16px', borderRadius: 8, border: '1px solid #bfdbfe',
                        background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13,
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>👤 Manage Users</a>
                    <button onClick={loadZones} className="btn btn-secondary btn-sm">🔄 Refresh</button>
                    <button onClick={() => setShowForm(s => !s)} className="btn btn-primary btn-sm">
                        {showForm ? '✕ Cancel' : '+ New Zone'}
                    </button>
                </div>
            </div>

            {/* How-it-works Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
                borderRadius: 12, padding: '16px 20px', marginBottom: 24,
                display: 'flex', gap: 20, alignItems: 'flex-start',
            }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>🗺️</span>
                <div>
                    <div style={{ color: '#bae6fd', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                        How Zone-Based Access Control Works
                    </div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        {[
                            { step: '1', icon: '🏙️', label: 'Create city zones (e.g. North, South, Central)' },
                            { step: '2', icon: '👮', label: 'Assign a Zone Officer to each zone in User Management' },
                            { step: '3', icon: '🔐', label: 'Zone Officers only see road damage in their zone' },
                            { step: '4', icon: '🏛️', label: 'City Admin & Master Admin see all zones' },
                        ].map(({ step, icon, label }) => (
                            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: '50%', background: '#0891b2',
                                    color: 'white', fontSize: 11, fontWeight: 900,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>{step}</div>
                                <span style={{ color: '#e0f2fe', fontSize: 12 }}>{icon} {label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Message */}
            {msg && (
                <div style={{
                    padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                    background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: msg.type === 'success' ? '#15803d' : '#dc2626',
                    border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fca5a5'}`,
                    fontSize: 13, fontWeight: 600,
                }}>
                    {msg.type === 'success' ? '✅' : '❌'} {msg.text}
                </div>
            )}

            {/* Quick Presets */}
            {showForm && (
                <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>⚡ Quick Presets:</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {PRESET_ZONES.map(p => (
                            <button key={p.code} onClick={() => handlePreset(p)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                                    cursor: 'pointer',
                                }}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Zone Form */}
            {showForm && (
                <div className="panel" style={{ marginBottom: 24 }}>
                    <div className="panel-header">
                        <div className="panel-title">➕ Create New Zone</div>
                    </div>
                    <div className="panel-body">
                        <form onSubmit={handleCreate}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                        Zone Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input className="input" placeholder="e.g. Zone A – North Anand"
                                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                        Zone Code <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input className="input" placeholder="e.g. ZN-A"
                                        value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                        Description
                                    </label>
                                    <input className="input" placeholder="Optional description of this zone"
                                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? 'Creating...' : '✓ Create Zone'}
                                </button>
                                <span style={{ fontSize: 12, color: '#64748b' }}>
                                    💡 After creating zones, assign officers in <a href="/admin" style={{ color: '#2563eb' }}>User Management</a>.
                                </span>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { icon: '🗺️', label: 'Total Zones', value: zones.length, color: '#2563eb' },
                    { icon: '👮', label: 'Zone Officers', value: users.filter(u => u.role === 'zone_officer').length, color: '#15803d' },
                    { icon: '⚠️', label: 'Unassigned Zones', value: zones.filter(z => !officersByZone[z._id]).length, color: '#d97706' },
                ].map(({ icon, label, value, color }) => (
                    <div key={label} className="stat-card">
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                        <div className="stat-value" style={{ color }}>{value}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* Zone Cards */}
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading zones...</div>
            ) : zones.length === 0 ? (
                <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>No Zones Created Yet</h3>
                    <p style={{ color: '#64748b', marginBottom: 20 }}>Create city zones to enable zone-based data access control for your officers.</p>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">+ Create First Zone</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {zones.map((zone, idx) => {
                        const color = ZONE_ICON_COLORS[idx % ZONE_ICON_COLORS.length];
                        const officers = officersByZone[zone._id] || [];
                        return (
                            <div key={zone._id} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Zone Color Banner */}
                                <div style={{
                                    height: 6, background: color, borderRadius: '12px 12px 0 0',
                                }} />
                                <div style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{
                                                    background: color + '20', color, fontSize: 11, fontWeight: 800,
                                                    padding: '2px 8px', borderRadius: 12, border: `1px solid ${color}40`,
                                                }}>{zone.code}</span>
                                            </div>
                                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>{zone.name}</h3>
                                            {zone.description && (
                                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 0 }}>{zone.description}</p>
                                            )}
                                        </div>
                                        {(isMasterAdmin) && (
                                            <button onClick={() => handleDelete(zone._id, zone.name)}
                                                disabled={deleting === zone._id}
                                                style={{
                                                    padding: '4px 10px', fontSize: 11, borderRadius: 6, border: 'none',
                                                    background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 700,
                                                }}>
                                                {deleting === zone._id ? '...' : '🗑️'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Assigned Officers */}
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                                            👮 ASSIGNED OFFICERS ({officers.length})
                                        </div>
                                        {officers.length === 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: 20, fontSize: 11,
                                                    background: '#fef9c3', color: '#a16207', fontWeight: 600,
                                                    border: '1px solid #fde68a',
                                                }}>⚠️ No officer assigned</span>
                                                <a href="/admin" style={{ fontSize: 11, color: '#2563eb' }}>Assign →</a>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {officers.map(o => (
                                                    <div key={o._id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 26, height: 26, borderRadius: '50%',
                                                            background: `linear-gradient(135deg, ${color}, ${color}99)`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 10, fontWeight: 900, color: 'white', flexShrink: 0,
                                                        }}>
                                                            {o.name?.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{o.name}</div>
                                                            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{o.email}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Zone created date */}
                                    <div style={{ marginTop: 12, fontSize: 11, color: '#cbd5e1' }}>
                                        Created {zone.created_at ? new Date(zone.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
