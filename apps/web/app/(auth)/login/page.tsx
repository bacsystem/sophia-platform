import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/20 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">Sophia</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-white leading-tight">
              Generación autónoma<br />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                de software con IA
              </span>
            </h2>
            <p className="text-white/60 text-lg leading-relaxed max-w-sm">
              Orquesta agentes especializados que construyen tu software capa por capa.
            </p>
          </div>
          <div className="flex gap-4">
            {['DBA', 'Backend', 'Frontend', 'QA', 'Deploy'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70 border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-white/30 text-sm">© 2026 Sophia Platform</p>
        </div>
        {/* Decorative orbs */}
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-center items-center px-6 py-12 lg:px-16 lg:max-w-[480px]">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">Sophia</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Bienvenido de vuelta</h1>
            <p className="mt-1.5 text-sm text-white/50">Ingresa tus credenciales para continuar</p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-white/40">
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
