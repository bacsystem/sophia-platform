import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing service
vi.mock('../../../lib/prisma.js', () => ({
  default: {
    template: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../../lib/prisma.js';
import { listTemplates } from '../template.service.js';

const mockPrisma = prisma as unknown as {
  template: { findMany: ReturnType<typeof vi.fn> };
};

const MOCK_TEMPLATES = [
  {
    id: 'tmpl-1',
    name: 'SaaS Dashboard',
    description: 'Template para aplicaciones SaaS',
    icon: 'Building2',
    stack: 'node-nextjs',
    tags: ['saas', 'dashboard'],
    defaults: { model: 'claude-sonnet-4-6', agents: ['dba', 'backend', 'frontend'] },
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'tmpl-2',
    name: 'MVP Startup',
    description: 'Template para startups',
    icon: 'Rocket',
    stack: 'node-nextjs',
    tags: ['mvp', 'startup'],
    defaults: { model: 'claude-haiku-4-5', agents: ['dba', 'backend', 'frontend'] },
    createdAt: new Date('2026-01-02'),
  },
];

describe('listTemplates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns all templates in correct shape', async () => {
    mockPrisma.template.findMany.mockResolvedValueOnce(MOCK_TEMPLATES);

    const result = await listTemplates();

    expect(result).toEqual({
      data: [
        {
          id: 'tmpl-1',
          name: 'SaaS Dashboard',
          description: 'Template para aplicaciones SaaS',
          icon: 'Building2',
          stack: 'node-nextjs',
          tags: ['saas', 'dashboard'],
          defaults: { model: 'claude-sonnet-4-6', agents: ['dba', 'backend', 'frontend'] },
        },
        {
          id: 'tmpl-2',
          name: 'MVP Startup',
          description: 'Template para startups',
          icon: 'Rocket',
          stack: 'node-nextjs',
          tags: ['mvp', 'startup'],
          defaults: { model: 'claude-haiku-4-5', agents: ['dba', 'backend', 'frontend'] },
        },
      ],
    });
  });

  it('queries templates ordered by createdAt ascending', async () => {
    mockPrisma.template.findMany.mockResolvedValueOnce([]);

    await listTemplates();

    expect(mockPrisma.template.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns empty data array when no templates exist', async () => {
    mockPrisma.template.findMany.mockResolvedValueOnce([]);

    const result = await listTemplates();

    expect(result).toEqual({ data: [] });
  });

  it('propagates database errors', async () => {
    mockPrisma.template.findMany.mockRejectedValueOnce(new Error('DB error'));

    await expect(listTemplates()).rejects.toThrow('DB error');
  });
});
