import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing the service
vi.mock('../../../lib/prisma.js', () => ({
  default: {
    project: {
      findFirst: vi.fn(),
    },
    projectSpec: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/redis.js', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('../../../lib/anthropic.js', () => ({
  getAnthropicClient: vi.fn(),
}));

// Mock fs/promises to avoid filesystem reads in background runGeneration
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('# Mock prompt {project.name}'),
}));

import prisma from '../../../lib/prisma.js';
import { checkRateLimit } from '../../../lib/redis.js';
import {
  startSpecGeneration,
  subscribeToSpecJob,
  getSpec,
  getSpecVersions,
  getSpecVersion,
  updateSpec,
} from '../spec.service.js';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockProject = prisma.project as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
};
const mockSpec = prisma.projectSpec as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_PROJECT = {
  id: 'proj-123',
  userId: 'user-456',
  name: 'Test Project',
  description: 'A detailed description of the test project with more than 20 characters.',
  stack: 'node-nextjs',
  status: 'idle',
  config: { model: 'claude-sonnet-4-6', agents: ['dba', 'backend'] },
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const MOCK_SPEC_ROW = {
  id: 'spec-1',
  projectId: 'proj-123',
  version: 1,
  content: {
    spec: '# Spec content',
    dataModel: '# Data model content',
    apiDesign: '# API design content',
  },
  source: 'generated',
  valid: true,
  createdAt: new Date('2026-01-15'),
};

// ---------------------------------------------------------------------------
// Tests: startSpecGeneration
// ---------------------------------------------------------------------------

describe('startSpecGeneration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: rate limits allow requests
    mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
  });

  it('returns a jobId when project is valid and rate limits pass', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);

    const result = await startSpecGeneration('proj-123', 'user-456');

    expect(result).toHaveProperty('jobId');
    expect(typeof result.jobId).toBe('string');
    expect(result.message).toBe('Generación iniciada');
  });

  it('throws PROJECT_NOT_FOUND when project does not exist', async () => {
    mockProject.findFirst.mockResolvedValueOnce(null);

    await expect(startSpecGeneration('nonexistent', 'user-456')).rejects.toMatchObject({
      message: 'Proyecto no encontrado',
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('throws INVALID_STATE when project status is not idle', async () => {
    mockProject.findFirst.mockResolvedValueOnce({ ...MOCK_PROJECT, status: 'running' });

    await expect(startSpecGeneration('proj-123', 'user-456')).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });

  it('throws DESCRIPTION_TOO_SHORT when description has fewer than 20 chars', async () => {
    mockProject.findFirst.mockResolvedValueOnce({
      ...MOCK_PROJECT,
      description: 'Short',
    });

    await expect(startSpecGeneration('proj-123', 'user-456')).rejects.toMatchObject({
      code: 'DESCRIPTION_TOO_SHORT',
    });
  });

  it('throws GENERATION_LIMIT when project rate limit is exceeded', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    // First call (per-project) → denied
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 120 });

    await expect(startSpecGeneration('proj-123', 'user-456')).rejects.toMatchObject({
      code: 'GENERATION_LIMIT',
    });
  });

  it('throws GENERATION_LIMIT when user daily rate limit is exceeded', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    // First call (per-project) → allowed
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, retryAfter: 0 });
    // Second call (per-user daily) → denied
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 3600 });

    await expect(startSpecGeneration('proj-123', 'user-456')).rejects.toMatchObject({
      code: 'GENERATION_LIMIT',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: subscribeToSpecJob
// ---------------------------------------------------------------------------

describe('subscribeToSpecJob', () => {
  it('returns null when job does not exist', () => {
    const unsubscribe = subscribeToSpecJob('nonexistent-job', 'proj-123', vi.fn());
    expect(unsubscribe).toBeNull();
  });

  it('returns null when jobId belongs to a different project', async () => {
    // Start a real job to get a valid jobId
    mockProject.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });

    const { jobId } = await startSpecGeneration('proj-123', 'user-456');

    // Attempt to subscribe with wrong projectId
    const unsubscribe = subscribeToSpecJob(jobId, 'other-project', vi.fn());
    expect(unsubscribe).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: getSpec
// ---------------------------------------------------------------------------

describe('getSpec', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns spec files when spec exists', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findFirst.mockResolvedValueOnce(MOCK_SPEC_ROW);

    const result = await getSpec('proj-123', 'user-456');

    expect(result.version).toBe(1);
    expect(result.files.spec).toBe('# Spec content');
    expect(result.files.dataModel).toBe('# Data model content');
    expect(result.files.apiDesign).toBe('# API design content');
    expect(result.source).toBe('generated');
    expect(result.valid).toBe(true);
  });

  it('throws PROJECT_NOT_FOUND when user does not own project', async () => {
    mockProject.findFirst.mockResolvedValueOnce(null);

    await expect(getSpec('proj-123', 'wrong-user')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('throws NO_SPEC when project has no spec yet', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findFirst.mockResolvedValueOnce(null);

    await expect(getSpec('proj-123', 'user-456')).rejects.toMatchObject({
      code: 'NO_SPEC',
    });
  });

  it('returns empty strings for missing content fields', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findFirst.mockResolvedValueOnce({
      ...MOCK_SPEC_ROW,
      content: { spec: 'Only spec' }, // missing dataModel and apiDesign
    });

    const result = await getSpec('proj-123', 'user-456');

    expect(result.files.spec).toBe('Only spec');
    expect(result.files.dataModel).toBe('');
    expect(result.files.apiDesign).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: getSpecVersions
// ---------------------------------------------------------------------------

describe('getSpecVersions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty array when no specs exist', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findMany.mockResolvedValueOnce([]);

    const result = await getSpecVersions('proj-123', 'user-456');

    expect(result).toEqual([]);
  });

  it('returns version summaries ordered by version desc', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findMany.mockResolvedValueOnce([
      { version: 2, createdAt: new Date('2026-01-20'), source: 'manual', valid: true },
      { version: 1, createdAt: new Date('2026-01-15'), source: 'generated', valid: false },
    ]);

    const result = await getSpecVersions('proj-123', 'user-456');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ version: 2, source: 'manual', valid: true });
    expect(result[1]).toMatchObject({ version: 1, source: 'generated', valid: false });
  });

  it('throws PROJECT_NOT_FOUND when project not owned by user', async () => {
    mockProject.findFirst.mockResolvedValueOnce(null);

    await expect(getSpecVersions('proj-123', 'wrong-user')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: getSpecVersion
// ---------------------------------------------------------------------------

describe('getSpecVersion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a specific version by number', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findUnique.mockResolvedValueOnce(MOCK_SPEC_ROW);

    const result = await getSpecVersion('proj-123', 1, 'user-456');

    expect(result.version).toBe(1);
    expect(result.files.spec).toBe('# Spec content');
  });

  it('throws VERSION_NOT_FOUND when version does not exist', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    mockSpec.findUnique.mockResolvedValueOnce(null);

    await expect(getSpecVersion('proj-123', 99, 'user-456')).rejects.toMatchObject({
      code: 'VERSION_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: updateSpec
// ---------------------------------------------------------------------------

describe('updateSpec', () => {
  const UPDATE_BODY = {
    files: {
      spec: '# Updated spec',
      dataModel: '# Updated data model',
      apiDesign: '# Updated API design',
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a new manual version and returns it', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    // getNextVersion calls projectSpec.findFirst
    mockSpec.findFirst.mockResolvedValueOnce({ version: 1 });
    mockSpec.create.mockResolvedValueOnce({
      version: 2,
      source: 'manual',
      createdAt: new Date('2026-01-20'),
    });

    const result = await updateSpec('proj-123', 'user-456', UPDATE_BODY);

    expect(result.version).toBe(2);
    expect(result.source).toBe('manual');
    expect(mockSpec.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'manual',
          valid: true,
          version: 2,
        }),
      }),
    );
  });

  it('creates version 1 when no previous spec exists', async () => {
    mockProject.findFirst.mockResolvedValueOnce(MOCK_PROJECT);
    // getNextVersion → no previous spec → version = 1
    mockSpec.findFirst.mockResolvedValueOnce(null);
    mockSpec.create.mockResolvedValueOnce({
      version: 1,
      source: 'manual',
      createdAt: new Date('2026-01-20'),
    });

    const result = await updateSpec('proj-123', 'user-456', UPDATE_BODY);

    expect(result.version).toBe(1);
  });

  it('throws PROJECT_NOT_FOUND when user does not own project', async () => {
    mockProject.findFirst.mockResolvedValueOnce(null);

    await expect(updateSpec('proj-123', 'wrong-user', UPDATE_BODY)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});
