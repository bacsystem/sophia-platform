import type { FastifyInstance } from 'fastify';
import { authenticate } from './auth.middleware.js';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  getMeHandler,
  getSessionHandler,
} from './auth.controller.js';

export async function authRoutes(app: FastifyInstance) {
  // Public routes
  app.post('/register', registerHandler);
  app.post('/login', loginHandler);
  app.post('/refresh', refreshHandler);
  app.post('/forgot-password', forgotPasswordHandler);
  app.post('/reset-password', resetPasswordHandler);

  // Protected routes
  app.post('/logout', { preHandler: [authenticate] }, logoutHandler);
  app.get('/me', { preHandler: [authenticate] }, getMeHandler);
  app.get('/session', { preHandler: [authenticate] }, getSessionHandler);
}
