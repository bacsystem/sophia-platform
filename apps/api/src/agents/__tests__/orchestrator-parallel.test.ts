/**
 * @description Tests for graph-driven parallel execution in orchestrator (T29/T34).
 * Isolated from orchestrator.test.ts to avoid vi.resetModules() contamination.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunAgent = vi.fn();
const mockAgentUpsert = vi.fn().mockResolvedValue({ id: 'agent-1' });
const mockAgentFindMany = vi.fn().mockResolvedValue([]);
const mockProjectUpdate = vi.fn().mockResolvedValue({});

vi.mock('../../lib/prisma.js', () => ({
  default: {
    project: { update: mockProjectUpdate },
    agent: { upsert: mockAgentUpsert, findMany: mockAgentFindMany, update: vi.fn().mockResolvedValue({}) },
    projectSpec: { findFirst: vi.fn().mockResolvedValue(null) },
    generatedFile: { upsert: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../../agents/base-agent.js', () => ({
  runAgent: mockRunAgent,
}));

vi.mock('../../agents/context-builder.js', () => ({
  buildTaskPrompt: vi.fn().mockResolvedValue('task prompt'),
}));

vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: vi.fn(),
  buildEvent: vi.fn().mockReturnValue({}),
}));

vi.mock('redis', () => ({
  createClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('skill content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('orchestrator — graph-driven parallel execution (T29/T34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentFindMany.mockResolvedValue([]);
    mockAgentUpsert.mockResolvedValue({ id: 'agent-1' });
    mockProjectUpdate.mockResolvedValue({});
    mockRunAgent.mockResolvedValue({
      success: true,
      summary: 'Done',
      tokensInput: 10,
      tokensOutput: 5,
      filesCreated: [],
    });
  });

  it('calls all 9 agents using graph-driven execution', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-graph-1', 'user-1');

    expect(mockRunAgent).toHaveBeenCalledTimes(9);
  });

  it('calls L4 and L4.5 in the same batch (before L5 and L6)', async () => {
    const callLog: number[] = [];
    mockRunAgent.mockImplementation(async (config: { layer: number }) => {
      callLog.push(config.layer);
      return { success: true, summary: 'Done', tokensInput: 10, tokensOutput: 5, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-graph-2', 'user-1');

    expect(callLog).toHaveLength(9);
    expect(callLog).toContain(4);
    expect(callLog).toContain(4.5);

    // L5 and L6 must start only after BOTH L4 and L4.5 have been called
    const lastOf4or45 = Math.max(callLog.lastIndexOf(4), callLog.lastIndexOf(4.5));
    expect(callLog.indexOf(5)).toBeGreaterThan(lastOf4or45);
    expect(callLog.indexOf(6)).toBeGreaterThan(lastOf4or45);
  });

  it('calls L5 and L6 in the same batch (before L7)', async () => {
    const callLog: number[] = [];
    mockRunAgent.mockImplementation(async (config: { layer: number }) => {
      callLog.push(config.layer);
      return { success: true, summary: 'Done', tokensInput: 10, tokensOutput: 5, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-graph-3', 'user-1');

    // L7 must start after BOTH L5 and L6 have been called
    const lastOf5or6 = Math.max(callLog.lastIndexOf(5), callLog.lastIndexOf(6));
    expect(callLog.indexOf(7)).toBeGreaterThan(lastOf5or6);
  });

  it('skips completed layers and starts from next ready batch', async () => {
    // Simulate L1, L1.5, L2, L3 already completed
    mockAgentFindMany.mockResolvedValue([
      { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-retry', 'user-1');

    // Should only call 5 remaining agents (L4, L4.5, L5, L6, L7)
    expect(mockRunAgent).toHaveBeenCalledTimes(5);
  });
});
