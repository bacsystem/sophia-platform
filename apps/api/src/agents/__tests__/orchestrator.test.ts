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
    generatedFile: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    agentLog: {
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

  it('updates project status to generating then completed', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('project-1', 'user-1');

    const updateCalls = (prisma.project.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'generating')).toBe(true);
    expect(updateCalls.some((c: unknown[]) => (c[0] as { data: { status: string } }).data.status === 'completed')).toBe(true);
  });

  it('runs all 9 layers when no layers are completed', async () => {
    const { runPipeline } = await import('../../agents/orchestrator.js');
    await runPipeline('project-1', 'user-1');

    // runAgent called 9 times (one per layer)
    expect(runAgent).toHaveBeenCalledTimes(9);
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
        generatedFile: { upsert: vi.fn().mockResolvedValue({}) },
        agentLog: { create: vi.fn().mockResolvedValue({}) },
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
        stat: vi.fn().mockResolvedValue({ size: 100 }),
      },
    }));

    const { runPipeline: runPipeline2 } = await import('../../agents/orchestrator.js');
    const { runAgent: runAgent2 } = await import('../../agents/base-agent.js');
    await runPipeline2('project-2', 'user-1');

    // Should only run 7 remaining layers (9 - 2 completed)
    expect(runAgent2).toHaveBeenCalledTimes(7);
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
