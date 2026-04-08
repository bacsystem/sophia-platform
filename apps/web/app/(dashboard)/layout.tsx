import type { ReactNode } from 'react';
import Link from 'next/link';
import { FolderOpen } from 'lucide-react';

/** @description Dashboard layout — shared nav wrapper for authenticated routes */
export default function DashboardLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-base tracking-tight hidden sm:block">
              Sophia
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Proyectos</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
