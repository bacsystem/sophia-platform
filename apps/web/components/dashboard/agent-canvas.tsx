'use client';

/** @description AgentCanvas — HTML5 Canvas with animated agent nodes, connections, multi-connection particles, floating logs, and hit-testing */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useDashboardStore, type AgentNode } from '@/hooks/use-dashboard-store';
import { AGENT_CONNECTIONS, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT, FLOAT_MESSAGES } from '@/lib/agent-config';
import {
  clearCanvas,
  createRenderContext,
  drawConnection,
  drawNode,
} from './agent-canvas-renderer';
import { hitTestNode, getCanvasCoords } from './agent-canvas-events';
import {
  createParticleSystem,
  updateParticles,
  drawParticles,
  type ParticleSystem,
  type ActiveConnection,
} from './agent-particles';

interface FloatingMsg {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

interface AgentCanvasProps {
  onNodeClick?: (node: AgentNode, px: number, py: number, cw: number, ch: number) => void;
}

/** @description Interactive Canvas with agent nodes, particles on all active connections, and floating log messages */
export function AgentCanvas({ onNodeClick }: AgentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const particleSystemRef = useRef<ParticleSystem>(createParticleSystem());
  const [hoveredNode, setHoveredNode] = useState<AgentNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [floats, setFloats] = useState<FloatingMsg[]>([]);
  const floatIdRef = useRef(0);

  const agents = useDashboardStore((s) => s.agents);
  const renderFnRef = useRef<((time: number) => void) | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const render = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;
      const rc = createRenderContext(ctx, displayWidth, displayHeight, time);
      clearCanvas(rc);

      // Determine active connections for drawing and particles
      const activeConns: ActiveConnection[] = [];

      for (const [fromType, toType] of AGENT_CONNECTIONS) {
        const fromNode = agents.find((a) => a.id === fromType);
        const toNode = agents.find((a) => a.id === toType);
        if (fromNode && toNode) {
          const isActive = toNode.status === 'working' || toNode.status === 'done' || fromNode.status === 'working';
          drawConnection(rc, fromNode, toNode, isActive);
          if (fromNode.status === 'working' || toNode.status === 'working') {
            activeConns.push({ from: fromNode, to: toNode });
          }
        }
      }

      // Update and draw particles on all active connections
      updateParticles(particleSystemRef.current, activeConns, time);
      drawParticles(rc, particleSystemRef.current);

      // Draw nodes
      for (const node of agents) {
        drawNode(rc, node);
      }

      rafRef.current = requestAnimationFrame((t) => renderFnRef.current?.(t));
    },
    [agents],
  );

  useEffect(() => {
    renderFnRef.current = render;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setupCanvas();
    const observer = new ResizeObserver(() => setupCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [setupCanvas]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [render]);

  // Floating log messages near working agents
  useEffect(() => {
    const interval = setInterval(() => {
      const working = agents.filter((a) => a.status === 'working' && a.type !== 'orchestrator');
      if (working.length === 0) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const agent = working[Math.floor(Math.random() * working.length)];
      const px = (agent.cx / CANVAS_LOGICAL_WIDTH) * rect.width + 20 + Math.random() * 30;
      const py = (agent.cy / CANVAS_LOGICAL_HEIGHT) * rect.height - 15;
      const msg = FLOAT_MESSAGES[Math.floor(Math.random() * FLOAT_MESSAGES.length)];

      floatIdRef.current += 1;
      setFloats((prev) => [...prev.slice(-6), { id: floatIdRef.current, text: msg, x: px, y: py, color: agent.color }]);
    }, 2200);
    return () => clearInterval(interval);
  }, [agents]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const coords = getCanvasCoords(e.nativeEvent, canvas);
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(agents, coords.x, coords.y, { canvasWidth: rect.width, canvasHeight: rect.height });
      setHoveredNode(hit);
      if (hit) { setTooltipPos({ x: e.clientX, y: e.clientY }); canvas.style.cursor = 'pointer'; }
      else { canvas.style.cursor = 'default'; }
    },
    [agents],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onNodeClick) return;
      const coords = getCanvasCoords(e.nativeEvent, canvas);
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(agents, coords.x, coords.y, { canvasWidth: rect.width, canvasHeight: rect.height });
      if (hit) {
        const nodePixelX = (hit.cx / CANVAS_LOGICAL_WIDTH) * rect.width;
        const nodePixelY = (hit.cy / CANVAS_LOGICAL_HEIGHT) * rect.height;
        onNodeClick(hit, nodePixelX, nodePixelY, rect.width, rect.height);
      }
    },
    [agents, onNodeClick],
  );

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => setHoveredNode(null)}
        className="block w-full h-full"
      />

      {/* Floating log messages */}
      {floats.map((f) => (
        <div
          key={f.id}
          className="absolute pointer-events-none whitespace-nowrap animate-float-up"
          style={{ left: f.x, top: f.y, color: f.color, fontFamily: "var(--font-mono, 'Space Mono', monospace)", fontSize: 9, textShadow: `0 0 8px ${f.color}` }}
          onAnimationEnd={() => setFloats((prev) => prev.filter((m) => m.id !== f.id))}
        >
          {f.text}
        </div>
      ))}

      {/* Tooltip overlay */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none bg-[var(--surface-console)]/95 border border-[var(--muted-border)] rounded-lg px-3 py-2 shadow-xl text-sm backdrop-blur-sm"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 8 }}
          role="tooltip"
        >
          <div className="font-semibold text-[var(--text-primary)] capitalize" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>{hoveredNode.type as string}</div>
          {hoveredNode.currentTask && (
            <div className="text-[var(--text-secondary)] text-xs mt-0.5 max-w-[200px] truncate">{hoveredNode.currentTask}</div>
          )}
          <div className="flex gap-3 text-xs text-[var(--text-tertiary)] mt-1 font-mono">
            <span>{hoveredNode.tokensUsed.toLocaleString()} tokens</span>
            <span>{hoveredNode.filesCreated} files</span>
          </div>
        </div>
      )}
    </div>
  );
}
