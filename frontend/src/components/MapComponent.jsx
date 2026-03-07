'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents,
  Circle, LayerGroup, Polyline, Polygon
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Default marker icon fix ─────────────────────────────────────────────────
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const CentroidIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;
    border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.4)"></div>`,
  className: '', iconSize: [18, 18], iconAnchor: [9, 9],
});

// ── Constants ────────────────────────────────────────────────────────────────
const RISK_COLORS = {
  Critical: { stroke: '#ef4444', fill: '#ef4444', text: '#dc2626', bg: '#fee2e2', glow: '0 0 16px rgba(239,68,68,0.8)' },
  High: { stroke: '#ef4444', fill: '#ef4444', text: '#dc2626', bg: '#fee2e2', glow: '0 0 16px rgba(239,68,68,0.8)' },
  Medium: { stroke: '#eab308', fill: '#eab308', text: '#ca8a04', bg: '#fefce8', glow: '0 0 10px rgba(234,179,8,0.6)' },
  Low: { stroke: '#22c55e', fill: '#22c55e', text: '#16a34a', bg: '#f0fdf4', glow: '0 0 10px rgba(34,197,94,0.5)' },
};

const DAMAGE_COLORS = {
  pothole: '#ef4444', crack: '#f97316', patch: '#3b82f6',
  depression: '#a855f7', other: '#6b7280',
};

const TILE_LAYERS = {
  satellite: {
    label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri', maxZoom: 19,
  },
  road: {
    label: '🗺 Road',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO', maxZoom: 20,
  },
  dark: {
    label: '🌑 Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcCentroid(points) {
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lon = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lat, lon];
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildColoredSegments(routePoints, origDetections) {
  const segments = [];
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i], p2 = routePoints[i + 1];
    let maxSeverity = 0;
    for (const d of origDetections) {
      const dLat = d.geometry.coordinates[1], dLon = d.geometry.coordinates[0];
      const minDist = Math.min(getDistanceMeters(p1[0], p1[1], dLat, dLon), getDistanceMeters(p2[0], p2[1], dLat, dLon));
      if (minDist < 30) {
        const dmg = d.properties?.damage_type;
        const score = (dmg === 'pothole' || dmg === 'depression') ? 3 : dmg === 'crack' ? 2 : 1;
        if (score > maxSeverity) maxSeverity = score;
      }
    }
    const color = maxSeverity === 3 ? '#ef4444' : maxSeverity === 2 ? '#f59e0b' : maxSeverity === 1 ? '#eab308' : '#22c55e';
    segments.push({ positions: [p1, p2], color, weight: maxSeverity > 0 ? 6 : 4 });
  }
  const merged = [];
  if (segments.length > 0) {
    let cur = segments[0];
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].color === cur.color) cur.positions.push(segments[i].positions[1]);
      else { merged.push(cur); cur = segments[i]; }
    }
    merged.push(cur);
  }
  return merged;
}

function createPulsingIcon(level) {
  const c = RISK_COLORS[level] || RISK_COLORS.Low;
  const size = (level === 'Critical' || level === 'High') ? 22 : 15;
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${c.fill};opacity:0.3;animation:rddPulse 2s ease-out infinite;transform-origin:center;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:${c.fill};opacity:0.15;animation:rddPulse 2s ease-out infinite 0.5s;transform-origin:center;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size * 0.58}px;height:${size * 0.58}px;border-radius:50%;background:${c.fill};box-shadow:${c.glow};border:2.5px solid rgba(255,255,255,0.9);"></div>
    </div><style>@keyframes rddPulse{0%{transform:scale(1);opacity:0.3}70%{transform:scale(3.8);opacity:0}100%{transform:scale(1);opacity:0}}</style>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

// ── Map children ──────────────────────────────────────────────────────────────
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
    if (!cluster?.geometry?.coordinates) return;
    const [lon, lat] = cluster.geometry.coordinates;
    setTimeout(() => map.flyTo([lat, lon], 17, { animate: true, duration: 1.2 }), 200);
  }, [cluster, map]);
  return null;
}

function FlyToLocation({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], target.zoom || 14, { animate: true, duration: 1.0 });
  }, [target, map]);
  return null;
}

