'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type SseEventType = 'start' | 'chunk' | 'validated' | 'done' | 'error';

export interface SseStartEvent {
  type: 'start';
  file: string;
  step: number;
  totalSteps: number;
}

export interface SseChunkEvent {
  type: 'chunk';
  file: string;
  content: string;
}

export interface SseValidatedEvent {
  type: 'validated';
  file: string;
  valid: boolean;
}

export interface SseDoneEvent {
  type: 'done';
  version: number;
  files: string[];
}

export interface SseErrorEvent {
  type: 'error';
  file: string;
  message: string;
  retryable: boolean;
}

export type SseEvent =
  | SseStartEvent
  | SseChunkEvent
  | SseValidatedEvent
  | SseDoneEvent
  | SseErrorEvent;

export interface UseSpecStreamState {
  events: SseEvent[];
  status: 'idle' | 'connecting' | 'streaming' | 'done' | 'error';
  currentFile: string | null;
  accumulatedContent: Record<string, string>;
  completedVersion: number | null;
  errorMessage: string | null;
}

/**
 * @description SSE hook for real-time spec generation progress. Connects to
 * GET /api/projects/:projectId/spec/stream?jobId=xxx. Replays buffered events
 * on reconnect (C2 — background generation continues when user returns to page).
 */
export function useSpecStream(
  projectId: string | null,
  jobId: string | null,
): UseSpecStreamState {
  const [state, setState] = useState<UseSpecStreamState>({
    events: [],
    status: 'idle',
    currentFile: null,
    accumulatedContent: {},
    completedVersion: null,
    errorMessage: null,
  });

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId || !jobId) return;

    setState((prev) => ({ ...prev, status: 'connecting' }));

    const url = `${API_URL}/api/projects/${projectId}/spec/stream?jobId=${jobId}`;

    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SseEvent;

        setState((prev) => {
          const events = [...prev.events, event];
          const accumulatedContent = { ...prev.accumulatedContent };
          let currentFile = prev.currentFile;
          let status = prev.status as UseSpecStreamState['status'];
          let completedVersion = prev.completedVersion;
          let errorMessage = prev.errorMessage;

          switch (event.type) {
            case 'start':
              currentFile = event.file;
              status = 'streaming';
              if (!accumulatedContent[event.file]) {
                accumulatedContent[event.file] = '';
              }
              break;
            case 'chunk':
              accumulatedContent[event.file] = (accumulatedContent[event.file] ?? '') + event.content;
              break;
            case 'done':
              status = 'done';
              completedVersion = event.version;
              currentFile = null;
              es.close();
              break;
            case 'error':
              status = 'error';
              errorMessage = event.message;
              currentFile = null;
              es.close();
              break;
          }

          return { events, status, currentFile, accumulatedContent, completedVersion, errorMessage };
        });
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setState((prev) =>
          prev.status === 'done' || prev.status === 'error'
            ? prev
            : { ...prev, status: 'error', errorMessage: 'Conexión perdida' },
        );
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [projectId, jobId]);

  return state;
}
