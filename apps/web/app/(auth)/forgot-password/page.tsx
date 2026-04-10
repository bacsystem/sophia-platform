import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
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
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Recuperar contraseña</h1>
            <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">Te enviaremos instrucciones a tu email</p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
          <a href="/login" className="link-premium">
            ← Volver al login
          </a>
        </p>
      </div>
    </div>
  );
}
