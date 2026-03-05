'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authFetch } from '@/utils/authFetch';

const ROLE_LABELS = {
    city_admin: '🏛️ City Admin',
    zone_officer: '🗺️ Zone Officer',
    state_authority: '🏢 State Authority',
    contractor: '🔧 Contractor',
    viewer: '👁️ Viewer',
};

const ROLE_COLORS = {
    city_admin: { bg: '#eff6ff', color: '#1d4ed8' },
    zone_officer: { bg: '#f0fdf4', color: '#15803d' },
    state_authority: { bg: '#fdf4ff', color: '#7e22ce' },
    contractor: { bg: '#fff7ed', color: '#c2410c' },
    viewer: { bg: '#f8fafc', color: '#64748b' },
};

function RoleBadge({ role }) {
    const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
    return (
        <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {ROLE_LABELS[role] || role}
        </span>
    );
}

export default function AdminPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
    const [submitting, setSubmitting] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editRole, setEditRole] = useState('');

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rdd_user');
            if (raw) setCurrentUser(JSON.parse(raw));
        } catch (_) { }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/v1/admin/users');
            const data = await res.json();
            if (data.users) setUsers(data.users);
            else setMsg({ type: 'error', text: data.error || 'Failed to load users.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4000);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await authFetch('/api/v1/admin/users', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                showMsg('success', `User "${data.user.name}" created successfully!`);
                setShowForm(false);
                setForm({ name: '', email: '', password: '', role: 'viewer' });
                load();
            } else {
                showMsg('error', data.error || 'Failed to create user.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            const res = await authFetch(`/api/v1/admin/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => u._id == userId ? { ...u, role } : u));
                showMsg('success', 'Role updated!');
            }
        } finally {
            setEditId(null);
        }
    };

    const handleDelete = async (userId, name) => {
        if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
        const res = await authFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            setUsers(prev => prev.filter(u => u._id != userId));
            showMsg('success', `User "${name}" deleted.`);
        }
    };

    const isAdmin = currentUser?.role === 'city_admin' || currentUser?.role === 'admin';

    if (!isAdmin) {
        return (
            <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>🚫</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Admin Access Required</h2>
                <p style={{ color: '#64748b' }}>You need City Admin privileges to access this page.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }} className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <p className="page-eyebrow">Administration</p>
                    <h1 className="page-title">User Management</h1>
                    <p className="page-subtitle">Create, manage and assign roles to your team members.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={load} className="btn btn-secondary btn-sm">🔄 Refresh</button>
                    <button onClick={() => setShowForm(s => !s)} className="btn btn-primary btn-sm">
                        {showForm ? '✕ Cancel' : '+ Add User'}
                    </button>
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

            {/* Create User Form */}
            {showForm && (
                <div className="panel" style={{ marginBottom: 24 }}>
                    <div className="panel-header">
                        <div className="panel-title">➕ Create New User</div>
                    </div>
                    <div className="panel-body">
                        <form onSubmit={handleCreate}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Full Name</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. Raj Patel"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Email Address</label>
                                    <input
                                        className="input"
                                        type="email"
                                        placeholder="e.g. raj@amc.gov.in"
                                        value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Password</label>
                                    <input
                                        className="input"
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Role</label>
                                    <select
                                        className="input"
                                        value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                                {submitting ? 'Creating...' : '✓ Create User'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { icon: '👥', label: 'Total Users', value: users.length, color: '#2563eb' },
                    { icon: '🏛️', label: 'Admins', value: users.filter(u => u.role === 'city_admin').length, color: '#7c3aed' },
                    { icon: '🔧', label: 'Contractors', value: users.filter(u => u.role === 'contractor').length, color: '#c2410c' },
                    { icon: '🗺️', label: 'Zone Officers', value: users.filter(u => u.role === 'zone_officer').length, color: '#15803d' },
                ].map(({ icon, label, value, color }) => (
                    <div key={label} className="stat-card">
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                        <div className="stat-value" style={{ color }}>{value}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* User Table */}
            <div className="panel">
                <div className="panel-header">
                    <div className="panel-title">👤 All Users</div>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{users.length} members</span>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading users...</div>
                ) : (
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id}>
                                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0
                                                }}>
                                                    {user.name?.slice(0, 2).toUpperCase() || '??'}
                                                </div>
                                                {user.name}
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{user.email}</td>
                                        <td>
                                            {editId === user._id ? (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <select
                                                        className="input"
                                                        style={{ padding: '4px 8px', fontSize: 12 }}
                                                        value={editRole}
                                                        onChange={e => setEditRole(e.target.value)}
                                                    >
                                                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                                    </select>
                                                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={() => handleRoleChange(user._id, editRole)}>✓</button>
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setEditId(null)}>✕</button>
                                                </div>
                                            ) : (
                                                <RoleBadge role={user.role} />
                                            )}
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: 12 }}>
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                                    onClick={() => { setEditId(user._id); setEditRole(user.role); }}
                                                    title="Change Role"
                                                >✏️ Role</button>
                                                {currentUser?.id !== user._id?.toString() && (
                                                    <button
                                                        onClick={() => handleDelete(user._id, user.name)}
                                                        style={{
                                                            padding: '4px 10px', fontSize: 11, borderRadius: 6, border: 'none',
                                                            background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 700,
                                                        }}
                                                        title="Delete User"
                                                    >🗑️</button>
                                                )}
                                            </div>
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
