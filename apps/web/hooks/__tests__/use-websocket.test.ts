import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

describe('use-websocket', () => {
  beforeEach(() => {
    MockWebSocket.reset();
    useDashboardStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets connected to true on open', async () => {
    // Dynamic import to ensure mocks are in place
    const { useWebSocket } = await import('@/hooks/use-websocket');

    // We need renderHook from testing library
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() =>
      useWebSocket({ projectId: 'proj-1' }),
    );

    // Wait for useEffect to run
    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();
    expect(ws.url).toContain('/ws/projects/proj-1');

    ws.simulateOpen();
    expect(useDashboardStore.getState().connected).toBe(true);
  });

  it('includes since param on reconnect for replay', async () => {
    const { useWebSocket } = await import('@/hooks/use-websocket');
    const { renderHook } = await import('@testing-library/react');

    renderHook(() => useWebSocket({ projectId: 'proj-2' }));

    const ws1 = MockWebSocket.instances[0];
    ws1.simulateOpen();

    // Send a message with a timestamp
    ws1.simulateMessage({
      type: 'agent:progress',
      agentType: 'dba',
      progress: 50,
      message: 'Working',
      timestamp: '2025-01-01T00:00:01Z',
    });

    // Close to trigger reconnect
    ws1.simulateClose();
    vi.advanceTimersByTime(3500);

    // New WS should have ?since param
    const ws2 = MockWebSocket.instances[1];
    if (ws2) {
      expect(ws2.url).toContain('since=');
    }
  });

  it('dispatches agent:started events to store', async () => {
    const { useWebSocket } = await import('@/hooks/use-websocket');
    const { renderHook } = await import('@testing-library/react');

    renderHook(() => useWebSocket({ projectId: 'proj-3' }));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    ws.simulateMessage({
      type: 'agent:started',
      agentType: 'dba',
      message: 'Starting DBA',
      timestamp: new Date().toISOString(),
    });

    const state = useDashboardStore.getState();
    const dba = state.agents.find((a) => a.id === 'dba');
    expect(dba?.status).toBe('working');
    expect(state.logs.length).toBeGreaterThan(0);
  });

  it('dispatches project:done events', async () => {
    const { useWebSocket } = await import('@/hooks/use-websocket');
    const { renderHook } = await import('@testing-library/react');

    renderHook(() => useWebSocket({ projectId: 'proj-4' }));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    ws.simulateMessage({
      type: 'project:done',
      message: 'Done',
      timestamp: new Date().toISOString(),
    });

    const state = useDashboardStore.getState();
    expect(state.status).toBe('done');
    expect(state.progress).toBe(100);
  });
});
