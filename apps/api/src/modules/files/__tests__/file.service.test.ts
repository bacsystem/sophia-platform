import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => {
  return {
    default: {
      project: {
        findUnique: vi.fn(),
      },
      generatedFile: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

// Mock fs for file content tests
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    default: {
      ...actual,
      stat: vi.fn(),
      readFile: vi.fn(),
      open: vi.fn(),
    },
  };
});

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
  existsSync: vi.fn(() => true),
}));

import prisma from '../../../lib/prisma.js';
import { getProjectForUser, getFileTree, getFileContent } from '../file.service.js';

const mockPrisma = prisma as unknown as {
  project: { findUnique: ReturnType<typeof vi.fn> };
  generatedFile: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

const mockFs = fs as unknown as {
  stat: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
};

const MOCK_USER_ID = 'user-1';
const MOCK_PROJECT_ID = 'proj-1';

describe('file.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectForUser', () => {
    it('returns project when user is owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: MOCK_PROJECT_ID,
        userId: MOCK_USER_ID,
        status: 'done',
        name: 'Test',
      });

      const result = await getProjectForUser(MOCK_PROJECT_ID, MOCK_USER_ID);
      expect(result.id).toBe(MOCK_PROJECT_ID);
    });

    it('throws when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(getProjectForUser(MOCK_PROJECT_ID, MOCK_USER_ID)).rejects.toThrow(
        'Project not found',
      );
    });

    it('throws when user is not owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: MOCK_PROJECT_ID,
        userId: 'other-user',
        status: 'done',
        name: 'Test',
      });

      await expect(getProjectForUser(MOCK_PROJECT_ID, MOCK_USER_ID)).rejects.toThrow(
        'Project not found',
      );
    });
  });

  describe('getFileTree', () => {
    it('builds tree from flat file list', async () => {
      mockPrisma.generatedFile.findMany.mockResolvedValue([
        {
          id: 'f1',
          path: 'src/index.ts',
          name: 'index.ts',
          sizeBytes: 100,
          createdAt: new Date('2026-01-01'),
          agent: { type: 'backend-agent' },
        },
        {
          id: 'f2',
          path: 'src/lib/utils.ts',
          name: 'utils.ts',
          sizeBytes: 200,
          createdAt: new Date('2026-01-01'),
          agent: { type: 'backend-agent' },
        },
        {
          id: 'f3',
          path: 'package.json',
          name: 'package.json',
          sizeBytes: 300,
          createdAt: new Date('2026-01-01'),
          agent: { type: 'dba-agent' },
        },
      ]);

      const result = await getFileTree(MOCK_PROJECT_ID);

      expect(result.totalFiles).toBe(3);
      expect(result.totalSizeBytes).toBe(600);
      expect(result.tree).toHaveLength(2); // src/ and package.json

      const srcDir = result.tree.find((n) => n.name === 'src');
      expect(srcDir?.type).toBe('directory');
      expect(srcDir?.children).toHaveLength(2); // index.ts and lib/

      const libDir = srcDir?.children?.find((n) => n.name === 'lib');
      expect(libDir?.type).toBe('directory');
      expect(libDir?.children).toHaveLength(1); // utils.ts
    });

    it('returns empty tree for project with no files', async () => {
      mockPrisma.generatedFile.findMany.mockResolvedValue([]);

      const result = await getFileTree(MOCK_PROJECT_ID);
      expect(result.totalFiles).toBe(0);
      expect(result.totalSizeBytes).toBe(0);
      expect(result.tree).toHaveLength(0);
    });
  });

  describe('getFileContent', () => {
    it('reads file content from filesystem', async () => {
      mockPrisma.generatedFile.findFirst.mockResolvedValue({
        id: 'f1',
        projectId: MOCK_PROJECT_ID,
        name: 'index.ts',
        path: 'src/index.ts',
        sizeBytes: 50,
        createdAt: new Date('2026-01-01'),
        agent: { type: 'backend-agent' },
      });

      mockFs.stat.mockResolvedValue({ size: 50 });
      mockFs.readFile.mockResolvedValue('const x = 1;\nconst y = 2;\n');

      const result = await getFileContent(MOCK_PROJECT_ID, 'f1');

      expect(result.name).toBe('index.ts');
      expect(result.content).toBe('const x = 1;\nconst y = 2;\n');
      expect(result.lineCount).toBe(3);
      expect(result.truncated).toBe(false);
    });

    it('throws NOT_FOUND when file not in DB', async () => {
      mockPrisma.generatedFile.findFirst.mockResolvedValue(null);

      await expect(getFileContent(MOCK_PROJECT_ID, 'nonexistent')).rejects.toThrow(
        'File not found',
      );
    });

    it('throws FILE_NOT_FOUND when file not on disk', async () => {
      mockPrisma.generatedFile.findFirst.mockResolvedValue({
        id: 'f1',
        projectId: MOCK_PROJECT_ID,
        name: 'missing.ts',
        path: 'src/missing.ts',
        sizeBytes: 50,
        createdAt: new Date('2026-01-01'),
        agent: { type: 'backend-agent' },
      });

      mockFs.stat.mockRejectedValue(new Error('ENOENT'));

      await expect(getFileContent(MOCK_PROJECT_ID, 'f1')).rejects.toThrow(
        'File not found on disk',
      );
    });

    it('prevents path traversal', async () => {
      mockPrisma.generatedFile.findFirst.mockResolvedValue({
        id: 'f1',
        projectId: MOCK_PROJECT_ID,
        name: 'evil.ts',
        path: '../../etc/passwd',
        sizeBytes: 50,
        createdAt: new Date('2026-01-01'),
        agent: { type: 'backend-agent' },
      });

      await expect(getFileContent(MOCK_PROJECT_ID, 'f1')).rejects.toThrow('Invalid file path');
    });
  });
});
