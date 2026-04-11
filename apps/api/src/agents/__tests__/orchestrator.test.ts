import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock prisma before imports
vi.mock('../../lib/prisma.js', () => ({
  default: {
    project: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    agent: {
      upsert: vi.fn().mockResolvedValue({ id: 'agent-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    projectSpec: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    generatedFile: {
      upsert: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    agentLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    verificationCheckpoint: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock base-agent
vi.mock('../../agents/base-agent.js', () => ({
  runAgent: vi.fn().mockResolvedValue({
    success: true,
    summary: 'Done',
    tokensInput: 100,
    tokensOutput: 50,
    filesCreated: ['schema.sql'],
  }),
}));

// Mock context-builder
vi.mock('../../agents/context-builder.js', () => ({
  buildTaskPrompt: vi.fn().mockResolvedValue('task prompt'),
}));

// Mock WS emitter
vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: vi.fn(),
  buildEvent: vi.fn().mockReturnValue({}),
}));

// Mock batch-verifier
const mockVerifyBatchOutput = vi.fn().mockResolvedValue({ status: 'pass', details: [] });
vi.mock('../../agents/batch-verifier.js', () => ({
  verifyBatchOutput: (...args: unknown[]) => mockVerifyBatchOutput(...args),
}));

// Mock redis (dynamic import in orchestrator)
vi.mock('redis', () => ({
  createClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null), // not paused by default
    disconnect: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock fs to avoid filesystem ops
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('skill prompt content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
  },
}));

import prisma from '../../lib/prisma.js';
import { runAgent } from '../../agents/base-agent.js';

describe('orchestrator — runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not paused, no completed agents
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (runAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      summary: 'Done',
      tokensInput: 100,
      tokensOutput: 50,
      filesCreated: ['schema.sql'],
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('updates project status to running then done', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('project-1', 'user-1');

    const updateCalls = (prisma.project.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'running')).toBe(true);
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'done')).toBe(true);
  });

  it('runs all 10 layers (including planner) when no layers are completed', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('project-1', 'user-1');

    // runAgent called 10 times (one per layer including planner at L0)
    expect(runAgent).toHaveBeenCalledTimes(10);
  });

  it('skips completed layers on retry (T031)', async () => {
    // Simulate 2 completed agents (dba-agent layer=1, seed-agent layer=1.5)
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { layer: 1 },
      { layer: 1.5 },
    ]);

    // Re-import to get fresh module (clear module cache effect via vi.resetModules)
    vi.resetModules();
    // Re-mock after reset
    vi.mock('../../lib/prisma.js', () => ({
      default: {
        project: { update: vi.fn().mockResolvedValue({}) },
        agent: {
          upsert: vi.fn().mockResolvedValue({ id: 'agent-1' }),
          findMany: vi.fn().mockResolvedValue([{ layer: 1 }, { layer: 1.5 }]),
        },
        projectSpec: { findFirst: vi.fn().mockResolvedValue(null) },
        generatedFile: { upsert: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
        agentLog: { create: vi.fn().mockResolvedValue({}) },
        verificationCheckpoint: { create: vi.fn().mockResolvedValue({}) },
      },
    }));
    vi.mock('../../agents/base-agent.js', () => ({
      runAgent: vi.fn().mockResolvedValue({
        success: true, summary: 'Done', tokensInput: 10, tokensOutput: 5, filesCreated: [],
      }),
    }));
    vi.mock('../../agents/context-builder.js', () => ({
      buildTaskPrompt: vi.fn().mockResolvedValue('task'),
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

    const { runPipeline: runPipeline2 } = await import('../../agents/orchestrator.js');
    const { runAgent: runAgent2 } = await import('../../agents/base-agent.js');
    await runPipeline2('project-2', 'user-1');

    // Should only run 8 remaining layers (10 - 2 completed)
    expect(runAgent2).toHaveBeenCalledTimes(8);
  });

  it('sets project to error status when a layer fails', async () => {
    (runAgent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Claude API error'));

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await expect(runPipeline('project-err', 'user-1')).rejects.toThrow('Claude API error');

    const updateCalls = (prisma.project.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'error')).toBe(true);
  });
});

describe('orchestrator — getProjectDir', () => {
  it('returns a path that includes the projectId', async () => {
    vi.resetModules();
    const { getProjectDir } = await import('../../agents/orchestrator.js');
    expect(getProjectDir('abc-123')).toContain('abc-123');
  });
});

