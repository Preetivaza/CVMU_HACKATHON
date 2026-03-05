'use client';

import React, { useEffect, useState } from 'react';

export default function SettingsPage() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rdd_user');
            if (raw) setUser(JSON.parse(raw));
        } catch (_) { }
    }, []);

    const initials = user?.name?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || 'AD';

    const roleDescriptions = {
        city_admin: 'Full access to all clusters, analytics, and administrative tools.',
        zone_officer: 'Access restricted to clusters within your assigned geographic zone.',
        state_authority: 'Highway-level risk data and state-wide reporting.',
        contractor: 'View assigned repair work orders and update completion status.',
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }} className="fade-in">

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <p className="page-eyebrow">Configuration</p>
                <h1 className="page-title">Account Settings</h1>
                <p className="page-subtitle">View your account details and system configuration.</p>
            </div>

            {/* Profile Card */}
            <div className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-header">
                    <div className="panel-title">👤 Profile</div>
                </div>
                <div className="panel-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 26, fontWeight: 900, color: 'white', flexShrink: 0,
                        }}>
                            {initials}
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
                                {user?.name || user?.email || 'Admin User'}
                            </div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: 20, padding: '3px 12px',
                                fontSize: 11, fontWeight: 700, color: '#1d4ed8',
                                textTransform: 'capitalize',
                            }}>
                                🏛️ {(user?.role || 'city_admin').replace('_', ' ')}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                            { label: 'Email Address', value: user?.email || '—' },
                            { label: 'Role', value: (user?.role || 'city_admin').replace(/_/g, ' ') },
                            { label: 'Access Level', value: user?.role === 'city_admin' ? 'Full Access' : 'Scoped Access' },
                            { label: 'User ID', value: user?._id || user?.id || '—' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', textTransform: 'capitalize', fontFamily: label === 'User ID' || label === 'Email Address' ? 'monospace' : 'inherit', fontSize: label === 'User ID' ? 11 : 14 }}>
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {user?.role && (
                        <div className="alert alert-info" style={{ marginTop: 16 }}>
                            <span style={{ fontSize: 16 }}>ℹ️</span>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>Your Role Permissions</div>
                                <div style={{ fontSize: 12 }}>{roleDescriptions[user.role] || roleDescriptions.city_admin}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* System Configuration */}
            <div className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-header">
                    <div className="panel-title">⚙️ System Configuration</div>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Read-only</span>
                </div>
                <div className="panel-body">
                    {[
                        { label: 'Risk Score Threshold — Critical', value: '≥ 80', icon: '🔴' },
                        { label: 'Risk Score Threshold — High', value: '60–79', icon: '🟠' },
                        { label: 'Risk Score Threshold — Medium', value: '40–59', icon: '🟡' },
                        { label: 'Risk Score Threshold — Low', value: '< 40', icon: '🟢' },
                        { label: 'DBSCAN Epsilon (Cluster Radius)', value: '10 meters', icon: '📐' },
                        { label: 'DBSCAN Min Samples', value: '3 detections', icon: '🔬' },
                        { label: 'Aging Index Rate', value: '0.1 per 30 days', icon: '⏰' },
                        { label: 'ML Service Port', value: 'Port 8000', icon: '🤖' },
                    ].map(({ label, value, icon }, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '11px 0', borderBottom: i < 7 ? '1px solid #f8fafc' : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{icon}</span>
                                <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{label}</span>
                            </div>
                            <span style={{
                                fontSize: 13, fontWeight: 700, color: '#0f172a',
                                background: '#f8fafc', padding: '3px 10px', borderRadius: 6,
                                border: '1px solid #f1f5f9', fontFamily: 'monospace',
                            }}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security */}
            <div className="panel">
                <div className="panel-header">
                    <div className="panel-title">🔐 Security</div>
                </div>
                <div className="panel-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f8fafc' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>JWT Authentication</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Token-based authentication for all API calls</div>
                        </div>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>✅ Active</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f8fafc' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Role-Based Access Control</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Data is filtered based on your role and assigned zone</div>
                        </div>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>✅ Active</span>
                    </div>
                    <div style={{ padding: '11px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Sign Out</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Clears your session and JWT token from this device</div>
                        </div>
                        <button
                            onClick={() => { localStorage.removeItem('rdd_token'); localStorage.removeItem('rdd_user'); window.location.href = '/login'; }}
                            className="btn btn-danger btn-sm"
                        >
                            Sign Out →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
