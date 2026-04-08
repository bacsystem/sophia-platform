import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '../encryption.service.js';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('encrypt / decrypt roundtrip', () => {
  it('decrypts back to original plaintext', () => {
    const plaintext = 'my-secret-api-key';
    const { encrypted, iv, tag } = encrypt(plaintext);
    const result = decrypt(encrypted, iv, tag);
    expect(result).toBe(plaintext);
  });

  it('produces unique ciphertext for each call (random IV)', () => {
    const plaintext = 'same-input';
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);
    expect(first.iv).not.toBe(second.iv);
    expect(first.encrypted).not.toBe(second.encrypted);
  });

  it('returns hex strings for all outputs', () => {
    const { encrypted, iv, tag } = encrypt('test');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(iv).toMatch(/^[0-9a-f]+$/);
    expect(tag).toMatch(/^[0-9a-f]+$/);
  });

  it('iv is 24 hex chars (12 bytes)', () => {
    const { iv } = encrypt('test');
    expect(iv.length).toBe(24); // 12 bytes × 2 hex chars
  });

  it('tag is 32 hex chars (16 bytes)', () => {
    const { tag } = encrypt('test');
    expect(tag.length).toBe(32); // 16 bytes × 2 hex chars
  });
});

describe('decrypt — error cases', () => {
  it('throws when tag is tampered', () => {
    const { encrypted, iv } = encrypt('sensitive');
    const badTag = 'ff'.repeat(16); // wrong tag
    expect(() => decrypt(encrypted, iv, badTag)).toThrow();
  });

  it('throws when ciphertext is tampered', () => {
    const { iv, tag } = encrypt('sensitive');
    const badCipher = 'aa'.repeat(10);
    expect(() => decrypt(badCipher, iv, tag)).toThrow();
  });
});

describe('encrypt — invalid key', () => {
  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });
});
