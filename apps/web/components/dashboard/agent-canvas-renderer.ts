/** @description Canvas rendering — premium FactorIA-style control room with detailed agent cards, spinning rings, icons, badges */

import type { AgentNode } from '@/hooks/use-dashboard-store';
import type { AgentNodeStatus } from '@/hooks/use-dashboard-store';
import { CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT, AGENT_CONFIGS, type AgentMode } from '@/lib/agent-config';

/* ═══════════ Constants ═══════════ */

const WRITE_COLOR = '#10b981';
const EXECUTE_COLOR = '#f59e0b';
const ORCHESTRATE_COLOR = '#10b981';
const DONE_COLOR = '#10b981';
const ERROR_COLOR = '#ef4444';
const PAUSED_COLOR = '#f59e0b';

/* ═══════════ Theme-adaptive colors ═══════════ */

interface CanvasTheme {
  isDark: boolean;
  canvasBg: string;
  vigFrom: string;
  vigTo: string;
  idleNodeColor: string;
  idleCoreFill: string;
  idleDot: string;
  inactiveConn: string;
  labelPrimary: string;
  labelSecondary: string;
  labelElapsed: string;
  toolBadgeBg: string;
  layerBadgeText: string;
}

function getThemeColors(): CanvasTheme {
  const isDark = typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');
  return isDark ? {
    isDark: true,
    canvasBg: '#080808',
    vigFrom: 'rgba(4,4,4,0)',
    vigTo: 'rgba(0,0,0,0.55)',
    idleNodeColor: '#1e3a5f',
    idleCoreFill: 'rgba(8,18,35,0.9)',
    idleDot: 'rgba(255,255,255,0.08)',
    inactiveConn: '#1e3a5f',
    labelPrimary: 'rgba(255,255,255,0.9)',
    labelSecondary: 'rgba(180,200,220,0.6)',
    labelElapsed: 'rgba(255,255,255,0.4)',
    toolBadgeBg: 'rgba(255,255,255,0.08)',
    layerBadgeText: 'rgba(255,255,255,0.75)',
  } : {
    isDark: false,
    canvasBg: '#e8edf4',
    vigFrom: 'rgba(220,228,240,0)',
    vigTo: 'rgba(180,196,218,0.35)',
    idleNodeColor: '#94a3b8',
    idleCoreFill: 'rgba(226,232,240,0.92)',
    idleDot: 'rgba(15,23,42,0.12)',
    inactiveConn: '#94a3b8',
    labelPrimary: 'rgba(15,23,42,0.85)',
    labelSecondary: 'rgba(15,23,42,0.45)',
    labelElapsed: 'rgba(15,23,42,0.38)',
    toolBadgeBg: 'rgba(15,23,42,0.07)',
    layerBadgeText: 'rgba(15,23,42,0.7)',
  };
}

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
  return { ctx, width, height, scaleX: width / CANVAS_LOGICAL_WIDTH, scaleY: height / CANVAS_LOGICAL_HEIGHT, time };
}

function toScreen(rc: RenderContext, cx: number, cy: number): [number, number] {
  return [cx * rc.scaleX, cy * rc.scaleY];
}

function scaledR(rc: RenderContext, r: number): number {
  return r * Math.min(rc.scaleX, rc.scaleY);
}

function getModeColor(mode: AgentMode, status: AgentNodeStatus): string {
  if (status === 'done') return DONE_COLOR;
  if (status === 'error') return ERROR_COLOR;
  if (status === 'paused') return PAUSED_COLOR;
  if (status === 'idle' || status === 'queued') return getThemeColors().idleNodeColor;
  if (mode === 'execute') return EXECUTE_COLOR;
  if (mode === 'orchestrate') return ORCHESTRATE_COLOR;
  return WRITE_COLOR;
}

/* ═══════════ Background ═══════════ */

