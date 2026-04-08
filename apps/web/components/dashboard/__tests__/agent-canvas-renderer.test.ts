import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderContext, drawNode, drawConnection, clearCanvas } from '../agent-canvas-renderer';
import type { AgentNode } from '@/hooks/use-dashboard-store';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
}

function createNode(overrides: Partial<AgentNode> = {}): AgentNode {
  return {
    id: 'dba',
    type: 'dba',
    status: 'idle',
    progress: 0,
    currentTask: null,
    tokensUsed: 0,
    filesCreated: 0,
    startedAt: null,
    completedAt: null,
    color: '#f59e0b',
    cx: 120,
    cy: 140,
    radius: 28,
    ...overrides,
  };
}

describe('agent-canvas-renderer', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  describe('createRenderContext', () => {
    it('computes scale factors from logical dimensions', () => {
      const rc = createRenderContext(ctx, 1400, 1000, 0);
      expect(rc.scaleX).toBe(2);
      expect(rc.scaleY).toBe(2);
      expect(rc.width).toBe(1400);
      expect(rc.height).toBe(1000);
    });

    it('preserves the time parameter', () => {
      const rc = createRenderContext(ctx, 700, 500, 42);
      expect(rc.time).toBe(42);
    });
  });

  describe('clearCanvas', () => {
    it('calls clearRect with full canvas dimensions', () => {
      const rc = createRenderContext(ctx, 800, 600, 0);
      clearCanvas(rc);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('drawNode', () => {
    it('draws a node without errors for idle status', () => {
      const rc = createRenderContext(ctx, 700, 500, 0);
      const node = createNode({ status: 'idle' });
      expect(() => drawNode(rc, node)).not.toThrow();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('applies pulse ring for working status', () => {
      const rc = createRenderContext(ctx, 700, 500, 100);
      const node = createNode({ status: 'working' });
      drawNode(rc, node);
      // Working status triggers two arc calls (pulse ring + node circle)
      const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
      expect(arcCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('applies shake offset for error status', () => {
      const rc = createRenderContext(ctx, 700, 500, 200);
      const node = createNode({ status: 'error' });
      drawNode(rc, node);
      expect(ctx.strokeStyle).toBe('#ef4444');
    });

    it('draws a checkmark for done status', () => {
      const rc = createRenderContext(ctx, 700, 500, 0);
      const node = createNode({ status: 'done' });
      drawNode(rc, node);
      // Checkmark uses moveTo + lineTo (at least 2 lineTo calls from checkmark)
      const lineToCount = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(lineToCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('drawConnection', () => {
    it('draws a line between two nodes', () => {
      const rc = createRenderContext(ctx, 700, 500, 0);
      const from = createNode({ cx: 100, cy: 100 });
      const to = createNode({ cx: 300, cy: 300, id: 'backend', type: 'backend' });

      drawConnection(rc, from, to, true);
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('uses brighter style for active connections', () => {
      const rc = createRenderContext(ctx, 700, 500, 0);
      const from = createNode({ cx: 100, cy: 100 });
      const to = createNode({ cx: 300, cy: 300, id: 'seed', type: 'seed' });

      drawConnection(rc, from, to, true);
      expect(ctx.strokeStyle).toBe('rgba(255,255,255,0.5)');
    });

    it('uses dim style for inactive connections', () => {
      const rc = createRenderContext(ctx, 700, 500, 0);
      const from = createNode({ cx: 100, cy: 100 });
      const to = createNode({ cx: 300, cy: 300, id: 'seed', type: 'seed' });

      drawConnection(rc, from, to, false);
      expect(ctx.strokeStyle).toBe('rgba(255,255,255,0.08)');
    });
  });
});
