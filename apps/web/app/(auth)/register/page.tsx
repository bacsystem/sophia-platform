import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-[var(--bg-deep)]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-[var(--text-primary)] font-bold text-xl tracking-wider" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>SOPHIA</span>
        </div>

        <div className="section-premium">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Crear cuenta</h1>
            <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">Empieza gratis, sin tarjeta de crédito</p>
          </div>
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="link-premium">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
