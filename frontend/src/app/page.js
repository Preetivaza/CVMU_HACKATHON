'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin,
  ArrowRight,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClusters: 0,
    critical: 0,
    repaired: 0,
    recentUploads: 0
  });

  const [recentClusters, setRecentClusters] = useState([]);

  useEffect(() => {
    // Fetch system stats
    fetch('/api/v1/debug')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats({
            totalClusters: data.counts.clusters || 0,
            critical: 0, // Mock for now, would fetch from analytics
            repaired: 0,
            recentUploads: data.counts.uploads || 0
          });
        }
      })
      .catch(console.error);

    // Fetch top risk clusters
    fetch('/api/v1/analytics/priority-ranking?limit=4')
      .then(res => res.json())
      .then(data => {
        if (data.ranking) setRecentClusters(data.ranking);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Welcome */}
      <header className="animate-fade-in">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome Back, <span className="text-blue-500">Operator</span></h1>
        <p className="text-slate-400">System is monitoring 12 road segments. 4 areas require immediate attention.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<AlertTriangle className="text-amber-500" />} 
          label="Total Issues" 
          value={stats.totalClusters} 
          trend="+12% from last week" 
        />
        <StatCard 
          icon={<TrendingUp className="text-red-500" />} 
          label="Critical Risk" 
          value={stats.critical} 
          trend="Action Required" 
          urgent
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-500" />} 
          label="Fixed This Month" 
          value={stats.repaired} 
          trend="85% Efficiency" 
        />
        <StatCard 
          icon={<Activity className="text-blue-500" />} 
          label="Videos Processed" 
          value={stats.recentUploads} 
          trend="AI Active" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Priority List */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-500" />
              High Priority Clusters
            </h2>
            <a href="/map" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
              View Map <ArrowRight size={14} />
            </a>
          </div>

          <div className="space-y-4">
            {recentClusters.length > 0 ? recentClusters.map((cluster, i) => (
              <motion.div 
                key={cluster.cluster_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    cluster.risk_level === 'Critical' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'
                  }`}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 uppercase text-xs tracking-wider">{cluster.damage_types ? Object.keys(cluster.damage_types).join(', ') : 'Damage'}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin size={12} />
                      {cluster.location.coordinates[1].toFixed(4)}, {cluster.location.coordinates[0].toFixed(4)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-100">{cluster.risk_score}</div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Risk Score</div>
                </div>
              </motion.div>
            )) : (
              <p className="text-center py-10 text-slate-500">No active high-risk clusters detected.</p>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="glass p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" />
            Infrastructure Health
          </h2>
          <div className="space-y-6">
            <HealthItem label="Sensor Hub A" status="Online" color="emerald" />
            <HealthItem label="AI Engine v2.1" status="Processing" color="blue" />
            <HealthItem label="Storage Layer" status="92% Full" color="amber" />
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-widest">Global Status</p>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 w-[78%]" />
              </div>
              <p className="text-right text-xs text-emerald-400 mt-2 font-medium italic">All systems within normal parameters.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, urgent = false }) {
  return (
    <div className={`glass p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 ${urgent ? 'border-red-500/20' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/5 rounded-xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <div className="text-xs font-bold px-2 py-1 rounded bg-white/5 text-slate-400">{trend}</div>
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
      {urgent && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-3xl rounded-full" />}
    </div>
  );
}

function HealthItem({ label, status, color }) {
  const colorMap = {
    emerald: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    amber: 'text-amber-500 bg-amber-500/10'
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300 font-medium">{label}</span>
      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${colorMap[color]}`}>{status}</span>
    </div>
  );
}

function ShieldAlert({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
