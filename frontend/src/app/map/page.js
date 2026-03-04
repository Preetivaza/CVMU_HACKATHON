'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { 
  ArrowLeft, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  Layers,
  Search,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Dynamically import map to avoid SSR error
const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 rounded-2xl animate-pulse" />
});

export default function MapPage() {
  const [clusters, setClusters] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/clusters?limit=50')
      .then(res => res.json())
      .then(data => {
        if (data.features) setClusters(data.features);
        setLoading(false);
      });
  }, []);

  const handleUpdateStatus = async (status) => {
    if (!selectedCluster) return;
    
    // Update API
    const resp = await fetch(`/api/v1/clusters/${selectedCluster._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status,
        notes: `Status changed manually via Map Dashboard.`
      })
    });

    if (resp.ok) {
      const { data: updated } = await resp.json();
      setClusters(prev => prev.map(c => c._id === updated._id ? updated : c));
      setSelectedCluster(updated);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight">
            <Layers className="text-blue-600" size={24} />
            Live Infrastructure Map
          </h1>
          <p className="text-slate-500 text-sm font-medium italic">Visualizing <strong>{clusters.length}</strong> active clusters across <strong>2.4km</strong> monitored road segments.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-100 text-[10px] font-extrabold text-emerald-600 flex items-center gap-2 uppercase tracking-widest">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             Live Data Feed
           </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main Map Box */}
        <div className="flex-[3] relative card shadow-lg overflow-hidden border-2 border-white">
          <MapComponent clusters={clusters} onClusterClick={(c) => setSelectedCluster(c)} />
          
          {/* Quick Floating Actions */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <button className="p-2.5 bg-white rounded-xl text-gray-600 hover:text-blue-600 shadow-xl border border-gray-100 transition-all active:scale-95"><Search size={20} /></button>
            <button className="p-2.5 bg-white rounded-xl text-gray-600 hover:text-blue-600 shadow-xl border border-gray-100 transition-all active:scale-95"><Navigation size={20} /></button>
          </div>
        </div>

        {/* Sidebar Detail Panel */}
        <AnimatePresence mode='wait'>
          {selectedCluster ? (
            <motion.aside 
              key="cluster-detail"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="flex-1 card p-6 overflow-y-auto min-w-[380px] bg-white border-l-4 border-blue-500 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedCluster(null)}
                className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-6 hover:text-blue-600 transition-colors uppercase tracking-widest"
              >
                <ArrowLeft size={14} /> Back to Overview
              </button>

              <div className="space-y-8">
                <header>
                  <div className={`w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border ${getRiskBadge(selectedCluster.properties.risk_level)}`}>
                    {selectedCluster.properties.risk_level} Priority
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-900 leading-tight tracking-tight uppercase">
                    {selectedCluster.properties.damage_type || 'Multiple Anomalies'}
                  </h2>
                  <div className="text-gray-400 flex items-center gap-1.5 text-xs font-bold mt-2 uppercase tracking-tight">
                    <MapPin size={14} className="text-red-500" />
                    {selectedCluster.geometry.coordinates[1].toFixed(6)}, {selectedCluster.geometry.coordinates[0].toFixed(6)}
                  </div>
                </header>

                <div className="grid grid-cols-2 gap-4">
                  <DetailBox label="Risk Index" value={selectedCluster.properties.final_risk_score} />
                  <DetailBox label="Confidence" value={`${(selectedCluster.properties.avg_confidence * 100).toFixed(0)}%`} />
                  <DetailBox label="Feature Points" value={selectedCluster.properties.points_count} />
                  <DetailBox label="Audit Count" value={selectedCluster.properties.repeat_count || 1} />
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">Command Actions</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'pending'} 
                      icon={<AlertTriangle size={18} />} 
                      label="Mark Pending Review" 
                      onClick={() => handleUpdateStatus('pending')}
                    />
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'in_progress'} 
                      icon={<Clock size={16} />} 
                      label="Deploy Maintenance" 
                      onClick={() => handleUpdateStatus('in_progress')}
                    />
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'repaired'} 
                      icon={<CheckCircle2 size={16} />} 
                      label="Repair Verified" 
                      onClick={() => handleUpdateStatus('repaired')}
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-[11px] text-gray-500 font-medium">
                  <div className="flex items-center gap-2 mb-2 font-black text-gray-400 uppercase tracking-widest">
                    <Calendar size={12} />
                    Detection Timeline
                  </div>
                  <p>Initial: {new Date(selectedCluster.first_detected).toLocaleString()}</p>
                </div>
              </div>
            </motion.aside>
          ) : (
             <motion.aside 
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 card p-10 flex flex-col items-center justify-center text-center bg-white shadow-xl"
             >
                <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 text-blue-600 shadow-inner">
                  <Layers size={32} />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">No Cluster Selected</h3>
                <p className="text-sm text-gray-500 font-medium mt-2 leading-relaxed">
                  Select a point on the live map to trigger forensic depth analysis, view damage history, or authorize repairs.
                </p>
             </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-[1.02]">
      <span className="text-[9px] uppercase font-black text-gray-400 tracking-[0.2em] block mb-1">{label}</span>
      <span className="text-xl font-extrabold text-gray-900 tracking-tight">{value}</span>
    </div>
  );
}

function StatusBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 font-extrabold text-xs uppercase tracking-wider
        ${active ? 'bg-[#2563eb] text-white shadow-xl shadow-blue-500/30 ring-4 ring-blue-50' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'}
      `}
    >
      <div className={active ? 'scale-110' : ''}>{icon}</div>
      {label}
      {active && <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />}
    </button>
  );
}

function getRiskBadge(level) {
  if (level === 'Critical') return 'bg-red-50 text-red-600 border-red-100';
  if (level === 'High') return 'bg-orange-50 text-orange-600 border-orange-100';
  return 'bg-blue-50 text-blue-600 border-blue-100';
}

