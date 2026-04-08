import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, comparePassword, comparePasswordSafe, initDummyHash } from '../hash.js';

describe('hash', () => {
  beforeAll(async () => {
    await initDummyHash();
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash', async () => {
      const hash = await hashPassword('password123');

      expect(hash).toMatch(/^\$2[aby]?\$\d{2}\$/);
      expect(hash).not.toBe('password123');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const hash = await hashPassword('password123');
      const result = await comparePassword('password123', hash);

      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const hash = await hashPassword('password123');
      const result = await comparePassword('wrong', hash);

      expect(result).toBe(false);
    });
  });

  describe('comparePasswordSafe', () => {
    it('should compare correctly with valid hash', async () => {
      const hash = await hashPassword('test123');
      const result = await comparePasswordSafe('test123', hash);

      expect(result).toBe(true);
    });

    it('should use dummy hash when hash is null (timing attack defense)', async () => {
      const result = await comparePasswordSafe('any-password', null);

      expect(result).toBe(false);
    });
  });
});
