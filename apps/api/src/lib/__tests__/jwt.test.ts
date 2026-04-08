import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, ACCESS_TTL_SECONDS, getRefreshTtlSeconds } from '../jwt.js';

describe('jwt', () => {
  const payload = { sub: 'user-123', email: 'test@test.com', name: 'Test User' };

  describe('signAccessToken / verifyAccessToken', () => {
    it('should sign and verify a valid access token', () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.name).toBe(payload.name);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('should sign and verify a refresh token', () => {
      const token = signRefreshToken('user-123');
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe('user-123');
    });

    it('should throw on invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });
  });

  describe('constants', () => {
    it('should have correct access TTL', () => {
      expect(ACCESS_TTL_SECONDS).toBe(900);
    });

    it('should return 24h for default refresh TTL', () => {
      expect(getRefreshTtlSeconds(false)).toBe(86400);
    });

    it('should return 30d for rememberMe refresh TTL', () => {
      expect(getRefreshTtlSeconds(true)).toBe(2592000);
    });
  });
});
