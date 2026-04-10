/**
 * @description Tests for graceful shutdown state module (T23).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isShuttingDown, setShuttingDown, resetShuttingDown } from '../shutdown-state.js';

describe('shutdown-state (T23)', () => {
  beforeEach(() => {
    resetShuttingDown();
  });

  it('starts as false before any signal', () => {
    expect(isShuttingDown()).toBe(false);
  });

  it('becomes true after setShuttingDown()', () => {
    setShuttingDown();
    expect(isShuttingDown()).toBe(true);
  });

  it('remains true after multiple setShuttingDown() calls (idempotent)', () => {
    setShuttingDown();
    setShuttingDown();
    expect(isShuttingDown()).toBe(true);
  });
});
