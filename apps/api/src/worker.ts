import 'dotenv/config';
import { startWorker } from './queue/agent-worker.js';

/** @description Entry point for the BullMQ worker process. Runs separately from the API server. */
const worker = startWorker();

console.log('[worker] Agent runner worker started. Waiting for jobs...');

async function shutdown(): Promise<void> {
  console.log('[worker] Shutting down gracefully...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
