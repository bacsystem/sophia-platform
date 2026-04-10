/**
 * @description Integration test: start pipeline → execute DBA layer → checkpoint → verify files in DB.
 * Uses mocked Anthropic to simulate Claude Tool Use output generating a schema file.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();

// Mock Anthropic client
vi.mock('../../lib/anthropic.js', () => ({
  getAnthropicClient: vi.fn().mockReturnValue({
    messages: { create: mockCreate },
  }),
}));

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  default: {
    project: { update: vi.fn().mockResolvedValue({}) },
    agent: {
      upsert: vi.fn().mockResolvedValue({ id: 'agent-int-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    generatedFile: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
    agentMessage: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    projectSpec: { findFirst: vi.fn().mockResolvedValue({ specDoc: '# Test spec' }) },
  },
}));

// Mock WS emitter
vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: vi.fn(),
  buildEvent: vi.fn().mockReturnValue({}),
}));

let tmpDir: string;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Agent pipeline integration — DBA layer checkpoint', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sophia-int-'));
    process.env.PROJECTS_BASE_DIR = tmpDir;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // Default mock: createFile then taskComplete
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 200, output_tokens: 100 },
        content: [
          { type: 'text', text: 'Creating schema file...' },
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'createFile',
            input: { path: 'schema.sql', content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);' },
          },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        usage: { input_tokens: 50, output_tokens: 20 },
        content: [
          {
            type: 'tool_use',
            id: 'tool-2',
            name: 'taskComplete',
            input: { summary: 'DBA layer complete: schema.sql created' },
          },
        ],
      });
  });

  afterEach(async () => {
    delete process.env.PROJECTS_BASE_DIR;
    delete process.env.ANTHROPIC_API_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs DBA layer and creates schema.sql in project directory', async () => {
    const { runAgent } = await import('../../agents/base-agent.js');
    const projectDir = path.join(tmpDir, 'project-int-1');
    await fs.mkdir(projectDir, { recursive: true });

    const result = await runAgent({
      agentId: 'agent-int-1',
      projectId: 'project-int-1',
      agentType: 'dba-agent',
      layer: 1,
      systemPrompt: '# DBA system prompt',
      taskPrompt: '# DBA task: create schema',
      projectDir,
    });

    // Agent should succeed and report the created file
    expect(result.success).toBe(true);
    expect(result.filesCreated).toContain('schema.sql');

    // Verify the file was actually written to disk
    const content = await fs.readFile(path.join(projectDir, 'schema.sql'), 'utf8');
    expect(content).toContain('CREATE TABLE users');
  });

  it('records generated files checkpoint via agent.update in DB', async () => {
    const prisma = (await import('../../lib/prisma.js')).default;
    const { runAgent } = await import('../../agents/base-agent.js');
    const projectDir = path.join(tmpDir, 'project-checkpoint');
    await fs.mkdir(projectDir, { recursive: true });

    await runAgent({
      agentId: 'agent-int-1',
      projectId: 'project-int-1',
      agentType: 'dba-agent',
      layer: 1,
      systemPrompt: '# System',
      taskPrompt: '# Task',
      projectDir,
    });

    // Agent record updated with completed status (checkpoint)
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', progress: 100 }),
      }),
    );
  });

  it('runs both createFile and taskComplete turns before finishing', async () => {
    const { runAgent } = await import('../../agents/base-agent.js');
    const projectDir = path.join(tmpDir, 'project-turns');
    await fs.mkdir(projectDir, { recursive: true });

    await runAgent({
      agentId: 'agent-int-1',
      projectId: 'project-int-1',
      agentType: 'dba-agent',
      layer: 1,
      systemPrompt: '# System',
      taskPrompt: '# Task',
      projectDir,
    });

    // The Anthropic client was called twice (2 turns: createFile, taskComplete)
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

