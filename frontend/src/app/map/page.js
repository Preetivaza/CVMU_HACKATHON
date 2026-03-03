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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Layers className="text-blue-500" size={24} />
            Live Infrastructure Map
          </h1>
          <p className="text-slate-500 text-sm">Visualizing <strong>{clusters.length}</strong> active clusters across <strong>2.4km</strong> monitored road segments.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/5 text-xs text-slate-400 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
             Live Data Feed
           </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main Map Box */}
        <div className="flex-[3] relative">
          <MapComponent clusters={clusters} onClusterClick={(c) => setSelectedCluster(c)} />
          
          {/* Quick Floating Actions */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <button className="p-2 glass text-white hover:bg-blue-600 transition-colors shadow-lg shadow-black/40"><Search size={20} /></button>
            <button className="p-2 glass text-white hover:bg-blue-600 transition-colors shadow-lg shadow-black/40"><Navigation size={20} /></button>
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
              className="flex-1 glass p-6 overflow-y-auto min-w-[350px]"
            >
              <button 
                onClick={() => setSelectedCluster(null)}
                className="text-xs text-slate-500 flex items-center gap-1 mb-6 hover:text-white transition-colors"
              >
                <ArrowLeft size={12} /> Deselect
              </button>

              <div className="space-y-8">
                <header>
                  <div className={`w-fit px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-3 ${getRiskBadge(selectedCluster.properties.risk_level)}`}>
                    {selectedCluster.properties.risk_level} Risk
                  </div>
                  <h2 className="text-2xl font-bold uppercase">{selectedCluster.properties.damage_type || 'Multiple Detections'}</h2>
                  <div className="text-slate-500 flex items-center gap-1.5 text-sm font-medium mt-1">
                    <MapPin size={14} className="text-red-500" />
                    {selectedCluster.geometry.coordinates[1].toFixed(5)}, {selectedCluster.geometry.coordinates[0].toFixed(5)}
                  </div>
                </header>

                <div className="grid grid-cols-2 gap-4">
                  <DetailBox label="Risk Score" value={selectedCluster.properties.final_risk_score} />
                  <DetailBox label="Confidence" value={`${(selectedCluster.properties.avg_confidence * 100).toFixed(0)}%`} />
                  <DetailBox label="Points" value={selectedCluster.properties.points_count} />
                  <DetailBox label="Repeats" value={selectedCluster.properties.repeat_count || 1} />
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Primary Action Center</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'pending'} 
                      icon={<AlertTriangle size={18} />} 
                      label="Mark Pending" 
                      onClick={() => handleUpdateStatus('pending')}
                    />
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'in_progress'} 
                      icon={<Clock size={14} />} 
                      label="Deploy Repair Team" 
                      onClick={() => handleUpdateStatus('in_progress')}
                    />
                    <StatusBtn 
                      active={selectedCluster.properties.status === 'repaired'} 
                      icon={<CheckCircle2 size={14} />} 
                      label="Mark as Repaired" 
                      onClick={() => handleUpdateStatus('repaired')}
                    />
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-500">
                  <div className="flex items-center gap-2 mb-2 font-bold text-slate-400">
                    <Calendar size={12} />
                    Audit Logs
                  </div>
                  <p>First detected: {new Date(selectedCluster.first_detected).toLocaleString()}</p>
                </div>
              </div>
            </motion.aside>
          ) : (
             <motion.aside 
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 glass p-10 flex flex-col items-center justify-center text-center text-slate-500"
             >
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                  <Layers size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-300">No Cluster Selected</h3>
                <p className="text-sm mt-2">Select a point on the map to trigger forensic depth analysis or status updates.</p>
             </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
      <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest block mb-1">{label}</span>
      <span className="text-lg font-bold text-slate-100">{value}</span>
    </div>
  );
}

function StatusBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm
        ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'}
      `}
    >
      <div className={active ? 'scale-110' : ''}>{icon}</div>
      {label}
      {active && <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />}
    </button>
  );
}

function getRiskBadge(level) {
  if (level === 'Critical') return 'bg-red-500/20 text-red-500 border border-red-500/30';
  if (level === 'High') return 'bg-orange-500/20 text-orange-500 border border-orange-500/30';
  return 'bg-blue-500/20 text-blue-500 border border-blue-500/30';
}