function drawBackground(rc: RenderContext): void {
  const { ctx, width, height, time } = rc;
  const t = getThemeColors();

  ctx.fillStyle = t.canvasBg;
  ctx.fillRect(0, 0, width, height);

  // Radial vignette
  const vig = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.75);
  vig.addColorStop(0, t.vigFrom);
  vig.addColorStop(1, t.vigTo);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  const spacing = 40 * Math.min(rc.scaleX, rc.scaleY);
  const pulse = 0.04 + 0.015 * Math.sin(time * 0.0005);
  ctx.save();
  ctx.strokeStyle = `rgba(16,185,129,${pulse})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

  // Scanning line
  const scanY = (time * 0.02) % (height + 80) - 40;
  const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
  sg.addColorStop(0, 'rgba(16,185,129,0)');
  sg.addColorStop(0.5, 'rgba(16,185,129,0.04)');
  sg.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, scanY - 40, width, 80);
  ctx.restore();
}

/* ═══════════ Connections ═══════════ */

/** @description Draws a connection — bezier curve for hub-spoke, straight for sequential */
export function drawConnection(rc: RenderContext, from: AgentNode, to: AgentNode, active: boolean): void {
  const { ctx, time } = rc;
  const [x1, y1] = toScreen(rc, from.cx, from.cy);
  const [x2, y2] = toScreen(rc, to.cx, to.cy);
  const isDone = from.status === 'done' && to.status === 'done';
  const isHub = from.type === 'orchestrator';
  const inactiveColor = getThemeColors().inactiveConn;
  const color = isDone ? DONE_COLOR : active ? (to.color || inactiveColor) : inactiveColor;

  ctx.save();

  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (isHub) {
      // Bezier curve: starts vertically, curves to destination
      const cpY = y1 + (y2 - y1) * 0.45;
      ctx.quadraticCurveTo(x1, cpY, x2, y2);
    } else if (Math.abs(y2 - y1) > 50 * Math.min(rc.scaleX, rc.scaleY)) {
      // Cross-row connection: use cubic bezier
      const midY = (y1 + y2) / 2;
      ctx.bezierCurveTo(x1, midY + 30 * rc.scaleY, x2, midY - 30 * rc.scaleY, x2, y2);
    } else {
      ctx.lineTo(x2, y2);
    }
  };

  if (active) {
    // Glow layer
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.25;
    drawPath();
    ctx.stroke();

    // Animated dash layer
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.setLineDash([8, 5]);
    ctx.lineDashOffset = -time * 0.035;
    drawPath();
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = isDone ? 0.8 : 0.5;
    ctx.globalAlpha = isDone ? 0.2 : 0.1;
    drawPath();
    ctx.stroke();
  }
  ctx.restore();
}

/* ═══════════ Nodes ═══════════ */

/** @description Draws a premium FactorIA-style agent node with rings, icon, badges, labels, and status */
export function drawNode(rc: RenderContext, node: AgentNode): void {
  const { ctx, time } = rc;
  const config = AGENT_CONFIGS[node.type];
  if (!config) return;

  const [x, y] = toScreen(rc, node.cx, node.cy);
  const r = scaledR(rc, node.radius);
  const s = Math.min(rc.scaleX, rc.scaleY);

  const isW = node.status === 'working';
  const isD = node.status === 'done';
  const isE = node.status === 'error';
  const isP = node.status === 'paused';
  const isI = node.status === 'idle' || node.status === 'queued';

  const mc = getModeColor(config.mode, node.status);

  ctx.save();
  let dx = x;
  if (isE) dx += 2.5 * Math.sin(time * 0.025) * s;

  // ── 1. Outer ring (spinning when working) ──
  const outerR = r + 16 * s;
  ctx.save();
  if (isW) { ctx.translate(dx, y); ctx.rotate(time * 0.0004); ctx.translate(-dx, -y); }
  ctx.beginPath(); ctx.arc(dx, y, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = mc;
  ctx.lineWidth = isW ? 1.5 : 0.6;
  ctx.globalAlpha = isW ? 0.4 : isD ? 0.2 : 0.08;
  ctx.setLineDash([outerR * 0.35, outerR * 0.25]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 2. Orbiting dots on outer ring ──
  if (isW || isD) {
    for (let i = 0; i < 3; i++) {
      const angle = time * 0.0012 + (Math.PI * 2 / 3) * i;
      const dotX = dx + Math.cos(angle) * outerR;
      const dotY = y + Math.sin(angle) * outerR;
      const alpha = isD ? 0.3 : 0.5 + 0.3 * Math.sin(time * 0.003 + i * 2.1);
      ctx.beginPath(); ctx.arc(dotX, dotY, 2.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = hexRgba(mc, alpha);
      ctx.fill();
    }
  }

  // ── 3. Mid ring (counter-spinning) ──
  const midR = r + 8 * s;
  ctx.save();
  if (isW) { ctx.translate(dx, y); ctx.rotate(-time * 0.0008); ctx.translate(-dx, -y); }
  ctx.beginPath(); ctx.arc(dx, y, midR, 0, Math.PI * 2);
  ctx.strokeStyle = mc;
  ctx.lineWidth = isW ? 1.2 : 0.5;
  ctx.globalAlpha = isW ? 0.45 : isD ? 0.15 : 0.06;
  if (isW) ctx.setLineDash([midR * 0.5, midR * 0.25]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 4. Core circle ──
  ctx.globalAlpha = 1;
  if (isW || isD) {
    ctx.shadowColor = mc;
    ctx.shadowBlur = isW ? 20 + 6 * Math.sin(time * 0.003) : 10;
  }

  const coreR = isW ? r + 1.5 * Math.sin(time * 0.003) * s : r;
  ctx.beginPath(); ctx.arc(dx, y, coreR, 0, Math.PI * 2);
  const tc = getThemeColors();
  if (isI) {
    ctx.fillStyle = tc.idleCoreFill;
  } else {
    const g = ctx.createRadialGradient(dx, y, 0, dx, y, coreR);
    g.addColorStop(0, hexRgba(mc, 0.15));
    g.addColorStop(1, hexRgba(mc, 0.03));
    ctx.fillStyle = g;
  }
  ctx.fill();

  ctx.beginPath(); ctx.arc(dx, y, coreR, 0, Math.PI * 2);
  ctx.strokeStyle = isI ? tc.idleNodeColor : mc;
  ctx.lineWidth = isW ? 2 : 1;
  ctx.globalAlpha = isI ? 0.3 : 0.8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ── 5. Progress arc ──
  if (isW && node.progress > 0) {
    const angle = (node.progress / 100) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(dx, y, r + 3 * s, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.strokeStyle = mc;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.shadowColor = mc;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
  }

  // ── 6. Center icon ──
  const iconSize = r * 0.55;
  if (isD) {
    drawCheckIcon(ctx, dx, y, iconSize * 0.5, DONE_COLOR);
  } else if (isE) {
    drawXIcon(ctx, dx, y, iconSize * 0.4, ERROR_COLOR);
  } else if (isP) {
    drawPauseIcon(ctx, dx, y, iconSize, PAUSED_COLOR);
  } else if (isW) {
    if (config.mode === 'execute' || config.mode === 'orchestrate') {
      drawPlayIcon(ctx, dx, y, iconSize, mc);
    } else {
      drawPencilIcon(ctx, dx, y, iconSize, mc);
    }
  } else {
    // Idle: dim dot
    ctx.beginPath(); ctx.arc(dx, y, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = tc.idleDot;
    ctx.fill();
  }

  // ── 7. SUB badge (top-right) ──
  if (node.type !== 'orchestrator' && !isI) {
    const bx = dx + r * 0.6;
    const by = y - r - 10 * s;
    drawPillBadge(ctx, bx, by, 'SUB', mc, s);
  }

  // ── 8. Layer count badge (bottom-right) ──
  if (node.type !== 'orchestrator' && !isI) {
    const cx2 = dx + r * 0.65;
    const cy2 = y + r * 0.55;
    const br = 9 * s;
    ctx.beginPath(); ctx.arc(cx2, cy2, br, 0, Math.PI * 2);
    ctx.fillStyle = hexRgba(mc, 0.2);
    ctx.fill();
    ctx.strokeStyle = hexRgba(mc, 0.35);
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx2, cy2, br, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 ${Math.round(8 * s)}px 'Syne', sans-serif`;
    ctx.fillStyle = tc.layerBadgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(config.layer), cx2, cy2);
  }

  // ── 9. Labels below node ──
  const baseY = y + r + 20 * s;
  const nameFs = Math.max(10, Math.round(11 * s));
  const subFs = Math.max(8, Math.round(9 * s));
  ctx.textAlign = 'center';

  // Agent label (line 1)
  ctx.font = `700 ${nameFs}px 'Syne', 'Space Mono', sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = isI ? tc.labelSecondary : tc.labelPrimary;
  if (isW && !isI) { ctx.shadowColor = mc; ctx.shadowBlur = 6; }
  ctx.fillText(config.label + ' —', dx, baseY);
  ctx.shadowBlur = 0;

  // Sub label (line 2)
  const subY = baseY + nameFs + 2 * s;
  ctx.font = `400 ${subFs}px 'Space Mono', monospace`;
  ctx.fillStyle = isI ? tc.labelElapsed : tc.labelSecondary;
  ctx.fillText(config.sub, dx, subY);

  // ── 10. Status pill + elapsed time ──
  if (!isI) {
    const pillY = subY + subFs + 6 * s;
    const statusText = isD ? 'Completado' : isE ? 'Error' : isP ? 'Pausado'
      : config.mode === 'execute' ? 'Ejecutando' : 'Escribiendo';
    drawPillBadge(ctx, dx - 15 * s, pillY + 8 * s, statusText, mc, s);

    // Elapsed time
    if ((isW || isD) && node.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(node.startedAt).getTime()) / 1000);
      const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${String(elapsed % 60).padStart(2, '0')}s`;
      const pillW = ctx.measureText(statusText).width + 14 * s;
      ctx.font = `400 ${Math.round(9 * s)}px 'Space Mono', monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = tc.labelElapsed;
      ctx.fillText(elapsedStr, dx - 15 * s + pillW / 2 + 6 * s, pillY + 8 * s + 1);
      ctx.textAlign = 'center';
    }

    // ── 11. Status dot + tool type + action text ──
    if (isW) {
      const infoY = pillY + 22 * s;
      const toolLabel = config.mode === 'execute' ? 'Bash' : 'Write';
      const dotStatus = config.mode === 'execute' ? 'Ejecutando' : 'Escribiendo';

      // Status dot + text
      ctx.textAlign = 'left';
      const infoX = dx - 60 * s;
      ctx.beginPath(); ctx.arc(infoX, infoY + 4 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = mc;
      ctx.fill();
      ctx.font = `700 ${Math.round(8 * s)}px 'Space Mono', monospace`;
      ctx.fillStyle = mc;
      ctx.fillText(dotStatus, infoX + 7 * s, infoY + 7 * s);

      // Tool badge
      const statusW = ctx.measureText(dotStatus).width;
      const tbx = infoX + 7 * s + statusW + 8 * s;
      const tby = infoY + 1 * s;
      ctx.font = `400 ${Math.round(7 * s)}px 'Space Mono', monospace`;
      const tw = ctx.measureText(toolLabel).width + 8 * s;
      ctx.fillStyle = tc.toolBadgeBg;
      roundedRect(ctx, tbx, tby, tw, 12 * s, 3 * s);
      ctx.fill();
      ctx.fillStyle = tc.labelElapsed;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(toolLabel, tbx + tw / 2, tby + 6 * s);

      // Current action text
      if (node.currentTask) {
        const actionY = infoY + 16 * s;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `400 ${Math.round(8 * s)}px 'Space Mono', monospace`;
        ctx.fillStyle = tc.labelSecondary;
        const maxW = 140 * s;
        const truncated = truncateText(ctx, node.currentTask, maxW);
        ctx.fillText(truncated, dx, actionY);
      }
    }
  }

  ctx.restore();
}

/* ═══════════ Icon Helpers ═══════════ */

function drawPencilIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  // Shaft
  ctx.fillRect(-sz * 0.12, -sz * 0.55, sz * 0.24, sz * 0.7);
  // Tip
  ctx.beginPath();
  ctx.moveTo(-sz * 0.12, sz * 0.15);
  ctx.lineTo(sz * 0.12, sz * 0.15);
  ctx.lineTo(0, sz * 0.42);
  ctx.closePath();
  ctx.fill();
  // Eraser line
  ctx.fillStyle = hexRgba(color, 0.4);
  ctx.fillRect(-sz * 0.12, -sz * 0.58, sz * 0.24, sz * 0.06);
  ctx.restore();
}

function drawPlayIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - sz * 0.28, y - sz * 0.38);
  ctx.lineTo(x + sz * 0.42, y);
  ctx.lineTo(x - sz * 0.28, y + sz * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCheckIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = Math.max(2, sz * 0.45);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - sz, y);
  ctx.lineTo(x - sz * 0.25, y + sz * 0.7);
  ctx.lineTo(x + sz, y - sz * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawXIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = Math.max(2, sz * 0.4);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - sz, y - sz); ctx.lineTo(x + sz, y + sz);
  ctx.moveTo(x + sz, y - sz); ctx.lineTo(x - sz, y + sz);
  ctx.stroke();
  ctx.restore();
}

function drawPauseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  const bw = sz * 0.15;
  const bh = sz * 0.5;
  ctx.fillRect(x - bw * 1.8, y - bh / 2, bw, bh);
  ctx.fillRect(x + bw * 0.8, y - bh / 2, bw, bh);
  ctx.restore();
}

/* ═══════════ UI Element Helpers ═══════════ */

function drawPillBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  s: number,
): void {
  ctx.save();
  ctx.font = `700 ${Math.round(8 * s)}px 'Space Mono', monospace`;
  const tw = ctx.measureText(text).width;
  const pw = tw + 10 * s;
  const ph = 14 * s;
  const px = x - pw / 2;
  const py = y - ph / 2;

  // Background
  ctx.fillStyle = hexRgba(color, 0.12);
  roundedRect(ctx, px, py, pw, ph, ph / 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = hexRgba(color, 0.3);
  ctx.lineWidth = 0.5;
  roundedRect(ctx, px, py, pw, ph, ph / 2);
  ctx.stroke();

  // Text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const mr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + mr, y);
  ctx.lineTo(x + w - mr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + mr);
  ctx.lineTo(x + w, y + h - mr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - mr, y + h);
  ctx.lineTo(x + mr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - mr);
  ctx.lineTo(x, y + mr);
  ctx.quadraticCurveTo(x, y, x + mr, y);
  ctx.closePath();
}

/* ═══════════ Utility Helpers ═══════════ */

function hexRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** @description Clears canvas and draws the premium control-room background */
export function clearCanvas(rc: RenderContext): void {
  drawBackground(rc);
}
