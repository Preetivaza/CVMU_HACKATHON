'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authFetch } from '@/utils/authFetch';

const ROLE_LABELS = {
    master_admin:    '👑 Master Admin',
    city_admin:      '🏛️ City Admin',
    zone_officer:    '🗺️ Zone Officer',
    state_authority: '🏢 State Authority',
    contractor:      '🔧 Contractor',
    viewer:          '👁️ Viewer',
};

const ROLE_COLORS = {
    master_admin:    { bg: '#fdf2ff', color: '#7e22ce', border: '#d8b4fe' },
    city_admin:      { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    zone_officer:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    state_authority: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    contractor:      { bg: '#fefce8', color: '#a16207', border: '#fde68a' },
    viewer:          { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
};

// Role hierarchy: what roles can be assigned by each role (for dropdown filtering)
const ASSIGNABLE_ROLES = {
    master_admin: ['city_admin', 'zone_officer', 'state_authority', 'contractor', 'viewer'],
    city_admin:   ['zone_officer', 'state_authority', 'contractor', 'viewer'],
};

function RoleBadge({ role }) {
    const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
    return (
        <span style={{
            background: c.bg, color: c.color, fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20, border: `1px solid ${c.border}`,
        }}>
            {ROLE_LABELS[role] || role}
        </span>
    );
}

function ZoneBadge({ zone }) {
    if (!zone) return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>;
    return (
        <span style={{
            background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: 12, border: '1px solid #6ee7b7',
        }}>
            📍 {zone.name || zone.code || 'Zone'}
        </span>
    );
}

export default function AdminPage() {
    const [users, setUsers] = useState([]);
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', authority_zone: '' });
    const [submitting, setSubmitting] = useState(false);

    // Inline edit state
    const [editId, setEditId] = useState(null);
    const [editRole, setEditRole] = useState('');
    const [editZone, setEditZone] = useState('');

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rdd_user');
            if (raw) setCurrentUser(JSON.parse(raw));
        } catch (_) { }
    }, []);

    const loadZones = useCallback(async () => {
        try {
            const res = await authFetch('/api/v1/zones');
            const data = await res.json();
            if (data.zones) setZones(data.zones);
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

    useEffect(() => { load(); loadZones(); }, [load, loadZones]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4000);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Resolve authority_zone object from selected zone id
            let authority_zone = null;
            if (form.authority_zone && form.role === 'zone_officer') {
                const z = zones.find(z => z._id === form.authority_zone);
                if (z) {
                    authority_zone = { id: z._id, name: z.name, code: z.code, geometry: z.geometry };
                }
            }

            const res = await authFetch('/api/v1/admin/users', {
                method: 'POST',
                body: JSON.stringify({ ...form, authority_zone }),
            });
            const data = await res.json();
            if (res.ok) {
                showMsg('success', `User "${data.user.name}" created successfully!`);
                setShowForm(false);
                setForm({ name: '', email: '', password: '', role: 'viewer', authority_zone: '' });
                load();
            } else {
                showMsg('error', data.error || 'Failed to create user.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (userId) => {
        try {
            // Resolve zone object
            let authority_zone = undefined;
            if (editRole === 'zone_officer') {
                if (editZone) {
                    const z = zones.find(z => z._id === editZone);
                    if (z) authority_zone = { id: z._id, name: z.name, code: z.code, geometry: z.geometry };
                } else {
                    authority_zone = null; // explicitly clear
                }
            } else {
                authority_zone = null; // clear zone when changing away from zone_officer
            }

            const body = { role: editRole };
            if (authority_zone !== undefined) body.authority_zone = authority_zone;

            const res = await authFetch(`/api/v1/admin/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(prev => prev.map(u => u._id == userId ? { ...u, role: editRole, authority_zone: body.authority_zone } : u));
                showMsg('success', 'Role updated!');
            } else {
                showMsg('error', data.error || 'Failed to update role.');
            }
        } finally {
            setEditId(null);
        }
    };

    const handleDelete = async (userId, name) => {
        if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
        const res = await authFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            setUsers(prev => prev.filter(u => u._id != userId));
            showMsg('success', `User "${name}" deleted.`);
        } else {
            showMsg('error', data.error || 'Failed to delete user.');
        }
    };

    const isAdmin = currentUser?.role === 'city_admin' || currentUser?.role === 'master_admin' || currentUser?.role === 'admin';
    const assignableRoles = ASSIGNABLE_ROLES[currentUser?.role] || [];

    if (!isAdmin) {
        return (
            <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>🚫</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Admin Access Required</h2>
                <p style={{ color: '#64748b' }}>You need City Admin or Master Admin privileges to access this page.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }} className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <p className="page-eyebrow">Administration</p>
                    <h1 className="page-title">User Management</h1>
                    <p className="page-subtitle">Create, manage and assign roles to your team members.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <a href="/zones" style={{
                        padding: '8px 16px', borderRadius: 8, border: '1px solid #d8b4fe',
                        background: '#faf5ff', color: '#7e22ce', fontWeight: 700, fontSize: 13,
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>🗺️ Manage Zones</a>
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
                                    <input className="input" placeholder="e.g. Raj Patel" value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Email Address</label>
                                    <input className="input" type="email" placeholder="e.g. raj@amc.gov.in" value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Password</label>
                                    <input className="input" type="password" placeholder="Minimum 8 characters" value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Role</label>
                                    <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, authority_zone: '' }))}>
                                        {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                                    </select>
                                </div>
                                {form.role === 'zone_officer' && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                            📍 Assign Zone <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select className="input" value={form.authority_zone}
                                            onChange={e => setForm(f => ({ ...f, authority_zone: e.target.value }))} required>
                                            <option value="">— Select a Zone —</option>
                                            {zones.map(z => <option key={z._id} value={z._id}>{z.name} ({z.code})</option>)}
                                        </select>
                                        {zones.length === 0 && (
                                            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                                                No zones created yet. <a href="/zones" style={{ color: '#7e22ce' }}>Create zones first →</a>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                                {submitting ? 'Creating...' : '✓ Create User'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { icon: '👥', label: 'Total Users', value: users.length, color: '#2563eb' },
                    { icon: '👑', label: 'Master Admins', value: users.filter(u => u.role === 'master_admin').length, color: '#7e22ce' },
                    { icon: '🏛️', label: 'City Admins', value: users.filter(u => u.role === 'city_admin').length, color: '#1d4ed8' },
                    { icon: '🗺️', label: 'Zone Officers', value: users.filter(u => u.role === 'zone_officer').length, color: '#15803d' },
                    { icon: '🔧', label: 'Contractors', value: users.filter(u => u.role === 'contractor').length, color: '#c2410c' },
                ].map(({ icon, label, value, color }) => (
                    <div key={label} className="stat-card">
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                        <div className="stat-value" style={{ color, fontSize: 22 }}>{value}</div>
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
                                    <th>Zone</th>
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
                                                    fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0,
                                                }}>
                                                    {user.name?.slice(0, 2).toUpperCase() || '??'}
                                                </div>
                                                {user.name}
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{user.email}</td>
                                        <td>
                                            {editId === user._id ? (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                                                        value={editRole} onChange={e => { setEditRole(e.target.value); setEditZone(''); }}>
                                                        {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                                                    </select>
                                                    {editRole === 'zone_officer' && (
                                                        <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                                                            value={editZone} onChange={e => setEditZone(e.target.value)}>
                                                            <option value="">— Zone —</option>
                                                            {zones.map(z => <option key={z._id} value={z._id}>{z.name} ({z.code})</option>)}
                                                        </select>
                                                    )}
                                                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }}
                                                        onClick={() => handleRoleChange(user._id)}>✓</button>
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}
                                                        onClick={() => setEditId(null)}>✕</button>
                                                </div>
                                            ) : (
                                                <RoleBadge role={user.role} />
                                            )}
                                        </td>
                                        <td><ZoneBadge zone={user.authority_zone} /></td>
                                        <td style={{ color: '#64748b', fontSize: 12 }}>
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {assignableRoles.includes(user.role) && (
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}
                                                        onClick={() => { setEditId(user._id); setEditRole(user.role); setEditZone(user.authority_zone?.id || ''); }}
                                                        title="Change Role">✏️ Role
                                                    </button>
                                                )}
                                                {currentUser?.id !== user._id?.toString() && (
                                                    <button onClick={() => handleDelete(user._id, user.name)}
                                                        style={{
                                                            padding: '4px 10px', fontSize: 11, borderRadius: 6, border: 'none',
                                                            background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 700,
                                                        }} title="Delete User">🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
