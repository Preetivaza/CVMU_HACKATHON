'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, LayerGroup } from 'react-leaflet';
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
  High: { stroke: '#f97316', fill: '#f97316', text: '#ea580c', bg: '#fff7ed', glow: '0 0 12px rgba(249,115,22,0.7)' },
  Medium: { stroke: '#eab308', fill: '#eab308', text: '#ca8a04', bg: '#fefce8', glow: '0 0 10px rgba(234,179,8,0.6)' },
  Low: { stroke: '#22c55e', fill: '#22c55e', text: '#16a34a', bg: '#f0fdf4', glow: '0 0 10px rgba(34,197,94,0.5)' },
};

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
  const size = level === 'Critical' ? 22 : level === 'High' ? 18 : 15;
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

export default function MapComponent({ clusters = [], onClusterClick, showHeatmap = false }) {
  const [tileMode, setTileMode] = useState('satellite');
  const tile = TILE_LAYERS[tileMode];

  const center = clusters.length > 0
    ? [clusters[0].geometry.coordinates[1], clusters[0].geometry.coordinates[0]]
    : [23.0225, 72.5714]; // Ahmedabad default

  const formatScore = (s) => s != null ? `${Math.round(Number(s) * 100)}%` : '—';

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

        {clusters.map((cluster, i) => {
          const level = cluster.properties?.risk_level || 'Low';
          const col = RISK_COLORS[level] || RISK_COLORS.Low;
          const coords = [cluster.geometry.coordinates[1], cluster.geometry.coordinates[0]];
          const p = cluster.properties || {};
          const damageTypes = Object.keys(p.damage_types || {}).join(', ') || p.damage_type || 'Unknown';
          const score = formatScore(p.final_risk_score);
          const repeatCount = p.repeat_count || 1;
          const status = (p.status || 'pending').replace(/_/g, ' ');

          return (
            <React.Fragment key={cluster._id || i}>
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
