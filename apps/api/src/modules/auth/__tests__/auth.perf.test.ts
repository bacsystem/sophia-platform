import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';
import { getRedisClient } from '../../../lib/redis.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  // Clear rate limit keys to avoid interference from other tests
  const redis = getRedisClient();
  const keys = await redis.keys('auth:*');
  if (keys.length) await redis.del(...keys);
});

afterAll(async () => {
  await app.close();
});

describe('Auth Performance Smoke Tests', () => {
  const iterations = 5;

  it(`POST /api/auth/login should respond in < 500ms p95 (${iterations} iterations)`, async () => {
    // Register a user first
    const email = `perf-login-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Perf User', email, password: 'password1' },
    });

    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'password1', rememberMe: false },
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];

    // bcrypt cost 12 means ~200-250ms per hash comparison is normal
    console.log(`Login p95: ${p95.toFixed(1)}ms (min: ${times[0].toFixed(1)}ms, max: ${times[times.length - 1].toFixed(1)}ms)`);
    expect(p95).toBeLessThan(500);
  });

  it('GET /api/auth/me should respond in < 50ms p95', async () => {
    // Clear rate limits again to avoid interference from parallel test files
    const redis = getRedisClient();
    const keys = await redis.keys('auth:*');
    if (keys.length) await redis.del(...keys);

    const email = `perf-me-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Perf Me', email, password: 'password1' },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password1', rememberMe: false },
    });

    const accessCookie = loginRes.cookies.find((c: { name: string }) => c.name === 'access_token');
    expect(accessCookie).toBeDefined();

    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { access_token: accessCookie!.value },
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];

    console.log(`GET /me p95: ${p95.toFixed(1)}ms (min: ${times[0].toFixed(1)}ms, max: ${times[times.length - 1].toFixed(1)}ms)`);
    expect(p95).toBeLessThan(50);
  });
});