describe('orchestrator — composeSystemPrompt', () => {
  it('composes shared skills before agent system.md in correct order', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const sharedSkills = ['# Shared Skill: Conventions\n...', '# Shared Skill: Anti-Patterns\n...', '# Shared Skill: Output Format\n...'];
    const agentSystem = '# DBA Agent\nYou are a DBA.';
    const result = composeSystemPrompt(sharedSkills, agentSystem);

    // Conventions comes first
    expect(result.indexOf('# Shared Skill: Conventions')).toBeLessThan(result.indexOf('# Shared Skill: Anti-Patterns'));
    // Anti-patterns before output-format
    expect(result.indexOf('# Shared Skill: Anti-Patterns')).toBeLessThan(result.indexOf('# Shared Skill: Output Format'));
    // Output-format before agent system.md
    expect(result.indexOf('# Shared Skill: Output Format')).toBeLessThan(result.indexOf('# DBA Agent'));
  });

  it('preserves all agent-specific content after composition', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const sharedSkills = ['shared content'];
    const agentSystem = 'agent-specific: rate-limiting, auth-middleware, unique-logic';
    const result = composeSystemPrompt(sharedSkills, agentSystem);

    expect(result).toContain('agent-specific: rate-limiting, auth-middleware, unique-logic');
    expect(result).toContain('shared content');
  });

  it('works with empty sharedSkills array (graceful fallback)', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const agentSystem = 'just the agent';
    const result = composeSystemPrompt([], agentSystem);
    expect(result).toBe('just the agent');
  });

  it('loadSharedSkills reads exactly 3 files in conventions → anti-patterns → output-format order', async () => {
    const { loadSharedSkills } = await import('../../agents/orchestrator.js');
    const results = await loadSharedSkills();

    // Returns 3 strings
    expect(results).toHaveLength(3);

    // All from the fs mock
    const fsMod = await import('node:fs/promises');
    const readFileMock = fsMod.default.readFile as ReturnType<typeof vi.fn>;
    const paths = readFileMock.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(paths.some((p) => p.includes('conventions.md'))).toBe(true);
    expect(paths.some((p) => p.includes('anti-patterns.md'))).toBe(true);
    expect(paths.some((p) => p.includes('output-format.md'))).toBe(true);
  });
});

describe('orchestrator — appendProjectMemory', () => {
  it('creates memory directory and writes layer section', async () => {
    vi.resetModules();
    const fsMod = await import('node:fs/promises');
    const mkdirMock = fsMod.default.mkdir as ReturnType<typeof vi.fn>;
    const readFileMock = fsMod.default.readFile as ReturnType<typeof vi.fn>;
    const writeFileMock = fsMod.default.writeFile as ReturnType<typeof vi.fn>;

    // First call: memory file doesn't exist yet
    readFileMock.mockRejectedValueOnce(new Error('ENOENT'));

    const { appendProjectMemory } = await import('../../agents/orchestrator.js');
    await appendProjectMemory('/projects/abc', 1, 'dba-agent', 'Schema created.');

    expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining('memory'), { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('project_memory.md'),
      expect.stringContaining('## Layer 1: dba-agent'),
      'utf8',
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Schema created.'),
      'utf8',
    );
  });

  it('appends new section when memory file already exists', async () => {
    vi.resetModules();
    const fsMod = await import('node:fs/promises');
    const readFileMock = fsMod.default.readFile as ReturnType<typeof vi.fn>;
    const writeFileMock = fsMod.default.writeFile as ReturnType<typeof vi.fn>;

    const existing = '\n## Layer 1: dba-agent\n### Summary\nFirst layer.\n';
    readFileMock.mockImplementation((p: unknown) => {
      if (String(p).includes('project_memory.md')) return Promise.resolve(existing);
      return Promise.resolve('skill content');
    });

    const { appendProjectMemory } = await import('../../agents/orchestrator.js');
    await appendProjectMemory('/projects/abc', 2, 'seed-agent', 'Seed data created.');

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('## Layer 2: seed-agent'),
      'utf8',
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Seed data created.'),
      'utf8',
    );
    // Both sections should be in the written content
    const writtenContent = (writeFileMock.mock.calls.at(-1) as unknown[])[1] as string;
    expect(writtenContent).toContain('## Layer 1: dba-agent');
    expect(writtenContent).toContain('## Layer 2: seed-agent');
  });
});

describe('orchestrator — plan:generated event (M10-T011/T013)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.agent.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'agent-1' });
    (prisma.project.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.verificationCheckpoint.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockVerifyBatchOutput.mockResolvedValue({ status: 'pass', details: [] });
    (runAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      summary: 'Done',
      tokensInput: 10,
      tokensOutput: 5,
      filesCreated: [],
    });
  });

  it('emits plan:generated event after planner-agent (layer 0) completes', async () => {
    const { buildEvent } = await import('../../websocket/ws.emitter.js');
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-plan-evt', 'user-1');

    const buildEventMock = buildEvent as ReturnType<typeof vi.fn>;
    const planCalls = buildEventMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'plan:generated',
    );
    expect(planCalls).toHaveLength(1);
    expect(planCalls[0][1]).toBe('proj-plan-evt');
  });
});

