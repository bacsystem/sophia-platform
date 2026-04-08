import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">Sophia</span>
        </div>

        <div className="glass rounded-2xl p-8 shadow-glow">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1>
            <p className="mt-1.5 text-sm text-white/50">Te enviaremos instrucciones a tu email</p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-sm text-white/40">
          <a href="/login" className="link-premium">
            ← Volver al login
          </a>
        </p>
      </div>
    </div>
  );
}
