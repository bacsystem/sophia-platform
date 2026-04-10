/**
 * @description Lifecycle resilience tests for base-agent: shutdown check and timeout (T24/T27).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockAgentUpdate = vi.fn().mockResolvedValue({});
const mockIsShuttingDown = vi.fn().mockReturnValue(false);

vi.mock('../../lib/anthropic.js', () => ({
  getAnthropicClient: vi.fn().mockReturnValue({
    messages: { create: mockCreate },
  }),
}));

vi.mock('../../lib/shutdown-state.js', () => ({
  isShuttingDown: mockIsShuttingDown,
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    agent: { update: mockAgentUpdate },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
    agentMessage: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    generatedFile: { upsert: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: vi.fn(),
  buildEvent: vi.fn().mockReturnValue({}),
}));

vi.mock('../../agents/tool-executor.js', () => ({
  executeTool: vi.fn().mockImplementation((name: string) => {
    if (name === 'taskComplete') {
      return Promise.resolve({ done: true, summary: 'done', result: { text: 'completed' } });
    }
    return Promise.resolve({ done: false, result: { text: 'file created' } });
  }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('base-agent — shutdown check (T24)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentUpdate.mockResolvedValue({});
    mockIsShuttingDown.mockReturnValue(false);
  });

  it('exits with paused status when shuttingDown is true before first Claude call', async () => {
    mockIsShuttingDown.mockReturnValue(true);

    const { runAgent } = await import('../../agents/base-agent.js');
    const result = await runAgent({
      agentId: 'agent-shutdown', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    expect(result.success).toBe(false);
    expect(result.summary).toBe('paused');
    // Claude should NOT have been called
    expect(mockCreate).not.toHaveBeenCalled();
    // Agent DB record should be updated with 'paused' status
    expect(mockAgentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'paused' }),
      }),
    );
  });

  it('proceeds normally when shuttingDown is false', async () => {
    mockIsShuttingDown.mockReturnValue(false);
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'done' }],
    });

    const { runAgent } = await import('../../agents/base-agent.js');
    const result = await runAgent({
      agentId: 'agent-ok', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
