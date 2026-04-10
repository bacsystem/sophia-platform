import 'dotenv/config';
import { startWorker } from './queue/agent-worker.js';
import { setShuttingDown } from './lib/shutdown-state.js';

/** @description Entry point for the BullMQ worker process. Runs separately from the API server. */
const worker = startWorker();

console.log('[worker] Agent runner worker started. Waiting for jobs...');

async function shutdown(): Promise<void> {
  console.log('[worker] Shutting down gracefully...');
  setShuttingDown();

  // Force-exit after 30s if graceful close takes too long
  const forceExit = setTimeout(() => {
    console.error('[worker] Force exit after 30s grace period');
    process.exit(1);
  }, 30_000);
  forceExit.unref();

  await worker.close();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
