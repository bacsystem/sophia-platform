import type { FastifyReply, FastifyRequest } from 'fastify';

/** SSE event payload types for spec generation progress */
export type SseEvent =
  | { type: 'start'; file: string; step: number; totalSteps: number }
  | { type: 'chunk'; file: string; content: string }
  | { type: 'validated'; file: string; valid: boolean }
  | { type: 'done'; version: number; files: string[] }
  | { type: 'error'; file: string; message: string; retryable: boolean };

/**
 * @description Sets SSE headers on the Fastify reply, including CORS headers.
 * Must be called before sending any events.
 * Uses reply.raw.writeHead which bypasses Fastify's CORS plugin,
 * so CORS headers are added manually based on the request origin.
 */
export function initSseStream(reply: FastifyReply, request: FastifyRequest): void {
  const allowedOrigins = (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000']).map(s => s.trim()).filter(Boolean);
  const origin = request.headers.origin;
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
  });
}

/**
 * @description Sends a single SSE event to the client.
 * Serializes the payload as JSON in the `data:` field.
 */
export function sendSseEvent(reply: FastifyReply, event: SseEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  reply.raw.write(payload);
}

/**
 * @description Ends the SSE stream gracefully.
 */
export function endSseStream(reply: FastifyReply): void {
  reply.raw.end();
}
