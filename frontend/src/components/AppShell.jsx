'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map as MapIcon,
  UploadCloud,
  BarChart3,
  Settings,
  ShieldAlert,
  Bell,
  CircleUser
} from "lucide-react";

const navItems = [
  { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/map",       icon: MapIcon,          label: "Damage Map" },
  { href: "/analytics", icon: BarChart3,         label: "Analytics" },
  { href: "/upload",    icon: UploadCloud,       label: "Upload Data" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ===== SIDEBAR ===== */}
      <aside style={{
        width: 200, minWidth: 200,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: '#2563eb', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldAlert size={20} color="white" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>Road Monitor</div>
              <div style={{ color: '#60a5fa', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>PathFounders · RDD</div>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div style={{ padding: '14px 16px 6px' }}>
          <p style={{ color: '#334155', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Ministry of Road Transport
          </p>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '9px 12px', borderRadius: 7,
                  background: active ? '#1e40af' : 'transparent',
                  color: active ? '#ffffff' : '#94a3b8',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={17} />
                    <span>{label}</span>
                  </div>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div style={{ padding: '10px 8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 2 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#1d4ed8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CircleUser size={17} color="#93c5fd" />
            </div>
            <div>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>Role Tester</div>
              <div style={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>City Admin</div>
            </div>
          </div>

          {/* Settings Link */}
          <Link href="/settings" style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 7,
              color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              <Settings size={17} />
              <span>Settings</span>
            </div>
          </Link>

          {/* Issue Badge */}
          <div style={{ padding: '2px 12px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#ef4444', borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer',
            }}>
              <span style={{
                background: '#b91c1c', borderRadius: 3,
                padding: '0 5px', fontSize: 10, fontWeight: 800,
              }}>N</span>
              1 Issue ×
            </span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 52, background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, background: '#f1f5f9', borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LayoutDashboard size={14} color="#64748b" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              🏛️&nbsp; Ministry of Road Transport
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
              Wed, 4 Mar, 2026, 03:16 pm
            </span>
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={18} color="#94a3b8" />
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 7, height: 7, background: '#ef4444',
                borderRadius: '50%', border: '1.5px solid white',
              }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20,
              padding: '4px 12px',
            }}>
              <div style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                System Operational
              </span>
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
