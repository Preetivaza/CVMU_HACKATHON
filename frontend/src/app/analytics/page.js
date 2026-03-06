'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

const RISK_COLORS = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' };
const RISK_BG = { Critical: '#fee2e2', High: '#fff7ed', Medium: '#fefce8', Low: '#f0fdf4' };

function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [ranking, setRanking] = useState([]);
  const [trend, setTrend] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('risk_score');
  const [sortDir, setSortDir] = useState('desc');
  const [timeFilter, setTimeFilter] = useState('all');

  const load = useCallback(async (tr = timeFilter) => {
    setLoading(true);
    try {
      const trParam = tr !== 'all' ? `?time_range=${tr}` : '';
      const [rankRes, trendRes] = await Promise.all([
        authFetch(`/api/v1/analytics/priority-ranking?limit=20${tr !== 'all' ? `&time_range=${tr}` : ''}`).then(r => r.json()).catch(() => ({})),
        authFetch(`/api/v1/analytics/monthly-trend${trParam}`).then(r => r.json()).catch(() => ({})),
      ]);

      const r = rankRes.ranking || [];
      setRanking(r);
      const totalScore = r.reduce((s, c) => s + (c.risk_score || 0), 0);
      setStats({
        total: r.length,
        critical: r.filter(c => (c.risk_level || '').toLowerCase() === 'critical').length,
        high: r.filter(c => (c.risk_level || '').toLowerCase() === 'high').length,
        avgScore: r.length > 0 ? Math.round(totalScore / r.length) : 0,
      });
      setTrend(trendRes.trend || []);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(timeFilter); }, [timeFilter]); // eslint-disable-line

  const sorted = [...ranking].sort((a, b) => {
    const dir = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'risk_score') return dir * ((a.risk_score || 0) - (b.risk_score || 0));
    if (sortBy === 'risk_level') return dir * (a.risk_level || '').localeCompare(b.risk_level || '');
    return 0;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const maxTrend = Math.max(...trend.map(t => t.count || 0), 1);

  // Damage type breakdown from ranking
  const damageMap = {};
  ranking.forEach(c => {
    if (c.damage_types) {
      Object.keys(c.damage_types).forEach(t => {
        damageMap[t] = (damageMap[t] || 0) + 1;
      });
    }
  });
  const damageEntries = Object.entries(damageMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxDmg = Math.max(...damageEntries.map(e => e[1]), 1);

  const handleExport = () => {
    const rows = sorted.map((c, i) => ({
      rank: i + 1,
      lat: c.location?.coordinates?.[1]?.toFixed(6) || '',
      lon: c.location?.coordinates?.[0]?.toFixed(6) || '',
      risk_score: Math.round(c.risk_score || 0),
      risk_level: c.risk_level || '',
      damage_types: c.damage_types ? Object.keys(c.damage_types).join(';') : '',
      status: c.status || 'pending',
    }));
    downloadCSV(rows, `sadaksurksha-priority-ranking-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p className="page-eyebrow">Analysis & Reporting</p>
          <h1 className="page-title">Infrastructure Analytics</h1>
          <p className="page-subtitle">Statistical analysis of road damage patterns, risk distribution, and repair performance.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => load(timeFilter)} className="btn btn-secondary btn-sm">🔄 Refresh</button>
            <button onClick={handleExport} className="btn btn-primary btn-sm">⬇ Export CSV</button>
          </div>
          <TimeFilter value={timeFilter} onChange={setTimeFilter} />
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '🗂️', bg: '#eff6ff', label: 'Total Analysed', value: stats.total, sub: 'Clusters in ranking' },
          { icon: '🚨', bg: '#fee2e2', label: 'Critical', value: stats.critical, sub: 'Immediate action' },
          { icon: '⚠️', bg: '#fff7ed', label: 'High Risk', value: stats.high, sub: 'Priority repair' },
          { icon: '📊', bg: '#f0fdf4', label: 'Avg Risk Score', value: stats.avgScore, sub: 'Out of 100' },
        ].map(({ icon, bg, label, value, sub }, i) => (
          <div key={i} className="stat-card">
            <div style={{ width: 44, height: 44, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{icon}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>

        {/* Monthly Trend Chart */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">📈 Monthly Detection Trend</div>
              <div className="panel-subtitle">Total road damage detections per month</div>
            </div>
          </div>
          <div className="panel-body">
            {trend.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, marginBottom: 12 }}>
                  {trend.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5 }}>{t.count || 0}</div>
                      <div
                        style={{
                          width: '100%', borderRadius: '4px 4px 0 0',
                          height: `${Math.max(((t.count || 0) / maxTrend) * 110, 4)}px`,
                          background: i === trend.length - 1
                            ? 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
                            : 'linear-gradient(180deg, #93c5fd, #bfdbfe)',
                          transition: 'height 0.4s ease',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {trend.map((t, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
                      {t.month ? String(t.month).slice(-3) : `M${i + 1}`}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                No monthly data yet. Upload survey footage to begin analysis.
              </div>
            )}
          </div>
        </div>

        {/* Damage Type Breakdown */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">🔍 Damage Type Breakdown</div>
          </div>
          <div className="panel-body">
            {damageEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {damageEntries.map(([type, count], i) => {
                  const pct = Math.round((count / ranking.length) * 100);
                  const colors = ['#2563eb', '#ea580c', '#dc2626', '#7c3aed', '#0284c7'];
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{type}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(count / maxDmg) * 100}%`, background: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                Upload videos to see damage breakdown.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority Table */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">🏆 Priority Ranking Table</div>
            <div className="panel-subtitle">Click column headers to sort | {sorted.length} clusters</div>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: '56px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading data...</div>
        ) : sorted.length > 0 ? (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Coordinates</th>
                  <th>Damage Types</th>
                  <th
                    onClick={() => toggleSort('risk_score')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Risk Score {sortBy === 'risk_score' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => toggleSort('risk_level')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Risk Level {sortBy === 'risk_level' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => {
                  const level = c.risk_level || 'Low';
                  const status = c.status || 'pending';
                  const statusColors = { pending: '#f97316', in_progress: '#2563eb', repaired: '#16a34a' };
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 800, color: '#2563eb' }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: i < 3 ? '#eff6ff' : '#f8fafc',
                          color: i < 3 ? '#2563eb' : '#94a3b8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800,
                        }}>
                          {i + 1}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                          {c.location?.coordinates
                            ? `${c.location.coordinates[1].toFixed(4)}, ${c.location.coordinates[0].toFixed(4)}`
                            : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                          {c.damage_types
                            ? Object.keys(c.damage_types).slice(0, 2).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                            : 'Various'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 56, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(c.risk_score || 0, 100)}%`, background: RISK_COLORS[level] || '#ef4444', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{Math.round(c.risk_score || 0)}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                          background: RISK_BG[level] || '#f1f5f9', color: RISK_COLORS[level] || '#64748b',
                        }}>
                          {level}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                          color: statusColors[status] || '#64748b',
                        }}>
                          ● {status.replace('_', ' ')}
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>No Analytics Data</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Upload and process survey footage to generate analytics.</div>
          </div>
        )}
      </div>
    </div>
  );
}
