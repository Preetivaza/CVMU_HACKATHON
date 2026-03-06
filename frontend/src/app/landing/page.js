'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

function AnimatedCounter({ target, suffix = '' }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [started]);

    useEffect(() => {
        if (!started) return;
        let start = 0;
        const step = Math.ceil(target / 50);
        const id = setInterval(() => {
            start += step;
            if (start >= target) { setCount(target); clearInterval(id); }
            else setCount(start);
        }, 30);
        return () => clearInterval(id);
    }, [started, target]);

    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const features = [
    {
        icon: '🤖',
        title: 'AI-Powered Detection',
        desc: 'Computer vision models analyze dashcam footage to detect potholes, cracks, and road damage with high precision.'
    },
    {
        icon: '🗺️',
        title: 'Real-Time Risk Mapping',
        desc: 'DBSCAN clustering aggregates detections into risk zones displayed on live interactive maps.'
    },
    {
        icon: '🛰️',
        title: 'Satellite Integration',
        desc: 'Google Earth Engine satellite data enriches ground-level detections with aerial perspective.'
    },
    {
        icon: '📊',
        title: 'Data-Driven Reports',
        desc: 'Priority rankings, monthly trends, and zone analysis help authorities allocate repair budgets efficiently.'
    },
    {
        icon: '🔐',
        title: 'Role-Based Access',
        desc: 'City admins, zone officers, state authorities, and contractors each see only their relevant data.'
    },
    {
        icon: '⚡',
        title: 'Automated Pipeline',
        desc: 'Upload footage and let the system handle detection, clustering, risk scoring, and alerting automatically.'
    },
];

const steps = [
    { num: '01', title: 'Upload Survey Footage', desc: 'Field teams upload dashcam video and GPS logs from road survey vehicles.' },
    { num: '02', title: 'AI Analysis & Clustering', desc: 'Our ML engine detects damage, clusters detections into zones, and calculates composite risk scores.' },
    { num: '03', title: 'Prioritize & Dispatch', desc: 'Authorities view the priority ranking, assign contractors, and track repair completion in real time.' },
];

