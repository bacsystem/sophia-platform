import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

afterAll(async () => {
  await app.close();
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

  describe('POST /api/auth/register — cookies', () => {
    it('should set access_token and refresh_token cookies on register', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Cookie Test',
          email: `cookie-reg-${Date.now()}@example.com`,
          password: 'password1',
        },
      });

      expect(res.statusCode).toBe(201);
      const cookies = res.cookies;
      expect(cookies.some((c: { name: string }) => c.name === 'access_token')).toBe(true);
      expect(cookies.some((c: { name: string }) => c.name === 'refresh_token')).toBe(true);
    });
  });

  describe('Rate limiting', () => {
    it('should return 429 after 3 register attempts from same IP', async () => {
      // Clear rate limit keys first
      const redis = getRedisClient();
      const keys = await redis.keys('auth:register:*');
      if (keys.length) await redis.del(...keys);

      // 3 allowed registrations (each with unique email)
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            name: `Rate User ${i}`,
            email: `rate-reg-${Date.now()}-${i}@example.com`,
            password: 'password1',
          },
        });
      }

      // 4th should be rate limited
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Rate Blocked',
          email: `rate-reg-blocked-${Date.now()}@example.com`,
          password: 'password1',
        },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOO_MANY_REQUESTS');
      expect(body.retryAfter).toBeDefined();
    });

    it('should return 429 after 5 failed login attempts', async () => {
      // Clear rate limit keys first
      const redis = getRedisClient();
      const keys = await redis.keys('auth:attempts:*');
      if (keys.length) await redis.del(...keys);

      const targetEmail = `rate-login-${Date.now()}@example.com`;

      // Register the user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { name: 'Rate Login', email: targetEmail, password: 'password1' },
      });

      // Clear register rate limit after registration
      const regKeys = await redis.keys('auth:register:*');
      if (regKeys.length) await redis.del(...regKeys);

      // 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: targetEmail, password: 'wrongpass1', rememberMe: false },
        });
      }

      // 6th should be rate limited
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: targetEmail, password: 'wrongpass1', rememberMe: false },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOO_MANY_ATTEMPTS');
      expect(body.retryAfter).toBeDefined();
    });

    it('should return 429 after 3 forgot-password attempts for same email', async () => {
      // Clear rate limit keys first
      const redis = getRedisClient();
      const keys = await redis.keys('auth:reset:*');
      if (keys.length) await redis.del(...keys);

      const targetEmail = `rate-forgot-${Date.now()}@example.com`;

      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: { email: targetEmail },
        });
      }

      // 4th should be rate limited
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: targetEmail },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOO_MANY_REQUESTS');
      expect(body.retryAfter).toBeDefined();
    });
  });

  describe('POST /api/auth/logout — token revocation', () => {
    it('should revoke refresh token so it cannot be reused', async () => {
      // Clear rate limits
      const redis = getRedisClient();
      const keys = await redis.keys('auth:*');
      if (keys.length) await redis.del(...keys);

      const email = `logout-revoke-${Date.now()}@example.com`;
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { name: 'Logout Test', email, password: 'password1' },
      });

      // Login to get tokens
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'password1', rememberMe: false },
      });

      const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token');
      const refreshCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'refresh_token');

      // Logout
      await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: {
          access_token: accessCookie!.value,
          refresh_token: refreshCookie!.value,
        },
      });

      // Try to use the old refresh token — should fail
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: refreshCookie!.value },
      });

      expect(refreshRes.statusCode).toBe(401);
    });
  });
});
