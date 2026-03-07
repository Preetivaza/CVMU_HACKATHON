'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map as MapIcon,
  UploadCloud,
  BarChart3,
  FileText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Bell,
  LogOut,
  ChevronRight,
  User,
  Layers,
  AlertTriangle,
  Users,
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/map", icon: MapIcon, label: "Live Map" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/reports", icon: FileText, label: "Reports" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/upload", icon: UploadCloud, label: "Upload Data" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

// Admin-only nav group (visible to city_admin and master_admin)
const adminNavGroup = {
  label: "Admin",
  items: [
    { href: "/admin", icon: Users, label: "User Management" },
    { href: "/zones", icon: Layers, label: "Zone Management" },
  ],
};

function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rdd_user');
      if (raw) setUser(JSON.parse(raw));
    } catch (_) { }
  }, []);
  return user;
}

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      return now.toLocaleString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    };
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function NavItem({ href, icon: Icon, label, pathname }) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '8px 12px', borderRadius: 8,
        background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
        color: active ? '#60a5fa' : 'rgba(148,163,184,0.85)',
        fontSize: 13.5, fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
      }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.85)'; } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={16} />
          <span>{label}</span>
        </div>
        {active && <ChevronRight size={13} strokeWidth={3} />}
      </div>
    </Link>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const clock = useClock();

  const handleLogout = () => {
    localStorage.removeItem('rdd_token');
    localStorage.removeItem('rdd_user');
    window.location.href = '/login';
  };

  // Derive current page title from path
  const pageTitles = {
    '/': 'Dashboard Overview',
    '/map': 'Live Infrastructure Map',
    '/analytics': 'Analytics & Reporting',
    '/reports': 'Reports Center',
    '/upload': 'Data Upload',
    '/settings': 'Account Settings',
    '/admin': 'Admin — User Management',
    '/zones': 'Admin — Zone Management',
    '/public-report': 'Citizen Report Portal',
  };
  const pageTitle = pageTitles[pathname] || 'SadakSurksha';
  const isAdmin = ['city_admin', 'master_admin', 'admin'].includes(user?.role);

  const roleLabel = (() => {
    const base = user?.role?.replace(/_/g, ' ') || 'City Admin';
    return base.charAt(0).toUpperCase() + base.slice(1);
  })();
  const displayName = user?.name || user?.email?.split('@')[0] || 'Admin User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const userZone = user?.authority_zone?.name || user?.authority_zone?.code || null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f1f5f9' }}>
      {/* ===== SIDEBAR ===== */}
      <aside style={{
        width: 240, minWidth: 240,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 38, height: 38,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
            }}>
              <ShieldAlert size={20} color="white" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2 }}>SadakSurksha</div>
              <div style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Road Safety Platform</div>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <p style={{
                color: '#334155', fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '0 12px', marginBottom: 6,
              }}>
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavItem key={item.href} {...item} pathname={pathname} />
              ))}
            </div>
          ))}
          {/* Admin-only group */}
          {isAdmin && (
            <div style={{ marginBottom: 20 }}>
              <p style={{
                color: '#475569', fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '0 12px', marginBottom: 6,
              }}>
                {adminNavGroup.label}
              </p>
              {adminNavGroup.items.map((item) => (
                <NavItem key={item.href} {...item} pathname={pathname} />
              ))}
            </div>
          )}
        </nav>

        {/* Bottom: User + Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 10px 14px' }}>
          {/* User info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 4,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0,
            }}>
              {initials}
            </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{
                  color: '#60a5fa', fontSize: 9.5, fontWeight: 600,
                  textTransform: 'capitalize', letterSpacing: '0.04em',
                }}>
                  {roleLabel}
                </div>
                {userZone && (
                  <div style={{ color: '#34d399', fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', marginTop: 1 }}>
                    📍 {userZone}
                  </div>
                )}
              </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s', textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          height: 60, background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
              {pageTitle}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {clock}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* System Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 20, padding: '5px 12px',
            }}>
              <div style={{
                width: 7, height: 7, background: '#22c55e', borderRadius: '50%',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Live
              </span>
            </div>

            {/* Notifications */}
            <button style={{
              position: 'relative', background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 6, borderRadius: 8,
              color: '#64748b', display: 'flex', alignItems: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Bell size={18} />
              <div style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, background: '#ef4444',
                borderRadius: '50%', border: '1.5px solid white',
              }} />
            </button>

            {/* User Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: 'white',
              cursor: 'pointer', flexShrink: 0,
            }}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: '#f8fafc' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