export default function LandingPage() {
    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#0f172a', minHeight: '100vh', color: 'white', overflowX: 'hidden' }}>

            {/* ====== NAVBAR ====== */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 64px', height: 64,
                background: 'rgba(15,23,42,0.95)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34,
                        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                        borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        🛡️
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>SadakSurksha</span>
                </div>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                    {['Features', 'How It Works', 'Contact'].map(item => (
                        <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} style={{
                            color: 'rgba(148,163,184,0.9)', fontSize: 14, fontWeight: 500,
                            textDecoration: 'none', transition: 'color 0.15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.color = 'white'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.9)'}
                        >
                            {item}
                        </a>
                    ))}
                    <Link href="/login" style={{
                        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                        color: 'white', padding: '8px 20px', borderRadius: 8,
                        fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
                        boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                        transition: 'opacity 0.15s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        Access Platform →
                    </Link>
                </div>
            </nav>

            {/* ====== HERO ====== */}
            <section style={{
                padding: '100px 64px 80px',
                background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.25) 0%, transparent 70%)',
                textAlign: 'center',
                position: 'relative',
            }}>
                {/* Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(37,99,235,0.12)',
                        border: '1px solid rgba(37,99,235,0.3)',
                        borderRadius: 100, padding: '6px 16px',
                        fontSize: 12, fontWeight: 700, color: '#93c5fd',
                        letterSpacing: '0.04em',
                    }}>
                        <span style={{ width: 6, height: 6, background: '#60a5fa', borderRadius: '50%', animation: 'pulse-dot 2s ease-in-out infinite', display: 'inline-block' }} />
                        AI-Powered Road Infrastructure Platform
                    </div>
                </div>

                <h1 style={{
                    fontSize: 'clamp(40px, 7vw, 80px)',
                    fontWeight: 900, lineHeight: 1.05,
                    letterSpacing: '-0.04em',
                    marginBottom: 28,
                    background: 'linear-gradient(180deg, #ffffff 40%, rgba(148,163,184,0.7) 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    India's Road Safety<br />Intelligence Platform
                </h1>

                <p style={{
                    fontSize: 'clamp(15px, 2.5vw, 19px)',
                    color: 'rgba(148,163,184,0.85)',
                    maxWidth: 620, margin: '0 auto 44px',
                    lineHeight: 1.65, fontWeight: 400,
                }}>
                    Automatically detect road damage from dashcam footage, cluster hotspots with DBSCAN, and generate actionable repair priorities — all powered by AI.
                </p>

                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/login" style={{
                        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                        color: 'white', padding: '14px 32px', borderRadius: 10,
                        fontSize: 15, fontWeight: 700, textDecoration: 'none',
                        boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(37,99,235,0.5)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.4)'; }}
                    >
                        Open Platform Dashboard →
                    </Link>
                    <Link href="/public-report" style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.85)', padding: '14px 32px', borderRadius: 10,
                        fontSize: 15, fontWeight: 600, textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        transition: 'background 0.15s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        📸 Report a Pothole
                    </Link>
                </div>
            </section>

            {/* ====== STATS BAR ====== */}
            <section style={{
                padding: '0 64px 80px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1,
                borderTop: '1px solid rgba(255,255,255,0.07)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)',
            }}>
                {[
                    { label: 'Roads Monitored', value: 847, suffix: 'km' },
                    { label: 'Damage Clusters', value: 2400, suffix: '+' },
                    { label: 'Videos Processed', value: 180, suffix: '' },
                    { label: 'Avg Risk Score', value: 74, suffix: '/100' },
                ].map(({ label, value, suffix }, i) => (
                    <div key={i} style={{
                        padding: '36px 40px',
                        borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em', color: 'white', lineHeight: 1 }}>
                            <AnimatedCounter target={value} suffix={suffix} />
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', marginTop: 8, fontWeight: 500 }}>{label}</div>
                    </div>
                ))}
            </section>

            {/* ====== FEATURES ====== */}
            <section id="features" style={{ padding: '80px 64px' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
                        Platform Capabilities
                    </div>
                    <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>
                        Everything You Need to<br />Manage Road Safety
                    </h2>
                    <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
                        A complete, integrated platform from detection to dispatch.
                    </p>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 20, maxWidth: 1100, margin: '0 auto',
                }}>
                    {features.map((f, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 14, padding: '28px 28px 26px',
                            transition: 'border-color 0.2s, background 0.2s',
                            cursor: 'default',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.background = 'rgba(37,99,235,0.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        >
                            <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'white' }}>{f.title}</h3>
                            <p style={{ fontSize: 13.5, color: 'rgba(148,163,184,0.75)', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ====== HOW IT WORKS ====== */}
            <section id="how-it-works" style={{
                padding: '80px 64px',
                background: 'rgba(255,255,255,0.02)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
                        How It Works
                    </div>
                    <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                        From Footage to Fix<br />in Three Steps
                    </h2>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 32, maxWidth: 900, margin: '0 auto',
                }}>
                    {steps.map((s, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 64, height: 64,
                                background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(79,70,229,0.2))',
                                border: '1px solid rgba(37,99,235,0.35)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px',
                                fontSize: 24, fontWeight: 900, color: '#60a5fa',
                            }}>
                                {s.num}
                            </div>
                            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                            <p style={{ fontSize: 13.5, color: 'rgba(148,163,184,0.75)', lineHeight: 1.6 }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ====== CTA ====== */}
            <section style={{
                padding: '80px 64px 100px',
                textAlign: 'center',
                background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(37,99,235,0.2) 0%, transparent 70%)',
            }}>
                <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
                    Ready to Transform<br />Road Safety?
                </h2>
                <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 16, marginBottom: 36 }}>
                    Access your dashboard and start monitoring road infrastructure today.
                </p>
                <Link href="/login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                    color: 'white', padding: '15px 36px', borderRadius: 12,
                    fontSize: 16, fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 8px 32px rgba(37,99,235,0.45)',
                }}>
                    Access Platform Dashboard →
                </Link>
            </section>

            {/* ====== FOOTER ====== */}
            <footer style={{
                padding: '28px 64px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 19 }}>🛡️</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>SadakSurksha</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>
                    © 2026 SadakSurksha. Built for safer roads across India.
                </p>
                <Link href="/login" style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', fontWeight: 600, textDecoration: 'none' }}>
                    Admin Login →
                </Link>
            </footer>
        </div>
    );
}
