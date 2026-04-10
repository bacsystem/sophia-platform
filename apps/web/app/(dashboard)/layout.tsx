import type { ReactNode } from 'react';
import Link from 'next/link';
import { FolderOpen, Settings, Cpu } from 'lucide-react';
import { UserProfileMenu } from '@/components/auth/user-profile-menu';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';

/** @description Dashboard layout — shared nav wrapper for authenticated routes with premium fonts */
export default function DashboardLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-deep)]">
      {/* Premium fonts loaded via next/font/google in root layout */}
      <TokenRefreshProvider />

      {/* ── Premium Navbar ── */}
      <nav className="relative border-b border-[var(--border-subtle)] bg-[var(--nav-bg)]/90 backdrop-blur-xl shrink-0 z-50">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[rgba(var(--accent-rgb)/0.4)] to-transparent" />

        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg transition-shadow" style={{ background: 'linear-gradient(135deg, var(--accent-400), var(--accent-500))', boxShadow: 'rgba(var(--accent-rgb),0.25) 0 4px 14px' }}>
              <Cpu className="w-4.5 h-4.5 text-white" />
            </div>
            <span
              className="font-bold text-[15px] tracking-[0.12em] hidden sm:block group-hover:text-[var(--accent-400)] transition-colors text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
            >
              SOPHIA
            </span>
          </Link>

          <div className="flex items-center gap-1 ml-3">
            <NavLink href="/projects" icon={<FolderOpen className="w-4 h-4" />} label="Proyectos" />
            <NavLink href="/settings" icon={<Settings className="w-4 h-4" />} label="Configuración" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </div>
      </nav>

      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}

/** @description Premium navigation link with hover glow */
function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent-500)] hover:bg-[rgba(var(--accent-rgb)/0.07)] transition-all duration-200"
      style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
    >
      {icon}
      <span className="tracking-wide">{label}</span>
    </Link>
  );
}
