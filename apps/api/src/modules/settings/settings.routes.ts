import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import {
  getSettingsHandler,
  saveApiKeyHandler,
  deleteApiKeyHandler,
  verifyApiKeyHandler,
  getUsageHandler,
  getDailyUsageHandler,
  updateProfileHandler,
  changePasswordHandler,
} from './settings.controller.js';

/** @description Settings routes — all endpoints require authentication */
export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', getSettingsHandler);
  app.put('/api-key', saveApiKeyHandler);
  app.delete('/api-key', deleteApiKeyHandler);
  app.post('/api-key/verify', verifyApiKeyHandler);
  app.get('/usage', getUsageHandler);
  app.get('/usage/daily', getDailyUsageHandler);
  app.put('/profile', updateProfileHandler);
  app.put('/password', changePasswordHandler);
}
