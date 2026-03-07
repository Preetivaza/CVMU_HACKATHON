'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, LayerGroup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const RISK_COLORS = {
  Critical: { stroke: '#ef4444', fill: '#ef4444', text: '#dc2626', bg: '#fee2e2', glow: '0 0 16px rgba(239,68,68,0.8)' },
  Medium: { stroke: '#eab308', fill: '#eab308', text: '#ca8a04', bg: '#fefce8', glow: '0 0 10px rgba(234,179,8,0.6)' },
  Low: { stroke: '#22c55e', fill: '#22c55e', text: '#16a34a', bg: '#f0fdf4', glow: '0 0 10px rgba(34,197,94,0.5)' },
};

const DAMAGE_COLORS = {
  pothole: '#ef4444',
  crack: '#f97316',
  patch: '#3b82f6',
  depression: '#a855f7',
  other: '#6b7280',
};

function createDamageIcon(damageType) {
  const color = DAMAGE_COLORS[damageType] || DAMAGE_COLORS.other;
  const html = `
    <div style="width:12px;height:12px;border-radius:50%;background:${color};
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
  `;
  return L.divIcon({ html, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
}

// Quick approx distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildColoredSegments(routePoints, origDetections) {
  const segments = [];
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    let maxSeverity = 0;

    for (const d of origDetections) {
      const dLat = d.geometry.coordinates[1];
      const dLon = d.geometry.coordinates[0];
      const dist1 = getDistanceMeters(p1[0], p1[1], dLat, dLon);
      const dist2 = getDistanceMeters(p2[0], p2[1], dLat, dLon);
      const minDist = Math.min(dist1, dist2);

      if (minDist < 30) { // within 30 meters
        const dmgType = d.properties?.damage_type;
        const score = (dmgType === 'pothole' || dmgType === 'depression') ? 3
          : (dmgType === 'crack') ? 2 : 1;
        if (score > maxSeverity) maxSeverity = score;
      }
    }

    let color = '#22c55e'; // Green (Safe)
    if (maxSeverity === 3) color = '#ef4444'; // Red (Severe)
    else if (maxSeverity === 2) color = '#f59e0b'; // Amber (Medium)
    else if (maxSeverity === 1) color = '#eab308'; // Yellow (Minor)

    segments.push({ positions: [p1, p2], color, weight: maxSeverity > 0 ? 6 : 4 });
  }

  // Merge adjacent segments of the same color for better performance
  const merged = [];
  if (segments.length > 0) {
    let current = segments[0];
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].color === current.color) {
        current.positions.push(segments[i].positions[1]); // Append point
      } else {
        merged.push(current);
        current = segments[i];
      }
    }
    merged.push(current);
  }
  return merged;
}

