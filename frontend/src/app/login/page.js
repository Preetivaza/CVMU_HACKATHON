'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('rdd_token');
        if (token) router.push('/');
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid credentials. Please try again.');
            localStorage.setItem('rdd_token', data.token);
            localStorage.setItem('rdd_user', JSON.stringify(data.user));
            window.location.href = '/';
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Left — Branding Panel */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '64px 72px',
                background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Decorative blobs */}
                <div style={{
                    position: 'absolute', width: 500, height: 500,
                    background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
                    top: -100, left: -100, borderRadius: '50%', pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', width: 400, height: 400,
                    background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
                    bottom: -80, right: -80, borderRadius: '50%', pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
                        <div style={{
                            width: 44, height: 44,
                            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                            borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22, boxShadow: '0 8px 20px rgba(37,99,235,0.4)',
                        }}>🛡️</div>
                        <span style={{ fontWeight: 800, fontSize: 20, color: 'white', letterSpacing: '-0.01em' }}>
                            SadakSurksha
                        </span>
                    </div>

                    <h1 style={{
                        fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em',
                        lineHeight: 1.08, marginBottom: 20,
                        background: 'linear-gradient(180deg, #ffffff, rgba(148,163,184,0.7))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Safer Roads,<br />Smarter Cities.
                    </h1>
                    <p style={{ color: 'rgba(148,163,184,0.75)', fontSize: 16, lineHeight: 1.65, maxWidth: 420, marginBottom: 52 }}>
                        AI-powered road damage detection and infrastructure risk management for municipal authorities across India.
                    </p>

                    {/* Social proof / features */}
                    {[
                        { icon: '🤖', text: 'Automated AI damage detection from dashcam footage' },
                        { icon: '🗺️', text: 'Live risk maps with DBSCAN cluster analysis' },
                        { icon: '📊', text: 'Priority rankings and repair dispatch management' },
                    ].map(({ icon, text }, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 9,
                                background: 'rgba(37,99,235,0.15)',
                                border: '1px solid rgba(37,99,235,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 17, flexShrink: 0,
                            }}>{icon}</div>
                            <span style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14 }}>{text}</span>
                        </div>
                    ))}
                </div>

                {/* Bottom link */}
                <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 48 }}>
                    <Link href="/landing" style={{
                        color: 'rgba(96,165,250,0.8)', fontSize: 13, textDecoration: 'none', fontWeight: 500,
                    }}>
                        ← Back to overview
                    </Link>
                </div>
            </div>

            {/* Right — Login Form */}
            <div style={{
                width: 500, flexShrink: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '64px 56px',
                background: '#ffffff',
            }}>
                <div style={{ marginBottom: 36 }}>
                    <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>
                        Sign in to your account
                    </h2>
                    <p style={{ fontSize: 14, color: '#64748b' }}>
                        Authorized personnel only — use your registered credentials.
                    </p>
                </div>

                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: '#fef2f2', border: '1px solid #fca5a5',
                        borderRadius: 8, padding: '12px 14px', marginBottom: 20,
                    }}>
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                            Email address
                        </label>
                        <div style={{ position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                color: '#94a3b8', fontSize: 16, pointerEvents: 'none',
                            }}>✉️</span>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="you@domain.gov.in"
                                style={{
                                    width: '100%', padding: '11px 14px 11px 38px',
                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                    borderRadius: 8, fontSize: 14, outline: 'none',
                                    transition: 'border-color 0.15s, box-shadow 0.15s', color: '#0f172a',
                                }}
                                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                            />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Password</label>
                            <span style={{ fontSize: 12, color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>Forgot password?</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                color: '#94a3b8', pointerEvents: 'none',
                            }}>🔒</span>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{
                                    width: '100%', padding: '11px 14px 11px 38px',
                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                    borderRadius: 8, fontSize: 14, outline: 'none',
                                    transition: 'border-color 0.15s, box-shadow 0.15s', color: '#0f172a',
                                }}
                                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" id="remember" style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
                        <label htmlFor="remember" style={{ fontSize: 13, color: '#64748b', cursor: 'pointer', fontWeight: 400, margin: 0 }}>
                            Keep me signed in for 7 days
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: 'white', border: 'none',
                            padding: '13px', borderRadius: 9,
                            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                            transition: 'all 0.15s',
                            marginTop: 4,
                        }}
                        onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8, #1e40af)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                        onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)'; e.currentTarget.style.transform = 'none'; } }}
                    >
                        {loading ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                Signing in...
                            </>
                        ) : 'Sign In to Dashboard →'}
                    </button>
                </form>

                <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                        Access is restricted to registered municipal officers,<br />zone authorities, and verified contractors.
                    </p>
                </div>
            </div>
        </div>
    );
}
