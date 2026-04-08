import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let accessToken: string;
let createdProjectId: string;

const TEST_USER = {
  email: `projects-test-${Date.now()}@example.com`,
  password: 'password123',
  name: 'Projects Test',
};

const VALID_PROJECT = {
  name: 'Mi proyecto test',
  description: 'Descripción de al menos veinte caracteres para el test.',
  stack: 'node-nextjs',
  config: {
    model: 'claude-sonnet-4-6',
    agents: ['dba', 'seed', 'backend', 'frontend', 'security', 'integration'],
  },
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register + login to get cookie
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: TEST_USER,
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: TEST_USER.email, password: TEST_USER.password, rememberMe: false },
  });
  const loginCookies = loginRes.cookies as { name: string; value: string }[];
  const tokenCookie = loginCookies.find((c) => c.name === 'access_token');
  accessToken = tokenCookie?.value ?? '';
});

afterAll(async () => {
  if (app) await app.close();
});

describe('Projects API Integration', () => {
  describe('POST /api/projects', () => {
    it('should create a project and return 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: VALID_PROJECT,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveProperty('id');
      expect(body.data.status).toBe('idle');
      expect(body.data.name).toBe(VALID_PROJECT.name);
      createdProjectId = body.data.id;
    });

    it('should return 422 for invalid input (name too short)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { ...VALID_PROJECT, name: 'ab' },
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: VALID_PROJECT,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should list projects with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects?page=1&limit=12',
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('pages');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return a project by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${createdProjectId}`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(createdProjectId);
    });

    it('should return 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update a project in idle state', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${createdProjectId}`,
        payload: { name: 'Nombre actualizado test' },
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Nombre actualizado test');
    });
  });

  describe('POST /api/projects/:id/start', () => {
    it('should transition project to running', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${createdProjectId}/start`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('running');
    });

    it('should return 400 for invalid transition (running→start)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${createdProjectId}/start`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('POST /api/projects/:id/pause', () => {
    it('should pause a running project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${createdProjectId}/pause`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('paused');
    });
  });

  describe('POST /api/projects/:id/continue', () => {
    it('should continue a paused project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${createdProjectId}/continue`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('running');
    });
  });

  describe('PATCH /api/projects/:id — running state', () => {
    it('should return 400 PROJECT_NOT_EDITABLE when running', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${createdProjectId}`,
        payload: { name: 'No se puede editar' },
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('PROJECT_NOT_EDITABLE');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should return 400 CANNOT_DELETE_RUNNING when project is running', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${createdProjectId}`,
        cookies: { access_token: accessToken },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('CANNOT_DELETE_RUNNING');
    });

    it('should delete a non-running project and return 404 on subsequent GET', async () => {
      // Create a fresh project to delete
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: VALID_PROJECT,
        cookies: { access_token: accessToken },
      });
      const { id: newId } = JSON.parse(createRes.body).data;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${newId}`,
        cookies: { access_token: accessToken },
      });
      expect(deleteRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${newId}`,
        cookies: { access_token: accessToken },
      });
      expect(getRes.statusCode).toBe(404);
    });
  });
});
