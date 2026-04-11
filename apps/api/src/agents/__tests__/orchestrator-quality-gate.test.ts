/**
 * @description Tests for orchestrator quality gate re-run logic (T39).
 * Isolated file to avoid vi.resetModules() contamination from other orchestrator tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRunAgent = vi.fn();
const mockAgentUpsert = vi.fn().mockResolvedValue({ id: 'agent-qa' });
const mockAgentFindMany = vi.fn().mockResolvedValue([]);
const mockProjectUpdate = vi.fn().mockResolvedValue({});
const mockReadFile = vi.fn();
const mockEmitEvent = vi.fn();
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
  },
}));

vi.mock('../../agents/base-agent.js', () => ({
  runAgent: mockRunAgent,
}));

vi.mock('../../agents/context-builder.js', () => ({
  buildTaskPrompt: vi.fn().mockResolvedValue('base qa task prompt'),
}));

vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
  buildEvent: (...args: unknown[]) => mockBuildEvent(...args),
}));

vi.mock('../../agents/batch-verifier.js', () => ({
  verifyBatchOutput: vi.fn().mockResolvedValue({ status: 'pass', details: [] }),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
  },
}));

describe('orchestrator — quality gate re-run logic (T39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentFindMany.mockResolvedValue([
      { layer: 1 }, { layer: 1.5 }, { layer: 2 }, { layer: 3 },
    ]);

    let mappingReads = 0;
    mockReadFile.mockImplementation((p: unknown) => {
      const fp = typeof p === 'string' ? p : '';
      if (fp.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      if (fp.includes('spec.md')) {
        return Promise.resolve(`### HU-14 — Create project\n\n- [ ] User can create a project\n- [ ] Duplicate names are rejected`);
      }
      if (fp.includes('test-mapping.json')) {
        mappingReads += 1;
        if (mappingReads === 1) {
          return Promise.resolve(JSON.stringify({
            mappings: [
              { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: 'creates project', type: 'unit' },
              { criteriaId: 'HU-14.CA-02', testFile: null, testName: null, type: null },
            ],
          }));
        }
        return Promise.resolve(JSON.stringify({
          mappings: [
            { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: 'creates project', type: 'unit' },
            { criteriaId: 'HU-14.CA-02', testFile: 'src/__tests__/project.test.ts', testName: 'rejects duplicates', type: 'integration' },
          ],
        }));
      }
      return Promise.resolve('skill content');
    });

    mockRunAgent.mockImplementation(async (opts: { layer: number; taskPrompt: string }) => ({
      success: true,
      summary: opts.layer === 4 ? 'QA done' : 'Done',
      tokensInput: 10,
      tokensOutput: 5,
      filesCreated: opts.layer === 4 ? ['test-mapping.json'] : [],
    }));
  });

  it('re-runs QA with uncovered criteria when coverage is below threshold and emits quality:gate', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-quality-gate', 'user-1');

    const qaCalls = mockRunAgent.mock.calls.filter(
      (call) => (call[0] as { layer?: number }).layer === 4,
    );
    expect(qaCalls).toHaveLength(2);
    expect(qaCalls[1]?.[0].taskPrompt).toContain('HU-14.CA-02');
    expect(qaCalls[1]?.[0].taskPrompt).toContain('Quality Gate Retry');

    const eventTypes = mockBuildEvent.mock.calls.map(([type]) => type);
    expect(eventTypes).toContain('quality:gate');
  });

  it('fails the pipeline after max 2 QA re-runs if coverage never reaches threshold', async () => {
    mockReadFile.mockImplementation((p: unknown) => {
      const fp = typeof p === 'string' ? p : '';
      if (fp.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      if (fp.includes('spec.md')) {
        return Promise.resolve(`### HU-14 — Create project\n\n- [ ] User can create a project\n- [ ] Duplicate names are rejected`);
      }
      if (fp.includes('test-mapping.json')) {
        return Promise.resolve(JSON.stringify({
          mappings: [
            { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: 'creates project', type: 'unit' },
            { criteriaId: 'HU-14.CA-02', testFile: null, testName: null, type: null },
          ],
        }));
      }
      return Promise.resolve('skill content');
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await expect(runPipeline('proj-quality-gate-fail', 'user-1')).rejects.toThrow(/Quality gate failed/i);

    const qaCalls = mockRunAgent.mock.calls.filter(
      (call) => (call[0] as { layer?: number }).layer === 4,
    );
    expect(qaCalls).toHaveLength(3); // initial run + 2 retries
  });
});
