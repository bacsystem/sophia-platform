import crypto from 'node:crypto';
import type { FastifyReply } from 'fastify';
import prisma from '../../lib/prisma.js';
import { hashPassword, comparePasswordSafe } from '../../lib/hash.js';
import {
  signAccessToken,
  verifyAccessToken,
  getRefreshTtlSeconds,
  ACCESS_TTL_SECONDS,
} from '../../lib/jwt.js';
import { checkRateLimit } from '../../lib/redis.js';
import type { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema.js';

// ─── Helpers ────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string, rememberMe = false) {
  const refreshTtl = getRefreshTtlSeconds(rememberMe);

  // Clear stale cookies first to avoid duplicates in the browser
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/' });

  reply.setCookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });

  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: refreshTtl,
  });
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/' });
}

async function createTokenPair(userId: string, email: string, name: string, rememberMe = false) {
  const accessToken = signAccessToken({ sub: userId, email, name });
  const rawRefreshToken = generateToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);

  const expiresAt = new Date(Date.now() + getRefreshTtlSeconds(rememberMe) * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedRefreshToken,
      expiresAt,
    },
  });

  return { accessToken, rawRefreshToken, rememberMe };
}

// ─── Service Methods ────────────────────────────────────

export async function register(input: RegisterInput, ip: string, reply: FastifyReply) {
  // Rate limit: 3 registrations per IP per hour
  const rateKey = `auth:register:${ip}`;
  const limit = await checkRateLimit(rateKey, 3, 3600);
  if (!limit.allowed) {
    reply.status(429).send({
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiados registros, intenta más tarde',
      retryAfter: limit.retryAfter,
    });
    return;
  }

  // Check duplicate email
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    reply.status(409).send({
      error: 'EMAIL_ALREADY_EXISTS',
      message: 'El email ya está registrado',
    });
    return;
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
    },
  });

  const { accessToken, rawRefreshToken } = await createTokenPair(user.id, user.email, user.name);
  setAuthCookies(reply, accessToken, rawRefreshToken);

  reply.status(201).send({
    data: { id: user.id, name: user.name, email: user.email },
  });
}

export async function login(input: LoginInput, reply: FastifyReply) {
  // Rate limit: 5 attempts per email per 15 min
  const rateKey = `auth:attempts:${input.email}`;
  const limit = await checkRateLimit(rateKey, 5, 900);
  if (!limit.allowed) {
    reply.status(429).send({
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Cuenta bloqueada por 15 minutos',
      retryAfter: limit.retryAfter,
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Timing-safe comparison (always runs bcrypt even if user not found)
  const valid = await comparePasswordSafe(input.password, user?.password ?? null);

  if (!user || !valid) {
    reply.status(401).send({
      error: 'INVALID_CREDENTIALS',
      message: 'Credenciales incorrectas',
    });
    return;
  }

  const { accessToken, rawRefreshToken } = await createTokenPair(
    user.id,
    user.email,
    user.name,
    input.rememberMe,
  );
  setAuthCookies(reply, accessToken, rawRefreshToken, input.rememberMe);

  reply.status(200).send({
    data: { id: user.id, name: user.name, email: user.email },
  });
}

export async function refresh(refreshTokens: string[], reply: FastifyReply) {
  if (refreshTokens.length === 0) {
    reply.status(401).send({
      error: 'INVALID_REFRESH_TOKEN',
      message: 'Sesión expirada',
    });
    return;
  }

  // Try each refresh token (handles duplicate cookies where first may be revoked)
  let storedToken: Awaited<ReturnType<typeof prisma.refreshToken.findFirst<{ include: { user: true } }>>> = null;
  for (const token of refreshTokens) {
    const hashedToken = hashToken(token);
    storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: hashedToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (storedToken) break;
  }

  if (!storedToken) {
    reply.status(401).send({
      error: 'INVALID_REFRESH_TOKEN',
      message: 'Sesión expirada',
    });
    return;
  }

  // Revoke old token (first-wins strategy)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair
  const { accessToken, rawRefreshToken } = await createTokenPair(
    storedToken.user.id,
    storedToken.user.email,
    storedToken.user.name,
  );
  setAuthCookies(reply, accessToken, rawRefreshToken);

  reply.status(200).send({
    data: {
      id: storedToken.user.id,
      name: storedToken.user.name,
      email: storedToken.user.email,
    },
  });
}

export async function logout(refreshCookie: string | undefined, reply: FastifyReply) {
  if (refreshCookie) {
    const hashedToken = hashToken(refreshCookie);
    await prisma.refreshToken.updateMany({
      where: { token: hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearAuthCookies(reply);

  reply.status(200).send({
    data: { message: 'Sesión cerrada' },
  });
}

export async function forgotPassword(email: string, reply: FastifyReply) {
  // Rate limit: 3 per email per hour
  const rateKey = `auth:reset:${email}`;
  const limit = await checkRateLimit(rateKey, 3, 3600);
  if (!limit.allowed) {
    reply.status(429).send({
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes',
      retryAfter: limit.retryAfter,
    });
    return;
  }

  // Always return same response (don't reveal if email exists)
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = generateToken();
    const hashedTokenValue = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedTokenValue,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${rawToken}`;

    if (process.env.EMAIL_PROVIDER === 'console') {
      console.log(`[Email] Password reset for ${email}: ${resetUrl}`);
    } else {
      // Resend integration (production)
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Sophia Platform <noreply@sophia.dev>',
        to: email,
        subject: 'Restablecer contraseña — Sophia Platform',
        html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><a href="${resetUrl}">${resetUrl}</a><p>Este enlace expira en 1 hora.</p>`,
      });
    }
  }

  reply.status(200).send({
    data: { message: 'Si el email existe, recibirás instrucciones' },
  });
}

export async function resetPassword(input: ResetPasswordInput, reply: FastifyReply) {
  const hashedToken = hashToken(input.token);

  const storedToken = await prisma.passwordResetToken.findFirst({
    where: {
      token: hashedToken,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken) {
    reply.status(400).send({
      error: 'INVALID_TOKEN',
      message: 'Token inválido o expirado',
    });
    return;
  }

  const hashedPassword = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: storedToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all refresh tokens for security
    prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  reply.status(200).send({
    data: { message: 'Contraseña actualizada exitosamente' },
  });
}

export async function getMe(userId: string, reply: FastifyReply) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'No autenticado',
    });
    return;
  }

  reply.status(200).send({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
  });
}

/** @description Decodes access_token and returns session info with expiry. */
export async function getSession(accessToken: string | undefined, reply: FastifyReply) {
  if (!accessToken) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'No autenticado',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(accessToken);
    // JWT payload has `exp` in seconds since epoch
    const decoded = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    ) as { exp: number };

    reply.status(200).send({
      data: {
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
        },
      },
    });
  } catch {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Token inválido o expirado',
    });
  }
}
