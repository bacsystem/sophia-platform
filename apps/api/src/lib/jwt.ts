import jwt from 'jsonwebtoken';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DEFAULT = '24h';
const REFRESH_TTL_REMEMBER = '30d';

function accessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
}

function refreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string, rememberMe = false): string {
  const expiresIn = rememberMe ? REFRESH_TTL_REMEMBER : REFRESH_TTL_DEFAULT;
  return jwt.sign({ sub: userId }, refreshSecret(), { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, accessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, refreshSecret()) as { sub: string };
}

export function getRefreshTtlSeconds(rememberMe = false): number {
  return rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
}

export const ACCESS_TTL_SECONDS = 15 * 60; // 900s