const TILE_LAYERS = {
  satellite: {
    label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  road: {
    label: '🗺 Road Map',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  dark: {
    label: '🌑 Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
};

function createPulsingIcon(level) {
  const c = RISK_COLORS[level] || RISK_COLORS.Low;
  const size = level === 'Critical' ? 22 : 15;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${c.fill};opacity:0.3;
        animation:rddPulse 2s ease-out infinite;transform-origin:center;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:${c.fill};opacity:0.15;
        animation:rddPulse 2s ease-out infinite 0.5s;transform-origin:center;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:${size * 0.58}px;height:${size * 0.58}px;border-radius:50%;
        background:${c.fill};box-shadow:${c.glow};border:2.5px solid rgba(255,255,255,0.9);"></div>
    </div>
    <style>
      @keyframes rddPulse {
        0%   { transform:scale(1);   opacity:0.3; }
        70%  { transform:scale(3.8); opacity:0; }
        100% { transform:scale(1);   opacity:0; }
      }
    </style>
  `;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function HeatmapLayer({ clusters }) {
  return (
    <LayerGroup>
      {clusters.map((c, i) => {
        const level = c.properties?.risk_level || 'Low';
        const col = RISK_COLORS[level] || RISK_COLORS.Low;
        const score = c.properties?.final_risk_score || 0.3;
        return (
          <Circle key={`heat-${i}`}
            center={[c.geometry.coordinates[1], c.geometry.coordinates[0]]}
            radius={80 + score * 200}
            pathOptions={{ color: 'transparent', fillColor: col.fill, fillOpacity: 0.15, weight: 0 }}
          />
        );
      })}
    </LayerGroup>
  );
}

function MapResizer() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100); }, [map]);
  return null;
}

function FlyToSelected({ cluster }) {
  const map = useMap();
  useEffect(() => {
    if (!cluster) return;
    const coords = cluster.geometry?.coordinates;
    if (coords) {
      setTimeout(() => map.flyTo([coords[1], coords[0]], 17, { animate: true, duration: 1.2 }), 200);
    }
  }, [cluster, map]);
  return null;
}

export default function MapComponent({ clusters = [], detections = [], onClusterClick, showHeatmap = false, selectedId = null }) {
  const [tileMode, setTileMode] = useState('satellite');
  const [routeLines, setRouteLines] = useState({});
  const tile = TILE_LAYERS[tileMode];

  // Group detections and fetch snapped road paths via OSRM
  useEffect(() => {
    const groups = {};
    detections.forEach(d => {
      if (!d.geometry?.coordinates) return;
      const vid = d.properties?.video_id || 'unknown';
      if (!groups[vid]) groups[vid] = [];
      groups[vid].push(d);
    });

    Object.entries(groups).forEach(async ([vid, points]) => {
      // Sort by timestamp
      points.sort((a, b) => new Date(a.properties?.timestamp || 0) - new Date(b.properties?.timestamp || 0));

      // Extract [lon, lat] for OSRM
      let coords = points.map(p => [p.geometry.coordinates[0], p.geometry.coordinates[1]]);
      if (coords.length < 2) return;

      // Downsample to max 90 points to avoid OSRM URL length / coordinate limits
      if (coords.length > 90) {
        const step = (coords.length - 1) / 89;
        coords = Array.from({ length: 90 }, (_, i) => coords[Math.floor(i * step)]);
      }

      const coordsStr = coords.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';');

      try {
        const res = await fetch(`https://router.project-osrm.org/match/v1/driving/${coordsStr}?geometries=geojson&overview=full`);
        if (!res.ok) throw new Error('OSRM match failed');
        const data = await res.json();

        if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
          // Extract snapped [lat, lon] coordinates and build colored segments
          const snapped = data.matchings.flatMap(m => m.geometry.coordinates.map(c => [c[1], c[0]]));
          const coloredSegments = buildColoredSegments(snapped, points);
          setRouteLines(prev => ({ ...prev, [vid]: coloredSegments }));
        } else {
          // Fallback to straight lines if match fails
          const rawLine = coords.map(c => [c[1], c[0]]);
          setRouteLines(prev => ({ ...prev, [vid]: buildColoredSegments(rawLine, points) }));
        }
      } catch (e) {
        console.warn('Failed to snap route for', vid, e);
        const rawLine = coords.map(c => [c[1], c[0]]);
        setRouteLines(prev => ({ ...prev, [vid]: buildColoredSegments(rawLine, points) }));
      }
    });
  }, [detections]);

  // Center on first available data point
  const allPoints = [...clusters, ...detections].filter(d => d.geometry?.coordinates);
  const center = allPoints.length > 0
    ? [allPoints[0].geometry.coordinates[1], allPoints[0].geometry.coordinates[0]]
    : [23.0225, 72.5714]; // Ahmedabad default

  const formatScore = (s) => s != null ? `${Math.round(Number(s) * 100)}%` : '—';

  // The cluster to auto-fly to when navigated via Inspect button
  const highlightedCluster = selectedId
    ? clusters.find(c => (c.properties?._id === selectedId) || (c._id === selectedId))
    : null;

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      {/* Tile layer toggle */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', gap: 4, background: 'rgba(15,23,42,0.88)',
        backdropFilter: 'blur(8px)', borderRadius: 8, padding: '5px 7px',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        {Object.entries(TILE_LAYERS).map(([key, t]) => (
          <button key={key} onClick={() => setTileMode(key)} style={{
            padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: tileMode === key ? '#2563eb' : 'transparent',
            color: tileMode === key ? 'white' : '#94a3b8',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      <MapContainer center={center} zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer key={tileMode} attribution={tile.attribution} url={tile.url} maxZoom={tile.maxZoom} />

        {showHeatmap && <HeatmapLayer clusters={clusters} />}
        <FlyToSelected cluster={highlightedCluster} />

        {/* 1. Render Raw Unclustered Detections (e.g. from public uploads) */}
        {detections.map((det, i) => {
          if (!det.geometry?.coordinates) return null;
          // Only render isolated points (or all points if preferred, but public reports have processed=false)
          // To prevent double-rendering, we only show points that aren't in a cluster yet,
          // or we just show them distinctively.
          if (det.cluster_id || det.processed) return null;

          const coords = [det.geometry.coordinates[1], det.geometry.coordinates[0]];
          const p = det.properties || {};
          const damageType = p.damage_type || (p.classes && p.classes[0]) || 'other';
          const conf = p.confidence || (p.scores && p.scores[0]) || 0;

          return (
            <Marker key={det._id || `det-${i}`} position={coords} icon={createDamageIcon(damageType)}>
              <Popup maxWidth={220}>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, minWidth: 180 }}>
                  <div style={{
                    background: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8,
                    display: 'inline-block'
                  }}>
                    Single Report
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', textTransform: 'capitalize', marginBottom: 6 }}>
                    {damageType}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    <span>Confidence:</span>
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{Math.round(conf * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    <span>Source:</span>
                    <span style={{ fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>
                      {p.source ? p.source.replace('_', ' ') : 'Upload'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                    Awaiting verification & clustering
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 2. Render Verified Clusters */}
        {clusters.map((cluster, i) => {
          const level = cluster.properties?.risk_level || 'Low';
          const col = RISK_COLORS[level] || RISK_COLORS.Low;
          const coords = [cluster.geometry.coordinates[1], cluster.geometry.coordinates[0]];
          const p = cluster.properties || {};
          const damageTypes = Object.keys(p.damage_types || {}).join(', ') || p.damage_type || 'Unknown';
          const score = formatScore(p.final_risk_score);
          const repeatCount = p.repeat_count || 1;
          const status = (p.status || 'pending').replace(/_/g, ' ');
          const isHighlighted = selectedId && (
            (p._id === selectedId) || (cluster._id === selectedId)
          );

          return (
            <React.Fragment key={cluster._id || `cl-${i}`}>
              {isHighlighted && (
                <Circle center={coords} radius={60}
                  pathOptions={{
                    color: '#facc15', fillColor: '#facc15',
                    fillOpacity: 0.12, weight: 5,
                    dashArray: '8 4',
                    opacity: 0.9,
                  }}
                />
              )}
              <Circle center={coords} radius={p.radius_meters || 15}
                pathOptions={{
                  color: col.stroke, fillColor: col.fill,
                  fillOpacity: showHeatmap ? 0 : 0.2, weight: 2,
                  dashArray: level === 'Low' ? '5 5' : undefined,
                }}
              />
              <Marker position={coords} icon={createPulsingIcon(level)}
                eventHandlers={{ click: () => onClusterClick && onClusterClick(cluster) }}>
                <Popup maxWidth={270}>
                  <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: 240 }}>
                    {/* Header badge + score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: col.bg, color: col.text, padding: '3px 8px', borderRadius: 4
                      }}>{level} RISK</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: col.text }}>{score}</span>
                    </div>
                    {/* Damage type */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, textTransform: 'capitalize' }}>{damageTypes}</div>
                    {/* Detail rows */}
                    {[
                      ['🔁 Repeat', `${repeatCount}×`, repeatCount > 2 ? '#dc2626' : '#334155'],
                      ['📋 Status', status, '#2563eb'],
                      ['📍 GPS', `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`, '#64748b'],
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</span>
                        <span style={{
                          fontSize: 11, color, fontWeight: 700, textTransform: 'capitalize',
                          fontFamily: label === '📍 GPS' ? 'monospace' : 'inherit'
                        }}>{value}</span>
                      </div>
                    ))}
                    {p.satellite_analysis?.surface_quality && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>🛰 Surface</span>
                        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textTransform: 'capitalize' }}>{p.satellite_analysis.surface_quality}</span>
                      </div>
                    )}
                    <button style={{
                      width: '100%', marginTop: 10, padding: '8px 12px',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: 'white', border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                    }} onClick={() => onClusterClick && onClusterClick(cluster)}>
                      📋 View Full Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Video Route Lines (Snapped and Colored by Damage) */}
        {Object.entries(routeLines).map(([vid, segments]) => (
          <LayerGroup key={`group-${vid}`}>
            {segments.map((seg, idx) => (
              <Polyline
                key={`route-${vid}-${idx}`}
                positions={seg.positions}
                pathOptions={{
                  color: seg.color,
                  weight: seg.weight,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 700 }}>
                    🛣 Drive Route<br />
                    <span style={{ color: '#64748b', fontSize: 10, fontWeight: 500 }}>ID: {vid}</span>
                  </div>
                </Popup>
              </Polyline>
            ))}
          </LayerGroup>
        ))}

        <MapResizer />
      </MapContainer>

      {/* Risk legend */}
      <div style={{
        position: 'absolute', bottom: 24, right: 12, zIndex: 1000,
        background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)',
        borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Risk Level</div>
        {Object.entries(RISK_COLORS).map(([level, c]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, boxShadow: c.glow }} />
            <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{level}</span>
          </div>
        ))}
      </div>

      <style>{`
        .leaflet-popup-content-wrapper { border-radius: 10px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important; }
        .leaflet-popup-content { margin: 14px 16px !important; }
      `}</style>
    </div>
  );
}
