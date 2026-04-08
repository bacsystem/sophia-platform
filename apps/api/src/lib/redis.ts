import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.warn('[Redis] Connection error (fail-open mode):', err.message);
    });
  }
  return redis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until reset
}

/**
 * Check and increment rate limit counter.
 * Fail-open: if Redis is unavailable, allow the request through.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const client = getRedisClient();
    const current = await client.incr(key);

    if (current === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);
    const retryAfter = ttl > 0 ? ttl : windowSeconds;

    if (current > maxAttempts) {
      return { allowed: false, remaining: 0, retryAfter };
    }

    return { allowed: true, remaining: maxAttempts - current, retryAfter: 0 };
  } catch (err) {
    // Fail-open: Redis down → allow request, log warning
    console.warn('[Redis] Rate limit check failed (allowing request):', (err as Error).message);
    return { allowed: true, remaining: maxAttempts, retryAfter: 0 };
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
