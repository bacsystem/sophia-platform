import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.service.js';
import { checkRateLimit } from '../../lib/redis.js';
import { comparePasswordSafe, hashPassword } from '../../lib/hash.js';
import { ANTHROPIC_PRICING } from '@sophia/shared/constants/pricing';
import type { SaveApiKeyInput, UpdateProfileInput, ChangePasswordInput, DailyUsageQuery } from './settings.schema.js';

const API_KEY_VERIFY_RATE_LIMIT_KEY = 'settings:verify-key';
const API_KEY_VERIFY_MAX_ATTEMPTS = 5;
const API_KEY_VERIFY_WINDOW = 3600; // 1 hour

/** @description Get user settings — API key status + profile */
export async function getSettings(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      anthropicApiKeyLast4: true,
      apiKeyVerifiedAt: true,
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return {
    data: {
      apiKey: {
        configured: !!settings?.anthropicApiKeyLast4,
        last4: settings?.anthropicApiKeyLast4 ?? null,
        verifiedAt: settings?.apiKeyVerifiedAt?.toISOString() ?? null,
      },
      profile: {
        name: user.name,
        email: user.email,
      },
    },
  };
}

/** @description Save API key — validate format, verify with Anthropic, encrypt, store */
export async function saveApiKey(userId: string, input: SaveApiKeyInput) {
  const rateLimit = await checkRateLimit(
    `${API_KEY_VERIFY_RATE_LIMIT_KEY}:${userId}`,
    API_KEY_VERIFY_MAX_ATTEMPTS,
    API_KEY_VERIFY_WINDOW,
  );

  if (!rateLimit.allowed) {
    return {
      error: 'TOO_MANY_ATTEMPTS' as const,
      message: 'Máximo 5 verificaciones por hora',
      retryAfter: rateLimit.retryAfter,
      status: 429,
    };
  }

  // Verify key with Anthropic
  const verifyResult = await verifyKeyWithAnthropic(input.apiKey);
  if (!verifyResult.valid) {
    return {
      error: 'API_KEY_VERIFICATION_FAILED' as const,
      message: 'No se pudo verificar la API key con Anthropic',
      status: 400,
    };
  }

  const { encrypted, iv, tag } = encrypt(input.apiKey);
  const last4 = input.apiKey.slice(-4);
  const now = new Date();

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      anthropicApiKeyEncrypted: encrypted,
      anthropicApiKeyIv: iv,
      anthropicApiKeyTag: tag,
      anthropicApiKeyLast4: last4,
      apiKeyVerifiedAt: now,
    },
    update: {
      anthropicApiKeyEncrypted: encrypted,
      anthropicApiKeyIv: iv,
      anthropicApiKeyTag: tag,
      anthropicApiKeyLast4: last4,
      apiKeyVerifiedAt: now,
    },
  });

  console.info(`[Audit] User ${userId} added API key`);

  return {
    data: {
      configured: true,
      last4,
      verifiedAt: now.toISOString(),
    },
  };
}

/** @description Delete API key — clear encrypted fields */
export async function deleteApiKey(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { anthropicApiKeyEncrypted: true },
  });

  if (!settings?.anthropicApiKeyEncrypted) {
    return {
      error: 'NO_API_KEY' as const,
      message: 'No hay API key configurada',
      status: 404,
    };
  }

  await prisma.userSettings.update({
    where: { userId },
    data: {
      anthropicApiKeyEncrypted: null,
      anthropicApiKeyIv: null,
      anthropicApiKeyTag: null,
      anthropicApiKeyLast4: null,
      apiKeyVerifiedAt: null,
    },
  });

  console.info(`[Audit] User ${userId} deleted API key`);

  return { data: { message: 'API key eliminada' } };
}

/** @description Verify stored API key — decrypt, call Anthropic, update verifiedAt */
export async function verifyApiKey(userId: string) {
  const rateLimit = await checkRateLimit(
    `${API_KEY_VERIFY_RATE_LIMIT_KEY}:${userId}`,
    API_KEY_VERIFY_MAX_ATTEMPTS,
    API_KEY_VERIFY_WINDOW,
  );

  if (!rateLimit.allowed) {
    return {
      error: 'TOO_MANY_ATTEMPTS' as const,
      message: 'Máximo 5 verificaciones por hora',
      retryAfter: rateLimit.retryAfter,
      status: 429,
    };
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      anthropicApiKeyEncrypted: true,
      anthropicApiKeyIv: true,
      anthropicApiKeyTag: true,
    },
  });

  if (!settings?.anthropicApiKeyEncrypted || !settings.anthropicApiKeyIv || !settings.anthropicApiKeyTag) {
    return {
      error: 'NO_API_KEY' as const,
      message: 'No hay API key configurada',
      status: 404,
    };
  }

  const apiKey = decrypt(
    settings.anthropicApiKeyEncrypted,
    settings.anthropicApiKeyIv,
    settings.anthropicApiKeyTag,
  );

  const result = await verifyKeyWithAnthropic(apiKey);

  if (!result.valid) {
    return {
      error: 'API_KEY_INVALID' as const,
      message: 'La API key ya no es válida con Anthropic',
      status: 400,
    };
  }

  const now = new Date();
  await prisma.userSettings.update({
    where: { userId },
    data: { apiKeyVerifiedAt: now },
  });

  return {
    data: {
      valid: true,
      verifiedAt: now.toISOString(),
    },
  };
}

