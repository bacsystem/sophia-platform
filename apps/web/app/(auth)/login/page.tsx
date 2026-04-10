import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg-deep)]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 relative overflow-hidden border-r border-[var(--muted-border)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--accent-rgb)/0.07)] via-[var(--bg-deep)] to-transparent" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-[var(--text-primary)] font-bold text-xl tracking-wider" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>SOPHIA</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-[var(--text-primary)] leading-tight">
              Generación autónoma<br />
              <span className="text-gradient-cyan">
                de software con IA
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg leading-relaxed max-w-sm">
              Orquesta agentes especializados que construyen tu software capa por capa.
            </p>
          </div>
          <div className="flex gap-3">
            {['DBA', 'Backend', 'Frontend', 'QA', 'Deploy'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[11px] font-medium bg-[rgba(var(--accent-rgb)/0.08)] text-[rgba(var(--accent-rgb)/0.78)] border border-[rgba(var(--accent-rgb)/0.20)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-[var(--text-disabled)] text-sm">© 2026 Sophia Platform</p>
        </div>
        {/* Decorative glow */}
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-[rgba(var(--accent-rgb)/0.06)] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-[rgba(var(--accent-rgb)/0.04)] rounded-full blur-3xl" />
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-center items-center px-6 py-12 lg:px-16 lg:max-w-[480px]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-[var(--text-primary)] font-bold text-xl tracking-wider" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>SOPHIA</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Bienvenido de vuelta</h1>
            <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">Ingresa tus credenciales para continuar</p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-[var(--text-tertiary)]">
            ¿No tienes cuenta?{' '}
            <a href="/register" className="link-premium">
              Regístrate gratis
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