describe('orchestrator — TDD skill injection (M10-T015/T018)', () => {
  it('composeSystemPrompt includes extraSkills for TDD layers', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const sharedSkills = ['# Conventions'];
    const agentSystem = '# Backend Agent';
    const tddSkill = '# TDD Methodology\nRED-GREEN-REFACTOR';

    const result = composeSystemPrompt(sharedSkills, agentSystem, [tddSkill]);

    expect(result).toContain('# TDD Methodology');
    expect(result).toContain('RED-GREEN-REFACTOR');
    // TDD skill should be between shared skills and agent system
    expect(result.indexOf('# Conventions')).toBeLessThan(result.indexOf('# TDD Methodology'));
    expect(result.indexOf('# TDD Methodology')).toBeLessThan(result.indexOf('# Backend Agent'));
  });

  it('composeSystemPrompt does NOT include TDD for non-TDD agents', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const sharedSkills = ['# Conventions'];
    const agentSystem = '# DBA Agent';

    const result = composeSystemPrompt(sharedSkills, agentSystem);

    expect(result).not.toContain('TDD');
    expect(result).toContain('# DBA Agent');
  });

  it('composeSystemPrompt with undefined extraSkills behaves like no extras', async () => {
    const { composeSystemPrompt } = await import('../../agents/orchestrator.js');
    const sharedSkills = ['# Conventions'];
    const agentSystem = '# QA Agent';

    const result = composeSystemPrompt(sharedSkills, agentSystem, undefined);

    expect(result).not.toContain('TDD');
  });

  it('TDD_LAYERS contains only layers 2 and 3', async () => {
    const { TDD_LAYERS } = await import('../../agents/orchestrator.js');
    expect(TDD_LAYERS.has(2)).toBe(true);
    expect(TDD_LAYERS.has(3)).toBe(true);
    expect(TDD_LAYERS.has(0)).toBe(false);
    expect(TDD_LAYERS.has(1)).toBe(false);
    expect(TDD_LAYERS.has(4)).toBe(false);
    expect(TDD_LAYERS.has(7)).toBe(false);
  });
});

describe('orchestrator — verification checkpoints (M10-T020/T024)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.agent.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'agent-1' });
    (prisma.project.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.verificationCheckpoint.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (runAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      summary: 'Done',
      tokensInput: 10,
      tokensOutput: 5,
      filesCreated: [],
    });
    // Default: pass verification
    mockVerifyBatchOutput.mockResolvedValue({ status: 'pass', details: [] });
  });

  it('calls verifyBatchOutput after each layer completes', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-verify', 'user-1');

    // Should be called once per layer (10 layers)
    expect(mockVerifyBatchOutput).toHaveBeenCalledTimes(10);
  });

  it('emits checkpoint:result event after verification', async () => {
    const { buildEvent } = await import('../../websocket/ws.emitter.js');
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-ckpt-evt', 'user-1');

    const buildEventMock = buildEvent as ReturnType<typeof vi.fn>;
    const checkpointCalls = buildEventMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'checkpoint:result',
    );
    // One checkpoint event per layer
    expect(checkpointCalls.length).toBe(10);
    expect(checkpointCalls[0][1]).toBe('proj-ckpt-evt');
  });

  it('persists verification checkpoint to database', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-ckpt-db', 'user-1');

    expect(prisma.verificationCheckpoint.create).toHaveBeenCalled();
    const calls = (prisma.verificationCheckpoint.create as ReturnType<typeof vi.fn>).mock.calls;
    // 10 layers = 10 checkpoint records
    expect(calls).toHaveLength(10);
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({
        projectId: 'proj-ckpt-db',
        status: 'pass',
      }),
    );
  });

  it('pauses pipeline on CRITICAL verification failure', async () => {
    // First layer passes, second fails critically
    mockVerifyBatchOutput
      .mockResolvedValueOnce({ status: 'pass', details: [] })
      .mockResolvedValueOnce({
        status: 'fail',
        details: [{ severity: 'CRITICAL', message: 'prisma/schema.prisma not found', file: 'prisma/schema.prisma' }],
      });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await expect(runPipeline('proj-fail', 'user-1')).rejects.toThrow('Verification CRITICAL failure');

    // Project should be set to paused
    const updateCalls = (prisma.project.update as ReturnType<typeof vi.fn>).mock.calls;
    const pausedCall = updateCalls.find(
      (c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'paused',
    );
    expect(pausedCall).toBeDefined();

    // Emit project:paused event
    const { buildEvent } = await import('../../websocket/ws.emitter.js');
    const buildEventMock = buildEvent as ReturnType<typeof vi.fn>;
    const pausedEvents = buildEventMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'project:paused',
    );
    expect(pausedEvents).toHaveLength(1);
  });

  it('continues pipeline on MEDIUM/LOW warnings', async () => {
    mockVerifyBatchOutput.mockResolvedValue({
      status: 'warn',
      details: [{ severity: 'MEDIUM', message: 'File empty', file: 'seed.ts' }],
    });

    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('proj-warn', 'user-1');

    // Pipeline should complete all layers despite warnings
    expect(runAgent).toHaveBeenCalledTimes(10);
    // Project should end as done, not paused
    const updateCalls = (prisma.project.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'done')).toBe(true);
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'paused')).toBe(false);
  });
});
