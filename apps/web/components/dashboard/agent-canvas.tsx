'use client';

/** @description AgentCanvas — HTML5 Canvas with animated agent nodes, connections, particles, and hit-testing */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useDashboardStore, type AgentNode } from '@/hooks/use-dashboard-store';
import { AGENT_CONNECTIONS, LAYER_AGENTS } from '@/lib/agent-config';
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
} from './agent-particles';

interface AgentCanvasProps {
  onNodeClick?: (node: AgentNode) => void;
}

/** @description Interactive Canvas rendering 10 agent nodes with animations and particle effects */
export function AgentCanvas({ onNodeClick }: AgentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const particleSystemRef = useRef<ParticleSystem>(createParticleSystem());
  const [hoveredNode, setHoveredNode] = useState<AgentNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const agents = useDashboardStore((s) => s.agents);
  const currentLayer = useDashboardStore((s) => s.currentLayer);
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
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
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

      // Find active connection based on current layer
      const activeAgentType = currentLayer > 0 ? LAYER_AGENTS[currentLayer - 1] : null;

      // Draw connections
      for (const [fromType, toType] of AGENT_CONNECTIONS) {
        const fromNode = agents.find((a) => a.id === fromType);
        const toNode = agents.find((a) => a.id === toType);
        if (fromNode && toNode) {
          const isActive =
            toNode.status === 'working' || toNode.status === 'done' || toNode.id === activeAgentType;
          drawConnection(rc, fromNode, toNode, isActive);
        }
      }

      // Update and draw particles
      const activeFrom = activeAgentType
        ? (() => {
            const idx = LAYER_AGENTS.indexOf(activeAgentType);
            return idx === 0
              ? agents.find((a) => a.id === 'orchestrator') ?? null
              : agents.find((a) => a.id === LAYER_AGENTS[idx - 1]) ?? null;
          })()
        : null;
      const activeTo = activeAgentType ? agents.find((a) => a.id === activeAgentType) ?? null : null;

      if (activeTo?.status === 'working') {
        updateParticles(particleSystemRef.current, activeFrom, activeTo, time);
        drawParticles(rc, particleSystemRef.current);
      }

      // Draw nodes
      for (const node of agents) {
        drawNode(rc, node);
      }

      rafRef.current = requestAnimationFrame((t) => renderFnRef.current?.(t));
    },
    [agents, currentLayer],
  );

  // Keep render ref up to date
  useEffect(() => {
    renderFnRef.current = render;
  });

  // Setup ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setupCanvas();

    const observer = new ResizeObserver(() => {
      setupCanvas();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [setupCanvas]);

  // Animation loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  // Mouse events
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCanvasCoords(e.nativeEvent, canvas);
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(agents, coords.x, coords.y, {
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      });

      setHoveredNode(hit);
      if (hit) {
        setTooltipPos({ x: e.clientX, y: e.clientY });
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    },
    [agents],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onNodeClick) return;

      const coords = getCanvasCoords(e.nativeEvent, canvas);
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(agents, coords.x, coords.y, {
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      });

      if (hit) {
        onNodeClick(hit);
      }
    },
    [agents, onNodeClick],
  );

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => setHoveredNode(null)}
        className="block w-full h-full"
      />

      {/* Tooltip overlay */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-sm"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 8,
          }}
          role="tooltip"
        >
          <div className="font-medium text-white capitalize">{hoveredNode.type as string}</div>
          {hoveredNode.currentTask && (
            <div className="text-white/60 text-xs mt-0.5 max-w-[200px] truncate">
              {hoveredNode.currentTask}
            </div>
          )}
          <div className="flex gap-3 text-xs text-white/40 mt-1">
            <span>{hoveredNode.tokensUsed.toLocaleString()} tokens</span>
            <span>{hoveredNode.filesCreated} files</span>
          </div>
        </div>
      )}
    </div>
  );
}
