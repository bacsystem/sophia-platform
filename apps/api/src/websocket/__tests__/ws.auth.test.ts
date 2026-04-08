import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const SECRET = 'test-jwt-secret-32-chars-long!!!';

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma.js';
import { authenticateWsRequest, verifyProjectOwnership } from '../ws.auth.js';

function makeRequest(token?: string): { cookies: Record<string, string> } {
  return { cookies: token ? { access_token: token } : {} };
}

describe('authenticateWsRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = SECRET;
  });

  it('returns userId for a valid token and existing user', async () => {
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.com' }, SECRET, { expiresIn: '1h' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' });

    const result = await authenticateWsRequest(makeRequest(token) as never);
    expect(result).toBe('user-1');
  });

  it('throws when access_token cookie is missing', async () => {
    await expect(authenticateWsRequest(makeRequest() as never)).rejects.toThrow(
      'Missing access_token cookie',
    );
  });

  it('throws when token is invalid/expired', async () => {
    await expect(
      authenticateWsRequest(makeRequest('bad.token.value') as never),
    ).rejects.toThrow('Invalid or expired access token');
  });

  it('throws when user does not exist in DB', async () => {
    const token = jwt.sign({ userId: 'ghost', email: 'g@b.com' }, SECRET, { expiresIn: '1h' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(authenticateWsRequest(makeRequest(token) as never)).rejects.toThrow(
      'User not found',
    );
  });

  it('throws when JWT_ACCESS_SECRET is missing', async () => {
    delete process.env.JWT_ACCESS_SECRET;
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.com' }, SECRET);
    await expect(authenticateWsRequest(makeRequest(token) as never)).rejects.toThrow(
      'JWT_ACCESS_SECRET',
    );
  });
});

describe('verifyProjectOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves when user owns the project', async () => {
    (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: 'user-1',
    });
    await expect(verifyProjectOwnership('user-1', 'project-1')).resolves.toBeUndefined();
  });

  it('throws when project does not exist', async () => {
    (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(verifyProjectOwnership('user-1', 'missing')).rejects.toThrow(
      'Project not found or access denied',
    );
  });

  it('throws when project belongs to another user', async () => {
    (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: 'other-user',
    });
    await expect(verifyProjectOwnership('user-1', 'project-1')).rejects.toThrow(
      'Project not found or access denied',
    );
  });
});
