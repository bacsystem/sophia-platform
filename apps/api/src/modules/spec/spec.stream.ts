import type { FastifyReply } from 'fastify';

/** SSE event payload types for spec generation progress */
export type SseEvent =
  | { type: 'start'; file: string; step: number; totalSteps: number }
  | { type: 'chunk'; file: string; content: string }
  | { type: 'validated'; file: string; valid: boolean }
  | { type: 'done'; version: number; files: string[] }
  | { type: 'error'; file: string; message: string; retryable: boolean };

/**
 * @description Sets SSE headers on the Fastify reply.
 * Must be called before sending any events.
 */
export function initSseStream(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
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
