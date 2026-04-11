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

import fs from 'node:fs/promises';

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

describe('orchestrator — QA diagnostic retry (M10-T029)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate layers 1-3 completed, QA (layer 4) pending
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
      filesCreated: opts.layer === 4 ? ['test-mapping.json', 'src/__tests__/project.test.ts'] : [],
    }));
  });

  it('includes diagnostic context (files involved) in QA retry prompt', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-diag-ctx', 'user-1');

    const qaCalls = mockRunAgent.mock.calls.filter(
      (call) => (call[0] as { layer?: number }).layer === 4,
    );
    // At least 2 calls (initial + retry)
    expect(qaCalls.length).toBeGreaterThanOrEqual(2);
    // Retry prompt should contain files from previous attempt
    const retryPrompt = (qaCalls[1]?.[0] as { taskPrompt: string }).taskPrompt;
    expect(retryPrompt).toContain('Archivos involucrados');
    expect(retryPrompt).toContain('test-mapping.json');
  });

  it('injects investigating-test-failures skill in retry system prompt', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-inv-skill', 'user-1');

    const qaCalls = mockRunAgent.mock.calls.filter(
      (call) => (call[0] as { layer?: number }).layer === 4,
    );
    expect(qaCalls.length).toBeGreaterThanOrEqual(2);
    // Retry system prompt should include the investigation skill content
    const retrySystemPrompt = (qaCalls[1]?.[0] as { systemPrompt: string }).systemPrompt;
    expect(retrySystemPrompt).toContain('skill content');
    // The original system prompt is also present
    expect(retrySystemPrompt.split('---').length).toBeGreaterThan(1);
  });

  it('generates investigation-report.md after MAX_QA_RERUNS exhausted', async () => {
    // Always fail coverage
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
    await expect(runPipeline('proj-inv-report', 'user-1')).rejects.toThrow(/Quality gate failed/i);

    // investigation-report.md should be written
    const writeCalls = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = writeCalls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('investigation-report.md'),
    );
    expect(reportCall).toBeDefined();
    expect(reportCall![1]).toContain('HU-14.CA-02');

    // qa:investigation-report event emitted
    const reportEvents = mockBuildEvent.mock.calls.filter(
      (c: unknown[]) => c[0] === 'qa:investigation-report',
    );
    expect(reportEvents).toHaveLength(1);
    expect(reportEvents[0][2]).toEqual(
      expect.objectContaining({ reportPath: 'qa/investigation-report.md' }),
    );
  });
});
