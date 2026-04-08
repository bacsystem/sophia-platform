import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Regístrate para acceder a Sophia Platform
          </p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
