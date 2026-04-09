import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => {
  return {
    default: {
      userSettings: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      project: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

// Mock encryption
vi.mock('../../../lib/encryption.service.js', () => ({
  encrypt: vi.fn(() => ({
    encrypted: 'enc-hex',
    iv: 'iv-hex',
    tag: 'tag-hex',
  })),
  decrypt: vi.fn(() => 'sk-ant-api03-decrypted-key'),
}));

// Mock redis
vi.mock('../../../lib/redis.js', () => ({
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 4,
    retryAfter: 0,
  })),
}));

// Mock hash
vi.mock('../../../lib/hash.js', () => ({
  comparePasswordSafe: vi.fn(() => true),
  hashPassword: vi.fn(() => 'hashed-new-password'),
}));

// Mock fetch for Anthropic API verification
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { afterAll } from 'vitest';
afterAll(() => {
  vi.unstubAllGlobals();
});

import prisma from '../../../lib/prisma.js';
import { checkRateLimit } from '../../../lib/redis.js';
import { comparePasswordSafe } from '../../../lib/hash.js';
import {
  getSettings,
  saveApiKey,
  deleteApiKey,
  verifyApiKey,
  getUsage,
  getDailyUsage,
  updateProfile,
  changePassword,
} from '../settings.service.js';

const mockPrisma = prisma as unknown as {
  userSettings: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  project: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
};

const USER_ID = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

describe('getSettings', () => {
  it('returns api key status and profile', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      anthropicApiKeyLast4: 'ab12',
      apiKeyVerifiedAt: new Date('2026-04-01'),
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
    });

    const result = await getSettings(USER_ID);

    expect(result.data.apiKey.configured).toBe(true);
    expect(result.data.apiKey.last4).toBe('ab12');
    expect(result.data.profile.name).toBe('Test User');
    expect(result.data.profile.email).toBe('test@example.com');
  });

  it('returns configured=false when no settings', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      name: 'User',
      email: 'u@e.com',
    });

    const result = await getSettings(USER_ID);

    expect(result.data.apiKey.configured).toBe(false);
    expect(result.data.apiKey.last4).toBeNull();
  });
});

describe('saveApiKey', () => {
  it('encrypts and stores the api key', async () => {
    mockPrisma.userSettings.upsert.mockResolvedValue({});

    const result = await saveApiKey(USER_ID, {
      apiKey: 'sk-ant-api03-' + 'a'.repeat(95),
    });

    expect(result).toHaveProperty('data');
    if ('data' in result) {
      expect(result.data.configured).toBe(true);
      expect(result.data.last4).toHaveLength(4);
    }
    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledOnce();
  });

  it('returns rate limit error when exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 3500,
    });

    const result = await saveApiKey(USER_ID, {
      apiKey: 'sk-ant-api03-' + 'a'.repeat(95),
    });

    expect('error' in result && result.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('returns error when Anthropic verification fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await saveApiKey(USER_ID, {
      apiKey: 'sk-ant-api03-' + 'a'.repeat(95),
    });

    expect('error' in result && result.error).toBe('API_KEY_VERIFICATION_FAILED');
  });
});

describe('deleteApiKey', () => {
  it('clears encrypted fields', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      anthropicApiKeyEncrypted: 'some-enc',
    });
    mockPrisma.userSettings.update.mockResolvedValue({});

    const result = await deleteApiKey(USER_ID);

    expect(result).toHaveProperty('data');
    expect(mockPrisma.userSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anthropicApiKeyEncrypted: null,
          anthropicApiKeyLast4: null,
        }),
      }),
    );
  });

  it('returns 404 when no key configured', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);

    const result = await deleteApiKey(USER_ID);

    expect('error' in result && result.error).toBe('NO_API_KEY');
  });
});

describe('verifyApiKey', () => {
  it('calls Anthropic and updates verifiedAt', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      anthropicApiKeyEncrypted: 'enc',
      anthropicApiKeyIv: 'iv',
      anthropicApiKeyTag: 'tag',
    });
    mockPrisma.userSettings.update.mockResolvedValue({});

    const result = await verifyApiKey(USER_ID);

    expect(result).toHaveProperty('data');
    if ('data' in result) {
      expect(result.data.valid).toBe(true);
    }
  });

  it('returns 404 when no key stored', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);

    const result = await verifyApiKey(USER_ID);

    expect('error' in result && result.error).toBe('NO_API_KEY');
  });
});

describe('getUsage', () => {
  it('aggregates tokens from projects', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'P1',
        agents: [
          { tokensInput: 1000, tokensOutput: 500, completedAt: new Date() },
          { tokensInput: 2000, tokensOutput: 1000, completedAt: new Date() },
        ],
      },
    ]);

    const result = await getUsage(USER_ID);

    expect(result.data.totals.tokensInput).toBe(3000);
    expect(result.data.totals.tokensOutput).toBe(1500);
    expect(result.data.byProject).toHaveLength(1);
  });

  it('returns empty when no projects', async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);

    const result = await getUsage(USER_ID);

    expect(result.data.totals.tokensInput).toBe(0);
    expect(result.data.byProject).toHaveLength(0);
  });
});

describe('getDailyUsage', () => {
  it('returns daily breakdown', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        date: '2026-04-01',
        tokens_input: BigInt(5000),
        tokens_output: BigInt(2000),
        executions: BigInt(3),
      },
    ]);

    const result = await getDailyUsage(USER_ID, { days: 30 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].tokensInput).toBe(5000);
    expect(result.data[0].executions).toBe(3);
  });
});

describe('updateProfile', () => {
  it('updates user name', async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: USER_ID,
      name: 'New Name',
      email: 'test@example.com',
      updatedAt: new Date('2026-04-01'),
    });

    const result = await updateProfile(USER_ID, { name: 'New Name' });

    expect(result.data.name).toBe('New Name');
  });
});

describe('changePassword', () => {
  it('changes password when current is correct', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      password: 'hashed-old',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await changePassword(USER_ID, {
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });

    expect(result).toHaveProperty('data');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { password: 'hashed-new-password' },
      }),
    );
  });

  it('returns error when current password is wrong', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      password: 'hashed-old',
    });
    vi.mocked(comparePasswordSafe).mockResolvedValueOnce(false);

    const result = await changePassword(USER_ID, {
      currentPassword: 'WrongPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });

    expect('error' in result && result.error).toBe('INVALID_PASSWORD');
  });
});
