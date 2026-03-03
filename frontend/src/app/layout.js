import "./globals.css";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  UploadCloud, 
  ShieldAlert, 
  BarChart3, 
  Settings 
} from "lucide-react";

export const metadata = {
  title: "RoadMonitor Pro | PathFounders RDD System",
  description: "AI-Powered Road Damage Detection & Infrastructure Management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-20 lg:w-64 border-r border-white/5 bg-[#0a0d14] flex flex-col items-center lg:items-stretch py-8 overflow-y-auto">
            <div className="flex items-center gap-3 px-6 mb-10">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <ShieldAlert className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight hidden lg:block">RoadMonitor<span className="text-blue-500">Pro</span></span>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active href="/" />
              <SidebarItem icon={<MapIcon size={20} />} label="Damage Map" href="/map" />
              <SidebarItem icon={<BarChart3 size={20} />} label="Analytics" href="/analytics" />
              <SidebarItem icon={<UploadCloud size={20} />} label="Upload Data" href="/upload" />
            </nav>

            <div className="px-4 mt-auto">
              <SidebarItem icon={<Settings size={20} />} label="Settings" href="/settings" />
              <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/5 hidden lg:block">
                <p className="text-xs text-blue-300 font-medium mb-1">System Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold">AI Engine Active</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col h-full bg-[#07090d] relative overflow-hidden">
            {/* Topbar Placeholder */}
            <header className="h-16 border-b border-white/5 flex items-center justify-end px-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <span className="text-sm font-medium text-slate-300">Admin Operator</span>
              </div>
            </header>

            {/* Content Scrollable */}
            <section className="flex-1 overflow-y-auto p-8">
              {children}
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}

function SidebarItem({ icon, label, active = false, href = "#" }) {
  return (
    <a 
      href={href}
      className={`
        flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group
        ${active 
          ? "bg-blue-600/10 text-blue-500 border border-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]" 
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}
      `}
    >
      <div className={`transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`}>
        {icon}
      </div>
      <span className="font-medium hidden lg:block">{label}</span>
    </a>
  );
}
