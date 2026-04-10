/**
 * @description Global shutdown state for graceful signal handling.
 * Import `isShuttingDown` to check if a SIGTERM/SIGINT has been received.
 * Only the worker process should call `setShuttingDown`.
 */
let _shuttingDown = false;

/** @description Returns true if SIGTERM or SIGINT has been received. */
export function isShuttingDown(): boolean {
  return _shuttingDown;
}

/** @description Marks the process as shutting down. Called by worker signal handlers. */
export function setShuttingDown(): void {
  _shuttingDown = true;
}

/**
 * @description Resets the shutdown flag. Used only in tests to isolate state.
 * @internal
 */
export function resetShuttingDown(): void {
  _shuttingDown = false;
}
