import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing service
vi.mock('../../../lib/prisma.js', () => {
  const mockProject = {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  return {
    default: {
      project: mockProject,
      $transaction: vi.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    },
  };
});

import prisma from '../../../lib/prisma.js';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  startProject,
  pauseProject,
  continueProject,
} from '../project.service.js';

const mockPrisma = prisma as unknown as {
  project: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const MOCK_PROJECT = {
  id: 'proj-1',
  userId: 'user-1',
  name: 'Test Project',
  description: 'A test project description with enough characters.',
  stack: 'node-nextjs',
  status: 'idle',
  progress: 0,
  currentLayer: 1,
  config: { model: 'claude-sonnet-4-6', agents: ['dba', 'seed', 'backend', 'security', 'integration'] },
  tokensUsed: 0,
  errorMessage: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const CREATE_INPUT = {
  name: 'Test Project',
  description: 'A test project description with enough characters.',
  stack: 'node-nextjs' as const,
  config: {
    model: 'claude-sonnet-4-6' as const,
    agents: ['dba', 'seed', 'backend', 'security', 'integration'] as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createProject', () => {
  it('creates a project and returns formatted DTO', async () => {
    mockPrisma.project.create.mockResolvedValue(MOCK_PROJECT);
    const result = await createProject('user-1', CREATE_INPUT);

    expect(mockPrisma.project.create).toHaveBeenCalledOnce();
    expect(result).toHaveProperty('id', 'proj-1');
    expect(result).toHaveProperty('currentLayerName', 'Database');
    expect(result).not.toHaveProperty('deletedAt');
  });
});

describe('listProjects', () => {
  it('returns paginated list with meta', async () => {
    mockPrisma.$transaction.mockResolvedValue([[MOCK_PROJECT], 1]);
    const result = await listProjects('user-1', { page: 1, limit: 12 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.pages).toBe(1);
  });
});

describe('getProject', () => {
  it('returns project with spec when found', async () => {
    const spec = { id: 'spec-1', version: 1, content: { title: 'spec' }, createdAt: new Date(), projectId: 'proj-1' };
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, specs: [spec] });

    const result = await getProject('user-1', 'proj-1');
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.data.id).toBe('proj-1');
      expect(result.data.spec).toBeTruthy();
    }
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const result = await getProject('user-1', 'missing');
    expect(result).toHaveProperty('error', 'NOT_FOUND');
    expect(result).toHaveProperty('status', 404);
  });

  it('returns 403 when project belongs to another user', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, userId: 'other-user', specs: [] });
    const result = await getProject('user-1', 'proj-1');
    expect(result).toHaveProperty('error', 'FORBIDDEN');
    expect(result).toHaveProperty('status', 403);
  });
});

describe('updateProject', () => {
  it('updates name when project is idle', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, name: 'Updated' });

    const result = await updateProject('user-1', 'proj-1', { name: 'Updated' });
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.data.name).toBe('Updated');
    }
  });

  it('returns 400 PROJECT_NOT_EDITABLE when not idle', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });
    const result = await updateProject('user-1', 'proj-1', { name: 'X' });
    expect(result).toHaveProperty('error', 'PROJECT_NOT_EDITABLE');
    expect(result).toHaveProperty('status', 400);
  });
});

describe('deleteProject', () => {
  it('soft-deletes a non-running project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, deletedAt: new Date() });

    const result = await deleteProject('user-1', 'proj-1');
    expect(result).not.toHaveProperty('error');
    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    });
  });

  it('returns 400 CANNOT_DELETE_RUNNING when project is running', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });
    const result = await deleteProject('user-1', 'proj-1');
    expect(result).toHaveProperty('error', 'CANNOT_DELETE_RUNNING');
    expect(result).toHaveProperty('status', 400);
  });
});

describe('State transitions', () => {
  it('startProject: idle → running', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });

    const result = await startProject('user-1', 'proj-1');
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.data.status).toBe('running');
    }
  });

  it('startProject: running → INVALID_STATE_TRANSITION', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });
    const result = await startProject('user-1', 'proj-1');
    expect(result).toHaveProperty('error', 'INVALID_STATE_TRANSITION');
  });

  it('pauseProject: running → paused', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, status: 'paused' });

    const result = await pauseProject('user-1', 'proj-1');
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.data.status).toBe('paused');
    }
  });

  it('pauseProject: idle → INVALID_STATE_TRANSITION', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    const result = await pauseProject('user-1', 'proj-1');
    expect(result).toHaveProperty('error', 'INVALID_STATE_TRANSITION');
  });

  it('continueProject: paused → running', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, status: 'paused' });
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, status: 'running' });

    const result = await continueProject('user-1', 'proj-1');
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.data.status).toBe('running');
    }
  });
});
