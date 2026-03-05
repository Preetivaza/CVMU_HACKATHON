'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authFetch } from '@/utils/authFetch';

const RISK_COLORS = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' };
const RISK_BG = { Critical: '#fee2e2', High: '#fff7ed', Medium: '#fefce8', Low: '#f0fdf4' };

function MetricCard({ icon, label, value, sub, color }) {
    return (
        <div className="stat-card">
            <div style={{ width: 44, height: 44, background: color + '20', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{icon}</div>
            <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-sub">{sub}</div>
        </div>
    );
}

export default function ReportsPage() {
    const [clusters, setClusters] = useState([]);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [allRes, trendRes] = await Promise.all([
                authFetch('/api/v1/clusters?limit=500').then(r => r.json()).catch(() => ({})),
                authFetch('/api/v1/analytics/monthly-trend').then(r => r.json()).catch(() => ({})),
            ]);
            setClusters(allRes.features || []);
            setTrend(trendRes.trend || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const total = clusters.length;
    const repairedCount = clusters.filter(c => c.properties?.status === 'repaired').length;
    const inProgressCount = clusters.filter(c => c.properties?.status === 'in_progress').length;
    const pendingCount = clusters.filter(c => !c.properties?.status || c.properties?.status === 'pending').length;
    const criticalCount = clusters.filter(c => (c.properties?.risk_level || '').toLowerCase() === 'critical').length;
    const avgScore = total > 0
        ? Math.round(clusters.reduce((s, c) => s + (c.properties?.final_risk_score || 0), 0) / total * 100)
        : 0;
    const repairRate = total > 0 ? Math.round((repairedCount / total) * 100) : 0;
    const complianceViolations = clusters.filter(c => c.properties?.temporal_status === 'compliance_violation').length;

    // Damage type breakdown
    const damageMap = {};
    clusters.forEach(c => {
        const d = c.properties?.damage_type || 'unknown';
        damageMap[d] = (damageMap[d] || 0) + 1;
    });
    const damageEntries = Object.entries(damageMap).sort((a, b) => b[1] - a[1]);

    // Top 10 priority clusters (sorted by risk score desc)
    const topClusters = [...clusters]
        .sort((a, b) => (b.properties?.final_risk_score || 0) - (a.properties?.final_risk_score || 0))
        .slice(0, 10);

    // Zone-wise
    const zoneMap = {};
    clusters.forEach(c => {
        const coords = c.geometry?.coordinates;
        if (!coords) return;
        const lat = coords[1];
        const zone = lat < 23 ? 'Southern Zone' : lat < 25 ? 'Central Zone' : 'Northern Zone';
        if (!zoneMap[zone]) zoneMap[zone] = { total: 0, repaired: 0, critical: 0 };
        zoneMap[zone].total++;
        if (c.properties?.status === 'repaired') zoneMap[zone].repaired++;
        if ((c.properties?.risk_level || '').toLowerCase() === 'critical') zoneMap[zone].critical++;
    });
    const zoneEntries = Object.entries(zoneMap).sort((a, b) => b[1].total - a[1].total);

    const handleExport = () => {
        window.open('/api/v1/reports/export', '_blank');
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }} className="fade-in">

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <p className="page-eyebrow">Reporting</p>
                    <h1 className="page-title">Infrastructure Report</h1>
                    <p className="page-subtitle">Aggregated repair performance, zone analysis, and risk distribution.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={load} className="btn btn-secondary btn-sm">🔄 Refresh</button>
                    <button onClick={handleExport} className="btn btn-secondary btn-sm">📥 Export CSV</button>
                    <button onClick={() => window.print()} className="btn btn-primary btn-sm">🖨️ Print Report</button>
                </div>
            </div>

            {/* Summary Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
                <MetricCard icon="🗂️" label="Total Clusters" value={total} sub="Detected damage zones" color="#2563eb" />
                <MetricCard icon="✅" label="Repaired" value={`${repairedCount} (${repairRate}%)`} sub="Completed repairs" color="#16a34a" />
                <MetricCard icon="🔧" label="In Progress" value={inProgressCount} sub="Active repair work" color="#ea580c" />
                <MetricCard icon="📊" label="Avg Risk Score" value={`${avgScore}%`} sub="Platform-wide average" color="#7c3aed" />
                <MetricCard icon="⚠️" label="Violations" value={complianceViolations} sub="Contractor compliance" color="#dc2626" />
            </div>

            {/* Middle Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

                {/* Status Breakdown */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">📊 Repair Status</div>
                    </div>
                    <div className="panel-body">
                        {[
                            { label: 'Repaired', count: repairedCount, color: '#22c55e', bg: '#f0fdf4' },
                            { label: 'In Progress', count: inProgressCount, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Pending', count: pendingCount, color: '#f97316', bg: '#fff7ed' },
                            { label: 'Critical Risk', count: criticalCount, color: '#dc2626', bg: '#fee2e2' },
                        ].map(({ label, count, color, bg }) => (
                            <div key={label} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: '2px 8px', borderRadius: 10 }}>{count}</span>
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{total > 0 ? `${Math.round((count / total) * 100)}%` : '0%'}</span>
                                    </div>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Damage Type Breakdown */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">🔍 Damage Type Distribution</div>
                    </div>
                    <div className="panel-body">
                        {damageEntries.length > 0 ? damageEntries.map(([type, count]) => {
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const typeColors = { pothole: '#dc2626', crack: '#ea580c', patch: '#ca8a04', depression: '#7c3aed', unknown: '#64748b' };
                            const col = typeColors[type] || '#64748b';
                            return (
                                <div key={type} style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{type}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{count} ({pct}%)</span>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${pct}%`, background: col }} />
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No data yet.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top 10 Priority Clusters */}
            <div className="panel" style={{ marginBottom: 24 }}>
                <div className="panel-header">
                    <div>
                        <div className="panel-title">🚨 Top 10 Priority Clusters</div>
                        <div className="panel-subtitle">Highest risk damage zones requiring immediate attention</div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                ) : topClusters.length > 0 ? (
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Damage Type</th>
                                    <th>Risk Level</th>
                                    <th>Risk Score</th>
                                    <th>Repeat Count</th>
                                    <th>Status</th>
                                    <th>Coordinates</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topClusters.map((c, i) => {
                                    const p = c.properties || {};
                                    const level = p.risk_level || 'Low';
                                    const [lon, lat] = c.geometry?.coordinates || [0, 0];
                                    const statusColors = { pending: '#f97316', in_progress: '#2563eb', repaired: '#16a34a', compliance_violation: '#dc2626' };
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 800, color: i < 3 ? '#dc2626' : '#64748b' }}>#{i + 1}</td>
                                            <td style={{ fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{p.damage_type || '—'}</td>
                                            <td>
                                                <span style={{ background: RISK_BG[level] || '#f1f5f9', color: RISK_COLORS[level] || '#64748b', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                                                    {level}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 700, color: RISK_COLORS[level] || '#334155' }}>
                                                {Math.round((p.final_risk_score || 0) * 100)}%
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{p.repeat_count || 1}×</td>
                                            <td>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[p.status] || '#64748b', textTransform: 'capitalize' }}>
                                                    {(p.status || 'pending').replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                                                {lat.toFixed(4)}, {lon.toFixed(4)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ padding: '56px', textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>No Cluster Data Yet</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Upload and process survey footage to see priority clusters.</div>
                    </div>
                )}
            </div>

            {/* Zone Summary Table */}
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <div className="panel-title">🗺️ Zone-Wise Summary</div>
                        <div className="panel-subtitle">Cluster distribution segmented by geographic zone</div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading zone data...</div>
                ) : zoneEntries.length > 0 ? (
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Zone</th>
                                    <th>Total Clusters</th>
                                    <th>Repaired</th>
                                    <th>Critical</th>
                                    <th>Repair Rate</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {zoneEntries.map(([zone, stats], i) => {
                                    const zoneRepairRate = stats.total > 0 ? Math.round((stats.repaired / stats.total) * 100) : 0;
                                    const zoneStatus = zoneRepairRate >= 75 ? { label: 'Good', color: '#16a34a', bg: '#f0fdf4' }
                                        : zoneRepairRate >= 40 ? { label: 'Moderate', color: '#ca8a04', bg: '#fefce8' }
                                            : { label: 'Needs Attention', color: '#dc2626', bg: '#fee2e2' };
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 700, color: '#0f172a' }}>📍 {zone}</td>
                                            <td style={{ fontWeight: 700, color: '#334155' }}>{stats.total}</td>
                                            <td style={{ fontWeight: 600, color: '#16a34a' }}>{stats.repaired}</td>
                                            <td style={{ fontWeight: 600, color: '#dc2626' }}>{stats.critical}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 70, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${zoneRepairRate}%`, background: '#22c55e', borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{zoneRepairRate}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: zoneStatus.bg, color: zoneStatus.color }}>
                                                    {zoneStatus.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ padding: '56px', textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>No Zone Data Yet</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Process survey footage to generate zone analysis.</div>
                    </div>
                )}
            </div>
        </div>
    );
}