/** @description Get token usage — totals + per project */
export async function getUsage(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      agents: {
        select: {
          tokensInput: true,
          tokensOutput: true,
          completedAt: true,
        },
      },
    },
  });

  let totalInput = 0;
  let totalOutput = 0;

  const byProject = projects
    .map((project) => {
      const tokensInput = project.agents.reduce((sum, a) => sum + a.tokensInput, 0);
      const tokensOutput = project.agents.reduce((sum, a) => sum + a.tokensOutput, 0);

      if (tokensInput === 0 && tokensOutput === 0) return null;

      totalInput += tokensInput;
      totalOutput += tokensOutput;

      const completedDates = project.agents
        .map((a) => a.completedAt)
        .filter(Boolean) as Date[];
      const lastExecutionAt = completedDates.length > 0
        ? new Date(Math.max(...completedDates.map((d) => d.getTime()))).toISOString()
        : null;

      return {
        projectId: project.id,
        projectName: project.name,
        tokensInput,
        tokensOutput,
        estimatedCostUsd: calculateCost(tokensInput, tokensOutput),
        lastExecutionAt,
      };
    })
    .filter(Boolean);

  return {
    data: {
      totals: {
        tokensInput: totalInput,
        tokensOutput: totalOutput,
        estimatedCostUsd: calculateCost(totalInput, totalOutput),
      },
      byProject,
    },
  };
}

/** @description Get daily token usage — grouped by completedAt date */
export async function getDailyUsage(userId: string, query: DailyUsageQuery) {
  const since = new Date();
  since.setDate(since.getDate() - query.days);

  const result = await prisma.$queryRaw<
    Array<{
      date: string;
      tokens_input: bigint;
      tokens_output: bigint;
      executions: bigint;
    }>
  >`
    SELECT
      DATE(a.completed_at) as date,
      SUM(a.tokens_input)::bigint as tokens_input,
      SUM(a.tokens_output)::bigint as tokens_output,
      COUNT(*)::bigint as executions
    FROM agents a
    JOIN projects p ON a.project_id = p.id
    WHERE p.user_id = ${userId}
      AND a.completed_at >= ${since}
      AND a.completed_at IS NOT NULL
    GROUP BY DATE(a.completed_at)
    ORDER BY date ASC
  `;

  const data = result.map((row) => {
    const tokensInput = Number(row.tokens_input);
    const tokensOutput = Number(row.tokens_output);
    return {
      date: row.date,
      tokensInput,
      tokensOutput,
      estimatedCostUsd: calculateCost(tokensInput, tokensOutput),
      executions: Number(row.executions),
    };
  });

  return { data };
}

/** @description Update user profile name */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
    select: { id: true, name: true, email: true, updatedAt: true },
  });

  return {
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

/** @description Change user password — validates current password first */
export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { password: true },
  });

  const isValid = await comparePasswordSafe(input.currentPassword, user.password);
  if (!isValid) {
    return {
      error: 'INVALID_PASSWORD' as const,
      message: 'Contraseña actual incorrecta',
      status: 400,
    };
  }

  const hashedPassword = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { data: { message: 'Contraseña actualizada' } };
}

// ─── Helpers ────────────────────────────────────────────

function calculateCost(tokensInput: number, tokensOutput: number): number {
  const inputCost = (tokensInput / 1_000_000) * ANTHROPIC_PRICING.inputPerMTok;
  const outputCost = (tokensOutput / 1_000_000) * ANTHROPIC_PRICING.outputPerMTok;
  return Math.round((inputCost + outputCost) * 100) / 100;
}

async function verifyKeyWithAnthropic(apiKey: string): Promise<{ valid: boolean }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_PRICING.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    return { valid: response.ok };
  } catch {
    return { valid: false };
  }
}
