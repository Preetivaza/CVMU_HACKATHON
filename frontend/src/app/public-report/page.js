'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Camera, MapPin, UploadCloud, CheckCircle2, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';

export default function PublicReport() {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [location, setLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locError, setLocError] = useState('');

    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [previewBase64, setPreviewBase64] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);

    // Auto-fetch location on load if permission granted before
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'granted') {
                    getLocation();
                }
            });
        }
    }, []);

    const getLocation = () => {
        setLocating(true);
        setLocError('');
        if (!navigator.geolocation) {
            setLocError('Geolocation is not supported by your browser.');
            setLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                setLocating(false);
            },
            (err) => {
                setLocError('Location access denied. Please allow location to report damages.');
                setLocating(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            // Reset previous analysis
            setAnalysisResult(null);
            setPreviewBase64(null);
            setError('');
            setSubmitted(false);

            // Auto-analyze once file is selected
            analyzeImage(selectedFile);
        }
    };

    const analyzeImage = async (imgFile) => {
        setAnalyzing(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', imgFile);

            // We call the fastAPI public endpoint directly. 
            // The Next.js default local backend proxy might not support FormData easily
            const fastApiUrl = 'http://localhost:8000';

            const res = await fetch(`${fastApiUrl}/api/v1/public/infer-image`, {
                method: 'POST',
                body: formData,
                // Omit Content-Type header so browser sets it to 'multipart/form-data' with boundaries
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Analysis failed. Please try again.');
            }

            const data = await res.json();
            setAnalysisResult(data.detections || []);
            setPreviewBase64(data.preview_base64);

        } catch (err) {
            setError(err.message || 'Error communicating with AI engine.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = async () => {
        if (!location) {
            setError('Location is required to submit a report.');
            return;
        }
        if (!analysisResult) {
            setError('Please wait for AI analysis to complete before submitting.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const fastApiUrl = 'http://localhost:8000';
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                detections: analysisResult
            };

            const res = await fetch(`${fastApiUrl}/api/v1/public/submit-detection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to submit report.');
            }

            setSubmitted(true);

            // Clear form after 3 seconds
            setTimeout(() => {
                setFile(null);
                setPreviewUrl(null);
                setAnalysisResult(null);
                setPreviewBase64(null);
                setSubmitted(false);
                // keep location for next report
            }, 5000);

        } catch (err) {
            setError(err.message || 'Submission failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f4f7fb', paddingBottom: 40, fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{
                background: '#ffffff',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                position: 'sticky', top: 0, zIndex: 10
            }}>
                <Link href="/landing" style={{ color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', textDecoration: 'none', transition: 'background 0.2s' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>Report Road Damage</h1>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontWeight: 500 }}>Citizen Reporting Portal</p>
                </div>
            </header>

            <main style={{ maxWidth: 500, margin: '24px auto', padding: '0 20px' }}>

                {!submitted ? (
                    <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>

                        {/* Step 1: Location */}
                        <div style={{ marginBottom: 32 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>1</div>
                                Incident Location
                            </h2>

                            {!location ? (
                                <button
                                    onClick={getLocation}
                                    disabled={locating}
                                    style={{
                                        width: '100%', padding: '16px', borderRadius: 14, border: '2px dashed #cbd5e1',
                                        background: '#f8fafc', color: '#475569', fontSize: 15, fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                                >
                                    {locating ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
                                    {locating ? 'Acquiring GPS Signal...' : 'Get Current Location'}
                                </button>
                            ) : (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Location Acquired</div>
                                        <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
                                    </div>
                                    <button onClick={getLocation} style={{ background: 'none', border: 'none', color: '#15803d', fontWeight: 600, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Update</button>
                                </div>
                            )}
                            {locError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {locError}</div>}
                        </div>

                        {/* Step 2: Photo Capture */}
                        <div style={{ marginBottom: 32 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>2</div>
                                Capture Damage
                            </h2>

                            {!file ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        width: '100%', height: 200, borderRadius: 16, border: '2px dashed #94a3b8',
                                        background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', gap: 12, color: '#475569',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                                >
                                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Camera size={28} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'inherit' }}>Tap to capture or upload</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Ensure the damage is clearly visible</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#000', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                                    <img src={previewBase64 || previewUrl} alt="Preview" style={{ width: '100%', display: 'block', opacity: analyzing ? 0.4 : 1, transition: 'opacity 0.3s' }} />

                                    {analyzing && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                            <Loader2 size={36} className="animate-spin" style={{ marginBottom: 12 }} />
                                            <div style={{ fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.5)', letterSpacing: '0.02em' }}>AI Analyzing Image...</div>
                                        </div>
                                    )}

                                    {!analyzing && (
                                        <button
                                            onClick={() => setFile(null)}
                                            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <Camera size={14} /> Retake
                                        </button>
                                    )}
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Analysis Results */}
                        <div style={{
                            overflow: 'hidden', transition: 'all 0.3s ease',
                            maxHeight: (analysisResult && !analyzing) ? '300px' : '0px',
                            opacity: (analysisResult && !analyzing) ? 1 : 0,
                            marginBottom: (analysisResult && !analyzing) ? 24 : 0
                        }}>
                            <div style={{ padding: '16px 20px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14 }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <AlertTriangle size={14} /> AI Detection Results
                                </h3>
                                {analysisResult && analysisResult.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {analysisResult.map((det, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px 14px', borderRadius: 10, border: '1px solid #e0f2fe' }}>
                                                <span style={{ textTransform: 'capitalize', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{det.class_name}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 40, height: 6, background: '#e0f2fe', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${det.confidence * 100}%`, background: '#0284c7', borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ color: '#0284c7', fontWeight: 800, fontSize: 13 }}>{(det.confidence * 100).toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                                            Detections will be verified and mapped by our GIS system to remove duplicates.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: '#334155', background: 'white', padding: '12px 14px', borderRadius: 10 }}>
                                        No structural road damage detected with high confidence. You can still submit this report manually.
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && <div style={{ marginBottom: 24, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 10, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>{error}</div>}

                        {/* Step 3: Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!file || !location || analyzing || submitting}
                            style={{
                                width: '100%', padding: '18px', borderRadius: 16, border: 'none',
                                cursor: (!file || !location || analyzing || submitting) ? 'not-allowed' : 'pointer',
                                background: (!file || !location || analyzing || submitting) ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                                color: (!file || !location || analyzing || submitting) ? '#94a3b8' : 'white',
                                fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                transition: 'all 0.2s',
                                boxShadow: (!file || !location || analyzing || submitting) ? 'none' : '0 8px 20px rgba(37,99,235,0.25)',
                                transform: submitting ? 'scale(0.98)' : 'scale(1)'
                            }}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                            {submitting ? 'Authenticating & Submitting...' : 'Submit Damage Report'}
                        </button>
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <AlertTriangle size={12} /> Do not report while driving. Safety first.
                        </div>

                    </div>
                ) : (
                    <div style={{ background: 'white', borderRadius: 24, padding: '48px 32px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 16px rgba(22,163,74,0.1)' }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>Report Submitted!</h2>
                        <p style={{ fontSize: 15, color: '#64748b', marginBottom: 32, lineHeight: 1.6 }}>
                            Thank you for helping improve road safety. Your report has been logged and assigned to the relevant municipal authority.
                        </p>
                        <button
                            onClick={() => {
                                setSubmitted(false);
                                setFile(null);
                                setPreviewBase64(null);
                                setAnalysisResult(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{
                                width: '100%', padding: '16px', borderRadius: 14,
                                background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0',
                                fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                        >
                            Report Another Issue
                        </button>
                    </div>
                )}
            </main>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
}
