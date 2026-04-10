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

describe('base-agent — memory monitoring (T25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentUpdate.mockResolvedValue({});
    mockIsShuttingDown.mockReturnValue(false);
  });

  it('emits agent:warning when heap growth exceeds AGENT_MEMORY_WARN_MB', async () => {
    const baseHeap = 100 * 1024 * 1024; // 100MB
    const warnHeap = 400 * 1024 * 1024; // 400MB (+300MB > 200MB threshold)
    let callCount = 0;
    vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      callCount++;
      return {
        heapUsed: callCount <= 1 ? baseHeap : warnHeap,
        heapTotal: 0, rss: 0, external: 0, arrayBuffers: 0,
      };
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'done' }],
    });

    const { emitEvent, buildEvent } = await import('../../websocket/ws.emitter.js') as {
      emitEvent: ReturnType<typeof vi.fn>;
      buildEvent: ReturnType<typeof vi.fn>;
    };

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-mem', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    // buildEvent should have been called with agent:warning at least once
    const warningCall = (buildEvent as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === 'agent:warning',
    );
    expect(warningCall).toBeDefined();

    vi.spyOn(process, 'memoryUsage').mockRestore();
    void emitEvent;
  });

  it('truncates messages when heap growth exceeds AGENT_MEMORY_TRUNCATE_MB', async () => {
    const baseHeap = 100 * 1024 * 1024; // 100MB
    const truncateHeap = 700 * 1024 * 1024; // 700MB (+600MB > 500MB threshold)
    let callCount = 0;
    vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      callCount++;
      return {
        heapUsed: callCount <= 1 ? baseHeap : truncateHeap,
        heapTotal: 0, rss: 0, external: 0, arrayBuffers: 0,
      };
    });

    // 3-turn scenario so there are messages to truncate
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: 'tool_use', id: 'tu-1', name: 'createFile', input: { path: 'a.sql', content: 'x' } }],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: 'tool_use', id: 'tu-2', name: 'taskComplete', input: { summary: 'done' } }],
      });

    const { buildEvent } = await import('../../websocket/ws.emitter.js') as {
      buildEvent: ReturnType<typeof vi.fn>;
    };

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-trunc', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    // agent:warning should have been emitted mentioning truncation
    const truncateCall = (buildEvent as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => typeof c[2] === 'object' && c[2] !== null &&
        typeof (c[2] as { message?: string }).message === 'string' &&
        (c[2] as { message: string }).message.includes('truncat'),
    );
    expect(truncateCall).toBeDefined();

    vi.spyOn(process, 'memoryUsage').mockRestore();
  });
});
