import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
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
            <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
            <p className="mt-1.5 text-sm text-white/50">Empieza gratis, sin tarjeta de crédito</p>
          </div>
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-white/40">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="link-premium">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
