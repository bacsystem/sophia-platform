/** @description Canvas hit-testing — detect hover/click on circular agent nodes */

import type { AgentNode } from '@/hooks/use-dashboard-store';
import { CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from '@/lib/agent-config';

interface HitTestContext {
  canvasWidth: number;
  canvasHeight: number;
}

function toLogical(ctx: HitTestContext, screenX: number, screenY: number): [number, number] {
  return [
    (screenX / ctx.canvasWidth) * CANVAS_LOGICAL_WIDTH,
    (screenY / ctx.canvasHeight) * CANVAS_LOGICAL_HEIGHT,
  ];
}

/** @description Returns the agent node under the given screen coordinates, or null */
export function hitTestNode(
  agents: AgentNode[],
  screenX: number,
  screenY: number,
  ctx: HitTestContext,
): AgentNode | null {
  const [lx, ly] = toLogical(ctx, screenX, screenY);

  // Check in reverse draw order (last drawn = on top)
  for (let i = agents.length - 1; i >= 0; i--) {
    const node = agents[i];
    const dx = lx - node.cx;
    const dy = ly - node.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Add a few px tolerance for easier clicking
    if (dist <= node.radius + 4) {
      return node;
    }
  }
  return null;
}

/** @description Gets the canvas-relative mouse coordinates from a MouseEvent */
export function getCanvasCoords(
  e: MouseEvent | React.MouseEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
