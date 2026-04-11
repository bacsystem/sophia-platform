/**
 * @description Tests for orchestrator reading test-mapping.json after QA layer (T38).
 * Isolated file to avoid vi.resetModules() contamination from other orchestrator tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunAgent = vi.fn();
const mockAgentUpsert = vi.fn().mockResolvedValue({ id: 'agent-1' });
const mockAgentFindMany = vi.fn().mockResolvedValue([]);
const mockProjectUpdate = vi.fn().mockResolvedValue({});
const mockReadFile = vi.fn();

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
  buildEvent: vi.fn().mockReturnValue({}),
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
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const VALID_TEST_MAPPING = JSON.stringify({
  mappings: [
    {
      criteriaId: 'HU-14.CA-01',
      testFile: 'src/modules/agents/__tests__/agent.service.test.ts',
      testName: 'runs pipeline in order',
      type: 'unit',
    },
    {
      criteriaId: 'HU-14.CA-02',
      testFile: null,
      testName: null,
      type: null,
    },
  ],
});

describe('orchestrator — reads test-mapping.json after QA layer (T38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentFindMany.mockResolvedValue([
      { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);
    mockAgentUpsert.mockResolvedValue({ id: 'agent-1' });
    mockProjectUpdate.mockResolvedValue({});

    // Default: skill files return content, test-mapping.json returns valid JSON
    mockReadFile.mockImplementation((p: unknown) => {
      const fp = String(p);
      if (fp.includes('test-mapping.json')) return Promise.resolve(VALID_TEST_MAPPING);
      if (fp.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.resolve('skill content');
    });

    mockRunAgent.mockResolvedValue({
      success: true,
      summary: 'Done',
      tokensInput: 10,
      tokensOutput: 5,
      filesCreated: [],
    });
  });

  it('reads test-mapping.json from projectDir after L4 (qa-agent) completes', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-tm-38', 'user-1');

    // test-mapping.json should have been read
    const tmCalls = mockReadFile.mock.calls.filter(([p]: [unknown]) =>
      String(p).includes('test-mapping.json'),
    );
    expect(tmCalls.length).toBeGreaterThan(0);
  });

  it('does not throw when test-mapping.json is missing (non-fatal)', async () => {
    mockReadFile.mockImplementation((p: unknown) => {
      const fp = String(p);
      if (fp.includes('test-mapping.json')) return Promise.reject(new Error('ENOENT'));
      if (fp.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.resolve('skill content');
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await expect(runPipeline('proj-tm-missing', 'user-1')).resolves.not.toThrow();
  });
});
