/**
 * @description Unit tests for base-agent message persistence (T14) and reconstruction (T15).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockAgentMessageCreate = vi.fn().mockResolvedValue({});
const mockAgentMessageFindMany = vi.fn().mockResolvedValue([]);

vi.mock('../../lib/anthropic.js', () => ({
  getAnthropicClient: vi.fn().mockReturnValue({
    messages: { create: mockCreate },
  }),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    agent: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
    agentMessage: {
      create: mockAgentMessageCreate,
      findMany: mockAgentMessageFindMany,
    },
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

describe('base-agent — message persistence (T14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMessageCreate.mockResolvedValue({});
    mockAgentMessageFindMany.mockResolvedValue([]);
  });

  it('persists assistant message after each Claude response', async () => {
    // Claude responds with tool_use then taskComplete
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [
          { type: 'text', text: 'Creating file...' },
          { type: 'tool_use', id: 'tu-1', name: 'createFile', input: { path: 'out.sql', content: 'SELECT 1' } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [
          { type: 'tool_use', id: 'tu-2', name: 'taskComplete', input: { summary: 'done' } },
        ],
      });

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-1', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    // At least 2 assistant messages persisted (one per Claude response)
    const assistantCalls = mockAgentMessageCreate.mock.calls.filter(
      (c) => (c[0] as { data: { role: string } }).data.role === 'assistant',
    );
    expect(assistantCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('persists user tool-result messages after tool execution', async () => {
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [
          { type: 'tool_use', id: 'tu-1', name: 'createFile', input: { path: 'a.sql', content: 'x' } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [
          { type: 'tool_use', id: 'tu-2', name: 'taskComplete', input: { summary: 'done' } },
        ],
      });

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-2', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    const userResultCalls = mockAgentMessageCreate.mock.calls.filter(
      (c) => (c[0] as { data: { role: string } }).data.role === 'user',
    );
    // At least 1 user tool-result message should be persisted
    expect(userResultCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('serializes tool_use content as JSON (round-trip verifiable)', async () => {
    const toolUseBlock = { type: 'tool_use', id: 'tu-99', name: 'createFile', input: { path: 'x.sql', content: 'CREATE TABLE t (id TEXT)' } };
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [toolUseBlock],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: 'tool_use', id: 'tu-100', name: 'taskComplete', input: { summary: 'done' } }],
      });

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-3', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    const firstAssistantCall = mockAgentMessageCreate.mock.calls.find(
      (c) => (c[0] as { data: { role: string } }).data.role === 'assistant',
    );
    expect(firstAssistantCall).toBeDefined();

    const persistedContent = (firstAssistantCall![0] as { data: { content: unknown } }).data.content as unknown[];
    // Content should include the tool_use block
    expect(JSON.stringify(persistedContent)).toContain('tool_use');
    expect(JSON.stringify(persistedContent)).toContain('CREATE TABLE t');
  });

  it('persists with correct agentId and projectId', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'Summary of work done.' }],
    });

    const { runAgent } = await import('../../agents/base-agent.js');
    await runAgent({
      agentId: 'agent-id-xyz', projectId: 'project-id-abc', agentType: 'backend-agent', layer: 2,
      systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
    });

    expect(mockAgentMessageCreate).toHaveBeenCalled();
    const anyCall = mockAgentMessageCreate.mock.calls[0][0] as { data: { agentId: string; projectId: string } };
    expect(anyCall.data.agentId).toBe('agent-id-xyz');
    expect(anyCall.data.projectId).toBe('project-id-abc');
  });

  it('message persistence failure does not crash the agent (fire-and-forget)', async () => {
    mockAgentMessageCreate.mockRejectedValue(new Error('DB connection lost'));
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'done' }],
    });

    const { runAgent } = await import('../../agents/base-agent.js');
    // Should NOT throw even though agentMessage.create fails
    await expect(
      runAgent({
        agentId: 'agent-4', projectId: 'proj-1', agentType: 'dba-agent', layer: 1,
        systemPrompt: 'sys', taskPrompt: 'task', projectDir: '/tmp/proj',
      }),
    ).resolves.toMatchObject({ success: true });
  });
});

describe('base-agent — message reconstruction (T15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMessageCreate.mockResolvedValue({});
    mockAgentMessageFindMany.mockResolvedValue([]);
  });

  it('reconstructMessages returns empty array when no messages in DB', async () => {
    mockAgentMessageFindMany.mockResolvedValue([]);

    const { reconstructMessages } = await import('../../agents/base-agent.js');
    const result = await reconstructMessages('agent-empty');

    expect(result).toEqual([]);
  });

  it('reconstructMessages rebuilds MessageParam array from DB rows', async () => {
    mockAgentMessageFindMany.mockResolvedValue([
      { id: '1', turn: 1, role: 'user', content: 'initial task prompt', tokens: 0, agentId: 'a1', projectId: 'p1', createdAt: new Date() },
      { id: '2', turn: 1, role: 'assistant', content: [{ type: 'text', text: 'Working...' }], tokens: 100, agentId: 'a1', projectId: 'p1', createdAt: new Date() },
    ]);

    const { reconstructMessages } = await import('../../agents/base-agent.js');
    const result = await reconstructMessages('agent-a1');

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
  });

  it('reconstructMessages orders messages by turn ascending', async () => {
    // DB returns in reverse order (ensure we sort by turn)
    mockAgentMessageFindMany.mockResolvedValue([
      { id: '2', turn: 2, role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }], tokens: 0, agentId: 'a1', projectId: 'p1', createdAt: new Date() },
      { id: '1', turn: 1, role: 'user', content: 'first message', tokens: 0, agentId: 'a1', projectId: 'p1', createdAt: new Date() },
    ]);

    const { reconstructMessages } = await import('../../agents/base-agent.js');
    const result = await reconstructMessages('agent-a1');

    expect(result[0].content).toBe('first message');
    expect(result[1].role).toBe('user');
  });
});
