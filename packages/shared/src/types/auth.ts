export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  data: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AuthError {
  error: string;
  message: string;
  retryAfter?: number;
}

export interface ValidationError extends AuthError {
  error: 'VALIDATION_ERROR';
  errors: Array<{ path: string[]; message: string }>;
}
