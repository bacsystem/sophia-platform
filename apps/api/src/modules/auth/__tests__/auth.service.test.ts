import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';
import { getRedisClient } from '../../../lib/redis.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  // Clear rate limit keys to avoid interference from other test files
  const redis = getRedisClient();
  const keys = await redis.keys('auth:*');
  if (keys.length) await redis.del(...keys);
});

describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'password1',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: testUser,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe(testUser.email);
      expect(body.data.name).toBe(testUser.name);
    });

    it('should return 409 for duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: testUser,
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should return 422 for invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { name: 'A', email: 'invalid', password: 'short' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully and return 200 with cookies', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: testUser.email, password: testUser.password, rememberMe: false },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.email).toBe(testUser.email);

      const cookies = res.cookies;
      expect(cookies.some((c: { name: string }) => c.name === 'access_token')).toBe(true);
      expect(cookies.some((c: { name: string }) => c.name === 'refresh_token')).toBe(true);
    });

    it('should return 401 for wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: testUser.email, password: 'wrongpass1', rememberMe: false },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nonexistent@example.com', password: 'password1', rememberMe: false },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh cookie', async () => {
      // Login first to get cookies
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: testUser.email, password: testUser.password, rememberMe: false },
      });

      const refreshCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'refresh_token');

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: refreshCookie!.value },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.email).toBe(testUser.email);
    });

    it('should return 401 without refresh cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookies', async () => {
      // Login first
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: testUser.email, password: testUser.password, rememberMe: false },
      });

      const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token');
      const refreshCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'refresh_token');

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: {
          access_token: accessCookie!.value,
          refresh_token: refreshCookie!.value,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.message).toBe('Sesión cerrada');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should always return 200 regardless of email existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'nonexistent@example.com' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.message).toContain('Si el email existe');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should return 400 for invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'invalid-token', password: 'newpassword1' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid access token', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: testUser.email, password: testUser.password, rememberMe: false },
      });

      const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token');

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { access_token: accessCookie!.value },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.email).toBe(testUser.email);
      expect(body.data).toHaveProperty('createdAt');
    });

    it('should return 401 without access token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
