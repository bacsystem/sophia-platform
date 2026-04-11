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
const mockBuildEvent = vi.fn().mockImplementation(
  (type: string, _pid: string, data: Record<string, unknown>) => ({ type, ...data }),
);

vi.mock('../../lib/prisma.js', () => ({
  default: {
    project: { update: mockProjectUpdate },
    agent: { upsert: mockAgentUpsert, findMany: mockAgentFindMany, update: vi.fn().mockResolvedValue({}) },
    projectSpec: { findFirst: vi.fn().mockResolvedValue(null) },
    generatedFile: { upsert: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
    verificationCheckpoint: { create: vi.fn().mockResolvedValue({}) },
    pipelineState: { create: vi.fn().mockResolvedValue({ id: 'ps-1' }), update: vi.fn().mockResolvedValue({}) },
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
  buildEvent: (...args: unknown[]) => mockBuildEvent(...args),
}));

vi.mock('../../agents/batch-verifier.js', () => ({
  verifyBatchOutput: vi.fn().mockResolvedValue({ status: 'pass', details: [] }),
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

  it('calls all 10 agents using graph-driven execution', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-graph-1', 'user-1');

    expect(mockRunAgent).toHaveBeenCalledTimes(10);
  });

  it('calls L4 and L4.5 in the same batch (before L5 and L6)', async () => {
    const callLog: number[] = [];
    mockRunAgent.mockImplementation(async (config: { layer: number }) => {
      callLog.push(config.layer);
      return { success: true, summary: 'Done', tokensInput: 10, tokensOutput: 5, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-graph-2', 'user-1');

    expect(callLog).toHaveLength(10);
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
    // Simulate L0, L1, L1.5, L2, L3 already completed
    mockAgentFindMany.mockResolvedValue([
      { layer: 0 }, { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-retry', 'user-1');

    // Should only call 5 remaining agents (L4, L4.5, L5, L6, L7)
    expect(mockRunAgent).toHaveBeenCalledTimes(5);
  });

  it('aborts parallel sibling signal when one batch agent fails (T31)', async () => {
    // Start with L0-L3 already done so we jump straight to L4/L4.5 parallel batch
    mockAgentFindMany.mockResolvedValue([
      { layer: 0 }, { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    let l45Signal: AbortSignal | undefined;

    mockRunAgent.mockImplementation(
      async (opts: { layer: number; batchSignal?: AbortSignal }) => {
        if (opts.layer === 4) throw new Error('L4 failed');
        if (opts.layer === 4.5) {
          l45Signal = opts.batchSignal;
          // Yield to event loop so L4's failure can abort the controller
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          return { success: true, summary: '', tokensInput: 0, tokensOutput: 0, filesCreated: [] };
        }
        return { success: true, summary: '', tokensInput: 0, tokensOutput: 0, filesCreated: [] };
      },
    );

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await expect(runPipeline('proj-abort', 'user-1')).rejects.toThrow('L4 failed');

    // L4.5 should have received batchSignal and it should now be aborted
    expect(l45Signal).toBeDefined();
    expect(l45Signal?.aborted).toBe(true);
  });

  it('emits agent:completed for both L4 and L4.5 in parallel batch (T32)', async () => {
    // Start with L0-L3 done to isolate L4/L4.5 batch
    mockAgentFindMany.mockResolvedValue([
      { layer: 0 }, { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-ws-t32', 'user-1');

    // Both parallel agents should have emitted agent:completed events
    const completedLayers = mockBuildEvent.mock.calls
      .filter(([type]) => type === 'agent:completed')
      .map(([, , data]) => (data as { layer: number }).layer);

    expect(completedLayers).toContain(4);
    expect(completedLayers).toContain(4.5);
  });

  it('retry restarts only the failed layer when sibling already completed (T33)', async () => {
    // Simulate: L0, L1, L1.5, L2, L3, L4 (qa-agent) are done; L4.5 (security) is NOT done (was aborted)
    mockAgentFindMany.mockResolvedValue([
      { layer: 0 }, { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 }, { layer: 4 },
    ]);

    const calledLayers: number[] = [];
    mockRunAgent.mockImplementation(async (opts: { layer: number }) => {
      calledLayers.push(opts.layer);
      return { success: true, summary: '', tokensInput: 0, tokensOutput: 0, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-retry-t33', 'user-1');

    // Only L4.5, L5, L6, L7 should run (not L4 which is already done)
    expect(calledLayers).not.toContain(4);
    expect(calledLayers).toContain(4.5);
    expect(calledLayers).toContain(5);
    expect(calledLayers).toContain(6);
    expect(calledLayers).toContain(7);
    expect(calledLayers).toHaveLength(4);
  });
});

describe('orchestrator — parallel execution timing (T35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildEvent.mockImplementation(
      (type: string, _pid: string, data: Record<string, unknown>) => ({ type, ...data }),
    );
    mockAgentFindMany.mockResolvedValue([]);
    mockAgentUpsert.mockResolvedValue({ id: 'agent-1' });
    mockProjectUpdate.mockResolvedValue({});
  });

  it('L4 and L4.5 start times overlap (parallel execution) (T35)', async () => {
    // Start from L4/L4.5 batch to isolate timing
    mockAgentFindMany.mockResolvedValue([
      { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    const startTimes: Record<number, number> = {};
    const endTimes: Record<number, number> = {};

    mockRunAgent.mockImplementation(async (opts: { layer: number }) => {
      startTimes[opts.layer] = Date.now();
      // 20ms delay simulates async work — long enough for overlap detection
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      endTimes[opts.layer] = Date.now();
      return { success: true, summary: '', tokensInput: 0, tokensOutput: 0, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-timing-t35', 'user-1');

    // L4 and L4.5 must be started before either finishes (overlap)
    expect(startTimes[4]).toBeDefined();
    expect(startTimes[4.5]).toBeDefined();

    // L4.5 starts before L4 ends (parallel — not sequential)
    expect(startTimes[4.5]).toBeLessThan(endTimes[4]);
    // L4 starts before L4.5 ends
    expect(startTimes[4]).toBeLessThan(endTimes[4.5]);
  });

  it('L5 and L6 start times overlap (parallel execution) (T35)', async () => {
    // Start from L5/L6 batch
    mockAgentFindMany.mockResolvedValue([
      { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 }, { layer: 4 }, { layer: 4.5 },
    ]);

    const startTimes: Record<number, number> = {};
    const endTimes: Record<number, number> = {};

    mockRunAgent.mockImplementation(async (opts: { layer: number }) => {
      startTimes[opts.layer] = Date.now();
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      endTimes[opts.layer] = Date.now();
      return { success: true, summary: '', tokensInput: 0, tokensOutput: 0, filesCreated: [] };
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-timing-l56', 'user-1');

    // L5 and L6 must overlap (parallel execution)
    expect(startTimes[5]).toBeDefined();
    expect(startTimes[6]).toBeDefined();
    expect(startTimes[6]).toBeLessThan(endTimes[5]);
    expect(startTimes[5]).toBeLessThan(endTimes[6]);
  });
});
