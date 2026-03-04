'use client';

import React, { useEffect, useState } from 'react';

// --- Inline SVG Icons ---
const IconBarChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const IconTriangle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4M12 17h.01"/>
  </svg>
);
const IconTrend = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconGauge = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <path d="m9 11 3 3L22 4"/>
  </svg>
);

function StatCard({ icon, iconBg, value, label }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: 44, height: 44, background: iconBg, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>{label}</div>
    </div>
  );
}

function getLevelStyle(level) {
  if (!level) return { bg: '#f1f5f9', color: '#64748b' };
  const l = level.toLowerCase();
  if (l === 'critical') return { bg: '#fee2e2', color: '#dc2626' };
  if (l === 'high')     return { bg: '#fff7ed', color: '#ea580c' };
  if (l === 'medium')   return { bg: '#fefce8', color: '#ca8a04' };
  return { bg: '#f0fdf4', color: '#16a34a' };
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState({ totalReviewed: 0, critical: 0, highRisk: 0, avgScore: 0 });
  const [ranking, setRanking] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch priority ranking
    fetch('/api/v1/analytics/priority-ranking?limit=10')
      .then(r => r.json())
      .then(data => {
        if (data.ranking) {
          const r = data.ranking;
          setRanking(r);
          const criticalCount = r.filter(c => (c.risk_level || '').toLowerCase() === 'critical').length;
          const highCount     = r.filter(c => (c.risk_level || '').toLowerCase() === 'high').length;
          const avgScore      = r.length > 0 ? Math.round(r.reduce((s, c) => s + c.risk_score, 0) / r.length) : 0;
          setStats({ totalReviewed: r.length, critical: criticalCount, highRisk: highCount, avgScore });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch monthly trend
    fetch('/api/v1/analytics/monthly-trend')
      .then(r => r.json())
      .then(data => { if (data.trend) setTrend(data.trend); })
      .catch(() => {});
  }, []);

  const maxTrendVal = trend.length > 0 ? Math.max(...trend.map(t => t.count || 0), 1) : 1;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 1280, margin: '0 auto' }}>

      {/* ---- Page Header ---- */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Analytics &amp; Reporting
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
          Infrastructure Analytics Report
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
          Statistical analysis of road damage patterns and repair efficiency.
        </p>
      </div>

      {/* ---- Stat Cards ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon={<IconBarChart />} iconBg="#eff6ff" value={stats.totalReviewed} label="Total Reviewed" />
        <StatCard icon={<IconTriangle />} iconBg="#fef2f2" value={stats.critical}      label="Critical Alerts" />
        <StatCard icon={<IconTrend />}    iconBg="#fffbeb" value={stats.highRisk}       label="High Risk" />
        <StatCard icon={<IconGauge />}    iconBg="#f0fdf4" value={stats.avgScore}       label="Avg Risk Score" />
      </div>

      {/* ---- Two-Column Layout ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>

        {/* Monthly Detection Trend */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Monthly Detection Trend</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginBottom: 24 }}>
            Total detections per month (last 6 months)
          </p>

          {trend.length > 0 ? (
            <div>
              {/* Bar Chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, marginBottom: 12 }}>
                {trend.map((t, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', marginBottom: 4 }}>{t.count}</div>
                    <div style={{
                      width: '100%',
                      height: `${Math.max((t.count / maxTrendVal) * 120, 4)}px`,
                      background: '#2563eb',
                      borderRadius: '3px 3px 0 0',
                    }} />
                  </div>
                ))}
              </div>
              {/* X-axis labels */}
              <div style={{ display: 'flex', gap: 10 }}>
                {trend.map((t, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                    {t.month || `M${i+1}`}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 160, color: '#94a3b8', fontSize: 13, fontWeight: 500,
              textAlign: 'center',
            }}>
              No monthly data available. Run clustering after uploading videos.
            </div>
          )}
        </div>

        {/* Priority Ranking Table */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Priority Ranking</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginBottom: 20 }}>
            Top risk clusters by score
          </p>

          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1.6fr 0.8fr 0.7fr 0.9fr',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: 10, marginBottom: 6,
          }}>
            {['#', 'COORDS', 'TYPE', 'SCORE', 'LEVEL'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>{h}</div>
            ))}
          </div>

          {/* Table Rows */}
          {ranking.length > 0 ? ranking.slice(0, 8).map((c, i) => {
            const lvl = getLevelStyle(c.risk_level);
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '28px 1.6fr 0.8fr 0.7fr 0.9fr',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < Math.min(ranking.length, 8) - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                {/* Rank Badge */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#eff6ff', color: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                }}>
                  {i + 1}
                </div>

                {/* Coordinates */}
                <div style={{ fontSize: 11.5, color: '#334155', fontWeight: 500, fontFamily: 'monospace' }}>
                  {c.location?.coordinates
                    ? `${c.location.coordinates[1].toFixed(4)}, ${c.location.coordinates[0].toFixed(4)}`
                    : '—'}
                </div>

                {/* Type */}
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                  {c.damage_types ? (Object.keys(c.damage_types).length > 1 ? 'Various' : Object.keys(c.damage_types)[0]) : 'Various'}
                </div>

                {/* Score */}
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  {Math.round(c.risk_score)}
                </div>

                {/* Level Badge */}
                <div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    background: lvl.bg, color: lvl.color,
                    border: `1px solid ${lvl.bg}`,
                    borderRadius: 4, padding: '3px 7px',
                  }}>
                    {c.risk_level || 'Low'}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No cluster data found. Upload survey footage to begin analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
