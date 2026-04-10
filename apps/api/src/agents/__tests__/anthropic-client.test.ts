/**
 * T44: Anthropic client concurrency test.
 * Verifies that 2 simultaneous calls on the same singleton instance
 * do not interfere with each other (each receives its own response).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------- Mock SDK --------------------------------------------------------
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// ---------- Helpers ---------------------------------------------------------
function makeResponse(id: string) {
  return {
    id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: `response-${id}` }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

// Stagger responses: req-B resolves first, req-A resolves second
function mockConcurrentResponses() {
  let callCount = 0;
  mockCreate.mockImplementation(() => {
    const idx = ++callCount;
    const delayMs = idx === 1 ? 20 : 5;
    return new Promise((resolve) =>
      setTimeout(() => resolve(makeResponse(`resp-${idx}`)), delayMs),
    );
  });
}

// ---------- Subject under test ----------------------------------------------
// Import after mocks are set up
afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Anthropic client — singleton concurrency (T44)', () => {
  it('returns the same singleton instance on repeated calls', async () => {
    vi.resetModules();
    const { getAnthropicClient } = await import('../../lib/anthropic.js');
    const a = getAnthropicClient();
    const b = getAnthropicClient();
    expect(a).toBe(b);
  });

  it('2 concurrent calls on same singleton each receive correct independent responses', async () => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockConcurrentResponses();

    const { getAnthropicClient } = await import('../../lib/anthropic.js');
    const client = getAnthropicClient();

    const baseParams = {
      model: 'claude-3-5-sonnet-20241022' as const,
      max_tokens: 100,
      messages: [{ role: 'user' as const, content: 'hello' }],
    };

    const [resA, resB] = await Promise.all([
      client.messages.create(baseParams),
      client.messages.create(baseParams),
    ]);

    // Both calls completed successfully
    expect(resA.id).toBeDefined();
    expect(resB.id).toBeDefined();
    // Responses are independent (different IDs)
    expect(resA.id).not.toBe(resB.id);
    // mockCreate was called exactly twice
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('singleton survives concurrent calls that reject — other call still resolves', async () => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';

    let callIdx = 0;
    mockCreate.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.reject(new Error('rate limited'));
      return Promise.resolve(makeResponse('resp-ok'));
    });

    const { getAnthropicClient } = await import('../../lib/anthropic.js');
    const client = getAnthropicClient();

    const baseParams = {
      model: 'claude-3-5-sonnet-20241022' as const,
      max_tokens: 100,
      messages: [{ role: 'user' as const, content: 'hello' }],
    };

    const results = await Promise.allSettled([
      client.messages.create(baseParams),
      client.messages.create(baseParams),
    ]);

    const rejected = results.filter((r) => r.status === 'rejected');
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(rejected).toHaveLength(1);
    expect(fulfilled).toHaveLength(1);
  });
});
