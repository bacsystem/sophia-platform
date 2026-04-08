import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * @description Authenticates a WebSocket handshake request using the access_token cookie.
 * Returns the authenticated userId or throws on failure.
 */
export async function authenticateWsRequest(req: FastifyRequest): Promise<string> {
  const token = req.cookies?.access_token;
  if (!token) throw new Error('Missing access_token cookie');

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET not configured');

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });
  if (!user) throw new Error('User not found');

  return user.id;
}

/**
 * @description Verifies the authenticated user owns the requested project.
 * Throws if the project does not exist or belongs to another user.
 */
export async function verifyProjectOwnership(
  userId: string,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project || project.userId !== userId) {
    throw new Error('Project not found or access denied');
  }
}