/** Handles both pick-a-point mode and polygon-draw mode */
function MapInteractionHandler({ pickMode, drawMode, onPick, onDrawPoint }) {
  useMapEvents({
    click(e) {
      if (pickMode && onPick) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
      if (drawMode && onDrawPoint) onDrawPoint([e.latlng.lat, e.latlng.lng]);
    },
    dblclick(e) {
      // dblclick is suppressed by leaflet by default — intercepted in DrawPolygonLayer
    },
  });
  return null;
}

/** Live polygon preview while drawing */
function DrawPolygonLayer({ points, mousePos }) {
  const map = useMap();

  // Suppress the default dblclick zoom so user can finish polygon
  useEffect(() => {
    map.doubleClickZoom.disable();
    return () => map.doubleClickZoom.enable();
  }, [map]);

  if (points.length === 0) return null;
  const preview = mousePos ? [...points, mousePos] : points;
  return (
    <>
      {/* Lines */}
      {preview.length >= 2 && (
        <Polyline positions={preview} pathOptions={{ color: '#2563eb', weight: 2.5, dashArray: '6 4', opacity: 0.9 }} />
      )}
      {/* Closing line back to start */}
      {preview.length >= 3 && (
        <Polyline positions={[preview[preview.length - 1], preview[0]]} pathOptions={{ color: '#2563eb', weight: 2, dashArray: '6 4', opacity: 0.5 }} />
      )}
      {/* Fill preview */}
      {preview.length >= 3 && (
        <Polygon positions={preview} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, weight: 0 }} />
      )}
      {/* Vertex dots */}
      {points.map((p, i) => (
        <Circle key={i} center={p} radius={8}
          pathOptions={{ color: '#2563eb', fillColor: i === 0 ? '#22c55e' : '#fff', fillOpacity: 1, weight: 2 }} />
      ))}
    </>
  );
}

