'use client';

import React, { useEffect, useState } from 'react';

// --- Icon components (inline SVG for guaranteed render) ---
const IconStack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);
const IconTriangle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4M12 17h.01"/>
  </svg>
);
const IconCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <path d="m9 11 3 3L22 4"/>
  </svg>
);
const IconWave = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconActivity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

export default function Dashboard() {
  const [stats, setStats] = useState({ totalClusters: 0, critical: 0, repaired: 0, recentUploads: 0 });
  const [clusters, setClusters] = useState([]);

  useEffect(() => {
    fetch('/api/v1/debug')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStats(prev => ({
            ...prev,
            totalClusters: data.counts?.clusters || 0,
            recentUploads: data.counts?.uploads || 0,
          }));
        }
      }).catch(() => {});

    fetch('/api/v1/analytics/priority-ranking?limit=3')
      .then(r => r.json())
      .then(data => { if (data.ranking) setClusters(data.ranking); })
      .catch(() => {});
  }, []);

  const barStyles = [100, 80, 100, 65];
  const barColors = ['#22c55e', '#2563eb', '#22c55e', '#f97316'];
  const healthItems = [
    { label: 'AI Detection Engine', status: 'ONLINE',  color: '#16a34a', idx: 0 },
    { label: 'Satellite GEE Feed',   status: 'ACTIVE',  color: '#2563eb', idx: 1 },
    { label: 'Database Sync',         status: 'SYNCED',  color: '#16a34a', idx: 2 },
    { label: 'Storage Pool',          status: '65% USED',color: '#f97316', idx: 3 },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 1280, margin: '0 auto' }}>

      {/* ---- Page Header ---- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Dashboard Overview
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
            Infrastructure Control Centre
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
            Real-time monitoring of road damage clusters across active surveillance zones.
          </p>
        </div>
        <a href="/map" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#2563eb',
          color: 'white',
          borderRadius: 8,
          padding: '10px 18px',
          fontWeight: 700,
          fontSize: 13,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          marginTop: 4,
          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
        }}>
          Open Live Map <IconArrow />
        </a>
      </div>

      {/* ---- Stat Cards ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon={<IconStack />}     iconBg="#eff6ff" label="Active Clusters"    sub="Total anomalies detected"    value={stats.totalClusters} />
        <StatCard icon={<IconTriangle />}  iconBg="#fef2f2" label="Critical Risk"       sub="Require immediate action"    value={stats.critical} />
        <StatCard icon={<IconCheck />}     iconBg="#f0fdf4" label="Repairs Completed"  sub="This month"                  value={stats.repaired} />
        <StatCard icon={<IconWave />}      iconBg="#f0f9ff" label="Videos Processed"   sub="AI engine active"            value={stats.recentUploads} />
      </div>

      {/* ---- Bottom Grid ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* Priority Work Orders */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Priority Work Orders</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>High-risk clusters requiring immediate dispatch</p>
            </div>
            <a href="/map" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: '1px solid #e2e8f0', borderRadius: 7,
              padding: '6px 14px',
              fontSize: 12, fontWeight: 600, color: '#2563eb',
              textDecoration: 'none',
              background: '#fff',
            }}>
              View on Map <span style={{ fontSize: 14 }}>→</span>
            </a>
          </div>

          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.9fr 0.7fr', borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 4 }}>
            {['LOCATION', 'DAMAGE TYPE', 'RISK SCORE', 'STATUS', 'ACTION'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {clusters.length > 0 ? clusters.map((c, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.9fr 0.7fr',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: i < clusters.length - 1 ? '1px solid #f8fafc' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                <IconPin />
                {c.location.coordinates[1].toFixed(4)}, {c.location.coordinates[0].toFixed(4)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {c.damage_types ? Object.keys(c.damage_types).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : 'Multiple'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 5, background: '#fee2e2', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(c.risk_score, 100)}%`, background: '#ef4444', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', minWidth: 24 }}>{Math.round(c.risk_score)}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, padding: '3px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {c.risk_level || 'Critical'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>
                <IconEye /> Inspect
              </div>
            </div>
          )) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No active high-risk clusters detected.
            </div>
          )}
        </div>

        {/* Right Column: System Health + Monthly Snapshot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* System Health */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <IconActivity />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>System Health</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {healthItems.map((item, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: item.color, letterSpacing: '0.07em' }}>{item.status}</span>
                  </div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barStyles[item.idx]}%`, background: barColors[item.idx], borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Snapshot */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <IconActivity />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Monthly Snapshot</h3>
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Aggregate Trend (Feb – Mar)
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
              {[35, 55, 40, 70, 45, 80, 60, 50, 75, 65, 40, 55].map((h, i) => (
                <div key={i} style={{ flex: 1, background: '#eff6ff', borderRadius: '2px 2px 0 0', position: 'relative', height: '100%' }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${h}%`,
                    background: '#2563eb',
                    borderRadius: '2px 2px 0 0',
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Week 1</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Today</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, label, sub, value }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Icon */}
      <div style={{
        width: 42, height: 42,
        background: iconBg,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        {icon}
      </div>
      {/* Number */}
      <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {/* Label */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 3 }}>{label}</div>
      {/* Subtitle */}
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{sub}</div>
    </div>
  );
}
