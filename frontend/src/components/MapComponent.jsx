'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapComponent({ clusters = [], onClusterClick }) {
  const center = clusters.length > 0 
    ? [clusters[0].geometry.coordinates[1], clusters[0].geometry.coordinates[0]]
    : [28.6139, 77.2090]; // Delhi Default

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0a0d14' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {clusters.map((cluster) => (
          <React.Fragment key={cluster._id}>
            {/* Cluster Marker */}
            <Marker 
              position={[cluster.geometry.coordinates[1], cluster.geometry.coordinates[0]]}
              eventHandlers={{
                click: () => onClusterClick && onClusterClick(cluster),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[150px]">
                  <h3 className="font-bold text-slate-800 uppercase text-xs mb-1">
                    {Object.keys(cluster.properties.damage_types || {}).join(', ')}
                  </h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Risk Score</span>
                    <span className={`text-sm font-bold ${getRiskColor(cluster.properties.risk_level)}`}>
                      {cluster.properties.final_risk_score}
                    </span>
                  </div>
                  <button 
                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded transition-colors hover:bg-blue-700"
                    onClick={() => onClusterClick && onClusterClick(cluster)}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>

            {/* Visual Radius Circle */}
            <Circle 
              center={[cluster.geometry.coordinates[1], cluster.geometry.coordinates[0]]}
              radius={cluster.properties.radius_meters || 10}
              pathOptions={{
                color: cluster.properties.risk_level === 'Critical' ? '#ef4444' : '#3b82f6',
                fillColor: cluster.properties.risk_level === 'Critical' ? '#ef4444' : '#3b82f6',
                fillOpacity: 0.2,
                weight: 1
              }}
            />
          </React.Fragment>
        ))}

        <MapResizer />
      </MapContainer>
      
      {/* Floating Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] glass px-4 py-3 text-[10px] font-bold tracking-widest uppercase">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <span>Critical Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
            <span>High Awareness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <span>Routine Monitor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
}

function getRiskColor(level) {
  if (level === 'Critical') return 'text-red-500';
  if (level === 'High') return 'text-orange-500';
  return 'text-blue-500';
}