/** Tracks mouse position inside the map */
function MouseTracker({ onMove }) {
  useMapEvents({ mousemove(e) { onMove([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MapComponent({
  clusters = [],
  detections = [],
  onClusterClick,
  showHeatmap = false,
  selectedId = null,
  zone = null,
  pickMode = false,
  onLocationPick = null,
  flyTarget = null,
  onAreaSaved = null,     // callback(polygon, centroid, boundaryGeojson)
}) {
  const [tileMode, setTileMode] = useState('satellite');
  const [routeLines, setRouteLines] = useState({});

  // Geocoding search
  const [geoSearch, setGeoSearch] = useState('');
  const [geoResults, setGeoResults] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchedBoundary, setSearchedBoundary] = useState(null); // GeoJSON polygon from Nominatim
  const [flyTo, setFlyTo] = useState(flyTarget || null);

  // Pick mode (single point)
  const [pickedMarker, setPickedMarker] = useState(null);

  // Draw mode (polygon)
  const [drawMode, setDrawMode] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [finishedPolygon, setFinishedPolygon] = useState(null);
  const [polygonCentroid, setPolygonCentroid] = useState(null);

  const tile = TILE_LAYERS[tileMode];

  // Sync external flyTarget
  useEffect(() => { if (flyTarget) setFlyTo(flyTarget); }, [flyTarget]);

  // Geocoding via Nominatim (with polygon boundary)
  const doGeoSearch = useCallback(async (q) => {
    if (!q.trim() || q.length < 3) { setGeoResults([]); return; }
    setGeoLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=in&polygon_geojson=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      setGeoResults(data);
    } catch { setGeoResults([]); } finally { setGeoLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doGeoSearch(geoSearch), 400);
    return () => clearTimeout(t);
  }, [geoSearch, doGeoSearch]);

  const handleGeoSelect = (item) => {
    const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
    setFlyTo({ lat, lon, zoom: 13 });
    setGeoSearch(item.display_name.split(',').slice(0, 2).join(', '));
    setGeoResults([]);

    // Show the boundary polygon returned by Nominatim
    if (item.geojson) {
      setSearchedBoundary(item.geojson);
    } else {
      setSearchedBoundary(null);
    }
  };

  const handleMapPick = (latlng) => {
    setPickedMarker(latlng);
    if (onLocationPick) onLocationPick(latlng);
  };

  // Drawing handlers
  const handleDrawPoint = (latlng) => {
    setDrawnPoints(prev => [...prev, latlng]);
  };

  const handleFinishDraw = () => {
    if (drawnPoints.length < 3) return;
    const centroid = calcCentroid(drawnPoints);
    setFinishedPolygon(drawnPoints);
    setPolygonCentroid(centroid);
    setDrawMode(false);
    setDrawnPoints([]);
    setMousePos(null);
    if (onAreaSaved) {
      onAreaSaved({
        polygon: drawnPoints,
        centroid: { lat: centroid[0], lon: centroid[1] },
        geojson: {
          type: 'Polygon',
          coordinates: [[...drawnPoints, drawnPoints[0]].map(p => [p[1], p[0]])],
        },
      });
    }
  };

  const handleClearDraw = () => {
    setDrawnPoints([]);
    setFinishedPolygon(null);
    setPolygonCentroid(null);
    setDrawMode(false);
    setMousePos(null);
  };

  // Undo last draw point
  const handleUndoPoint = () => {
    setDrawnPoints(prev => prev.slice(0, -1));
  };

  // Build boundary positions from Nominatim GeoJSON
  const getBoundaryPositions = () => {
    if (!searchedBoundary) return null;
    const geo = searchedBoundary;
    if (geo.type === 'Polygon') {
      return [geo.coordinates[0].map(c => [c[1], c[0]])];
    }
    if (geo.type === 'MultiPolygon') {
      return geo.coordinates.map(poly => poly[0].map(c => [c[1], c[0]]));
    }
    return null;
  };
  const boundaryPositions = getBoundaryPositions();

  // Initial map center
  const getCenter = () => {
    if (zone?.geometry?.coordinates?.[0]) {
      const poly = zone.geometry.coordinates[0];
      return [poly.reduce((s, p) => s + p[1], 0) / poly.length, poly.reduce((s, p) => s + p[0], 0) / poly.length];
    }
    const all = [...clusters, ...detections].filter(d => d.geometry?.coordinates);
    if (all.length > 0) return [all[0].geometry.coordinates[1], all[0].geometry.coordinates[0]];
    return [23.0225, 72.5714];
  };

  const center = getCenter();
  const formatScore = (s) => s != null ? `${Math.round(Number(s) * 100)}%` : '—';
  const highlightedCluster = selectedId
    ? clusters.find(c => c.properties?._id === selectedId || c._id === selectedId)
    : null;

  // Group detections into route lines via OSRM
  useEffect(() => {
    const groups = {};
    detections.forEach(d => {
      if (!d.geometry?.coordinates) return;
      const vid = d.properties?.video_id || 'unknown';
      if (!groups[vid]) groups[vid] = [];
      groups[vid].push(d);
    });
    Object.entries(groups).forEach(async ([vid, points]) => {
      points.sort((a, b) => new Date(a.properties?.timestamp || 0) - new Date(b.properties?.timestamp || 0));
      let coords = points.map(p => [p.geometry.coordinates[0], p.geometry.coordinates[1]]);
      if (coords.length < 2) return;
      if (coords.length > 90) {
        const step = (coords.length - 1) / 89;
        coords = Array.from({ length: 90 }, (_, i) => coords[Math.floor(i * step)]);
      }
      const coordsStr = coords.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';');
      try {
        const res = await fetch(`https://router.project-osrm.org/match/v1/driving/${coordsStr}?geometries=geojson&overview=full`);
        if (!res.ok) throw new Error('OSRM failed');
        const data = await res.json();
        if (data.code === 'Ok' && data.matchings?.length > 0) {
          const snapped = data.matchings.flatMap(m => m.geometry.coordinates.map(c => [c[1], c[0]]));
          setRouteLines(prev => ({ ...prev, [vid]: buildColoredSegments(snapped, points) }));
        } else {
          setRouteLines(prev => ({ ...prev, [vid]: buildColoredSegments(coords.map(c => [c[1], c[0]]), points) }));
        }
      } catch {
        setRouteLines(prev => ({ ...prev, [vid]: buildColoredSegments(coords.map(c => [c[1], c[0]]), points) }));
      }
    });
  }, [detections]);

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>

      {/* ── Geocoding Search (top-right) ────────────────────────── */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, width: 280 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Search city or area..."
            value={geoSearch}
            onChange={e => setGeoSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 32px 9px 32px', borderRadius: 8, fontSize: 12,
              border: 'none', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
              color: 'white', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          />
          {geoLoading && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 11 }}>⏳</span>}
          {geoSearch && !geoLoading && (
            <button onClick={() => { setGeoSearch(''); setGeoResults([]); setSearchedBoundary(null); }} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16,
            }}>×</button>
          )}
        </div>
        {geoResults.length > 0 && (
          <div style={{
            marginTop: 4, background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(8px)',
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {geoResults.map((item, i) => (
              <div key={i} onClick={() => handleGeoSelect(item)} style={{
                padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: 11, color: '#e2e8f0',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 700 }}>{item.display_name.split(',')[0]}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>
                  {item.display_name.split(',').slice(1, 3).join(',')} · {item.type}
                  {item.geojson ? ' · 📐 boundary available' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tile layer toggle (top-left) ────────────────────────── */}
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
            color: tileMode === key ? 'white' : '#94a3b8', transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Draw Toolbar (bottom-left) ──────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 80, left: 12, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {!drawMode && !finishedPolygon && (
          <button onClick={() => { setDrawMode(true); setDrawnPoints([]); setFinishedPolygon(null); setPolygonCentroid(null); }} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(6px)',
            color: '#e2e8f0', fontSize: 11, fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>✏️ Draw Area</button>
        )}
        {drawMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{
              background: 'rgba(15,23,42,0.94)', color: '#e2e8f0',
              padding: '8px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600,
              border: '1px solid rgba(37,99,235,0.4)',
            }}>
              📐 Click to add points<br />
              <span style={{ color: '#94a3b8' }}>Min. 3 points needed</span>
              {drawnPoints.length > 0 && <span style={{ color: '#22c55e', display: 'block', marginTop: 2 }}>{drawnPoints.length} point{drawnPoints.length !== 1 ? 's' : ''} added</span>}
            </div>
            {drawnPoints.length >= 3 && (
              <button onClick={handleFinishDraw} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#16a34a', color: 'white', fontSize: 11, fontWeight: 700,
              }}>✔ Finish & Save Area</button>
            )}
            {drawnPoints.length > 0 && (
              <button onClick={handleUndoPoint} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                background: 'rgba(15,23,42,0.88)', color: '#94a3b8', fontSize: 11, fontWeight: 700,
              }}>↩ Undo</button>
            )}
            <button onClick={handleClearDraw} style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11, fontWeight: 700,
            }}>✕ Cancel</button>
          </div>
        )}
        {finishedPolygon && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{
              background: 'rgba(15,23,42,0.94)', color: '#22c55e',
              padding: '8px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              border: '1px solid rgba(34,197,94,0.4)',
            }}>
              ✅ Area saved!<br />
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>
                {finishedPolygon.length} vertices<br />
                📍 Center: {polygonCentroid?.[0].toFixed(4)}, {polygonCentroid?.[1].toFixed(4)}
              </span>
            </div>
            <button onClick={handleClearDraw} style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              background: 'rgba(15,23,42,0.88)', color: '#94a3b8', fontSize: 11, fontWeight: 700,
            }}>↺ Clear Area</button>
          </div>
        )}
      </div>

      {/* ── Pick Mode Banner ────────────────────────────────────── */}
      {pickMode && (
        <div style={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#1d4ed8', color: 'white',
          padding: '8px 18px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          boxShadow: '0 4px 16px rgba(37,99,235,0.5)',
        }}>
          📍 Click on the map to pin your location
        </div>
      )}

      {/* ── Leaflet Map ─────────────────────────────────────────── */}
      <MapContainer
        center={center} zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        doubleClickZoom={!drawMode}
      >
        <TileLayer key={tileMode} attribution={tile.attribution} url={tile.url} maxZoom={tile.maxZoom} />

        <MapResizer />
        <FlyToSelected cluster={highlightedCluster} />
        <FlyToLocation target={flyTo} />
        <MapInteractionHandler
          pickMode={pickMode}
          drawMode={drawMode}
          onPick={handleMapPick}
          onDrawPoint={handleDrawPoint}
        />
        {drawMode && <MouseTracker onMove={setMousePos} />}

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

        {/* Heatmap */}
        {showHeatmap && <HeatmapLayer clusters={clusters} />}

        {/* Zone boundary (zone officer) */}
        {zone?.geometry?.coordinates && (
          <Polygon
            positions={zone.geometry.coordinates[0].map(p => [p[1], p[0]])}
            pathOptions={{ color: '#2563eb', weight: 3, fillOpacity: 0.05, dashArray: '5, 10' }}
          >
            <Popup><strong>Assigned Zone: {zone.name}</strong><br />Your jurisdiction boundary</Popup>
          </Polygon>
        )}

        {/* Nominatim search boundary */}
        {boundaryPositions && (
          boundaryPositions.map((positions, i) => (
            <Polygon key={`boundary-${i}`} positions={positions}
              pathOptions={{ color: '#8b5cf6', weight: 2.5, fillColor: '#8b5cf6', fillOpacity: 0.08, dashArray: '8 5' }}
            >
              <Popup>
                <strong>📐 {geoSearch}</strong><br />
                <span style={{ color: '#64748b', fontSize: 11 }}>Nominatim boundary</span>
              </Popup>
            </Polygon>
          ))
        )}

        {/* Live polygon draw preview */}
        <DrawPolygonLayer points={drawnPoints} mousePos={mousePos} />

        {/* Finished polygon */}
        {finishedPolygon && (
          <>
            <Polygon positions={finishedPolygon}
              pathOptions={{ color: '#16a34a', weight: 2.5, fillColor: '#16a34a', fillOpacity: 0.12 }}
            >
              <Popup>✅ Your drawn area<br />{finishedPolygon.length} vertices</Popup>
            </Polygon>
            {polygonCentroid && (
              <Marker position={polygonCentroid} icon={CentroidIcon}>
                <Popup>
                  <strong>📍 Area Center</strong><br />
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {polygonCentroid[0].toFixed(6)}, {polygonCentroid[1].toFixed(6)}
                  </span>
                </Popup>
              </Marker>
            )}
          </>
        )}

        {/* Picked single-point marker */}
        {pickedMarker && (
          <Marker position={[pickedMarker.lat, pickedMarker.lon]}>
            <Popup>📍 Pinned: {pickedMarker.lat.toFixed(6)}, {pickedMarker.lon.toFixed(6)}</Popup>
          </Marker>
        )}

        {/* 2. Render Verified Clusters */}
        {clusters.map((cluster, i) => {
          const level = cluster.properties?.risk_level || 'Low';
          const col = RISK_COLORS[level] || RISK_COLORS.Low;
          const coords = [cluster.geometry.coordinates[1], cluster.geometry.coordinates[0]];
          const p = cluster.properties || {};
          const damageTypes = Object.keys(p.damage_types || {}).join(', ') || p.damage_type || 'Unknown';
          const score = formatScore(p.final_risk_score);
          const status = (p.status || 'pending').replace(/_/g, ' ');
          const isHighlighted = selectedId && (p._id === selectedId || cluster._id === selectedId);

          return (
            <React.Fragment key={cluster._id || `cl-${i}`}>
              {isHighlighted && (
                <Circle center={coords} radius={60}
                  pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.12, weight: 5, dashArray: '8 4', opacity: 0.9 }}
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
                  <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', background: col.bg, color: col.text, padding: '2px 8px', borderRadius: 4 }}>{level} RISK</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: col.text }}>{score}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, textTransform: 'capitalize' }}>{damageTypes}</div>
                    {[
                      ['📋 Status', status],
                      ['📍 GPS', `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{value}</span>
                      </div>
                    ))}
                    <button style={{
                      width: '100%', marginTop: 8, padding: '7px',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: 'white', border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }} onClick={() => onClusterClick && onClusterClick(cluster)}>
                      📋 View Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Route lines (snapped drive paths) */}
        {Object.entries(routeLines).map(([vid, segments]) => (
          <LayerGroup key={`group-${vid}`}>
            {segments.map((seg, idx) => (
              <Polyline key={`route-${vid}-${idx}`} positions={seg.positions}
                pathOptions={{ color: seg.color, weight: seg.weight, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
              >
                <Popup>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>🛣 Drive Route<br />
                    <span style={{ color: '#64748b', fontSize: 10 }}>ID: {vid}</span>
                  </div>
                </Popup>
              </Polyline>
            ))}
          </LayerGroup>
        ))}
      </MapContainer>

      {/* ── Risk legend (bottom-right) ─────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 24, right: 12, zIndex: 1000,
        background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)',
        borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Risk</div>
        {['Critical', 'Medium', 'Low'].map(level => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: RISK_COLORS[level].fill, boxShadow: RISK_COLORS[level].glow }} />
            <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>{level}</span>
          </div>
        ))}
      </div>

      <style>{`
        .leaflet-popup-content-wrapper { border-radius: 10px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important; }
        .leaflet-popup-content { margin: 12px 14px !important; }
      `}</style>
    </div>
  );
}
