import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Accede a Sophia Platform
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Regístrate
          </a>
        </p>
      </div>
    </div>
  );
}
