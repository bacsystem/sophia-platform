/** @description Canvas rendering functions — drawNode, drawConnection, drawLabel, drawCheckmark, drawPulse, drawShake */

import type { AgentNode } from '@/hooks/use-dashboard-store';
import { CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from '@/lib/agent-config';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  time: number;
}

export function createRenderContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
): RenderContext {
  return {
    ctx,
    width,
    height,
    scaleX: width / CANVAS_LOGICAL_WIDTH,
    scaleY: height / CANVAS_LOGICAL_HEIGHT,
    time,
  };
}

function toScreen(rc: RenderContext, cx: number, cy: number): [number, number] {
  return [cx * rc.scaleX, cy * rc.scaleY];
}

function scaledRadius(rc: RenderContext, r: number): number {
  return r * Math.min(rc.scaleX, rc.scaleY);
}

/** @description Draws a single agent node with status-appropriate styling */
export function drawNode(rc: RenderContext, node: AgentNode): void {
  const { ctx, time } = rc;
  const [x, y] = toScreen(rc, node.cx, node.cy);
  const r = scaledRadius(rc, node.radius);

  ctx.save();

  // Shake offset for error state
  let offsetX = 0;
  if (node.status === 'error') {
    offsetX = 4 * Math.sin(time * 0.02) * Math.min(rc.scaleX, rc.scaleY);
  }

  const drawX = x + offsetX;

  // Pulse ring for working state
  if (node.status === 'working') {
    const pulseScale = 1 + 0.15 * Math.sin(time * 0.003);
    const alpha = 0.3 + 0.2 * Math.sin(time * 0.003);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(drawX, y, r * pulseScale, 0, Math.PI * 2);
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Static amber ring for paused state
  if (node.status === 'paused') {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(drawX, y, r * 1.15, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Node circle
  ctx.beginPath();
  ctx.arc(drawX, y, r, 0, Math.PI * 2);

  const fillColor = getNodeFillColor(node);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Border
  ctx.strokeStyle = node.status === 'error' ? '#ef4444' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = node.status === 'error' ? 2 : 1;
  ctx.stroke();

  // Checkmark for done
  if (node.status === 'done') {
    drawCheckmark(ctx, drawX, y, r * 0.35);
  }

  // Label
  drawLabel(ctx, node.type === 'orchestrator' ? 'Orch' : capitalize(node.type as string), drawX, y + r + 14 * Math.min(rc.scaleX, rc.scaleY), Math.min(rc.scaleX, rc.scaleY));

  ctx.restore();
}

function getNodeFillColor(node: AgentNode): string {
  switch (node.status) {
    case 'idle':
    case 'queued':
      return 'rgba(107,114,128,0.4)';
    case 'working':
      return node.color;
    case 'done':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'paused':
      return '#f59e0b';
    default:
      return 'rgba(107,114,128,0.4)';
  }
}

function drawCheckmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x - size * 0.3, y + size * 0.7);
  ctx.lineTo(x + size, y - size * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
): void {
  ctx.save();
  const fontSize = Math.max(10, Math.round(11 * scale));
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** @description Draws a connection line between two nodes */
export function drawConnection(
  rc: RenderContext,
  from: AgentNode,
  to: AgentNode,
  active: boolean,
): void {
  const { ctx } = rc;
  const [x1, y1] = toScreen(rc, from.cx, from.cy);
  const [x2, y2] = toScreen(rc, to.cx, to.cy);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();
  ctx.restore();
}

/** @description Clears the canvas for the next frame */
export function clearCanvas(rc: RenderContext): void {
  rc.ctx.clearRect(0, 0, rc.width, rc.height);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
