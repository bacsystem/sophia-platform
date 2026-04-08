import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tu email y te enviaremos instrucciones
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-sm text-gray-500">
          <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Volver al login
          </a>
        </p>
      </div>
    </div>
  );
}
