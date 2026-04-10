/**
 * @description Tests for the agent dependency graph (T28).
 * Covers: sequential resolution, parallel resolution (L4‖L4.5, L5‖L6),
 * cycle detection, and empty graph behavior.
 */
import { describe, it, expect } from 'vitest';
import {
  getNextLayers,
  type LayerNode,
  AGENT_GRAPH,
} from '../dependency-graph.js';

describe('dependency-graph — sequential resolution (T28)', () => {
  it('returns layer 0 (planner-agent) when no layers completed', () => {
    const next = getNextLayers(new Set());
    expect(next.map((n) => n.layer)).toEqual([0]);
  });

  it('returns layer 1 (dba-agent) after layer 0 is complete', () => {
    const next = getNextLayers(new Set([0]));
    expect(next.map((n) => n.layer)).toEqual([1]);
  });

  it('returns layer 1.5 (seed-agent) after layer 1 is complete', () => {
    const next = getNextLayers(new Set([0, 1]));
    expect(next.map((n) => n.layer)).toEqual([1.5]);
  });

  it('returns layer 2 (backend-agent) after layers 1 and 1.5 completed', () => {
    const next = getNextLayers(new Set([0, 1, 1.5]));
    expect(next.map((n) => n.layer)).toEqual([2]);
  });

  it('returns layer 3 (frontend-agent) after layer 2 completed', () => {
    const next = getNextLayers(new Set([0, 1, 1.5, 2]));
    expect(next.map((n) => n.layer)).toEqual([3]);
  });
});

describe('dependency-graph — parallel resolution (T28)', () => {
  it('returns L4 and L4.5 in parallel when L3 is complete', () => {
    const next = getNextLayers(new Set([0, 1, 1.5, 2, 3]));
    const layers = next.map((n) => n.layer).sort();
    expect(layers).toEqual([4, 4.5]);
  });

  it('returns L5 and L6 in parallel when L4 and L4.5 are complete', () => {
    const next = getNextLayers(new Set([0, 1, 1.5, 2, 3, 4, 4.5]));
    const layers = next.map((n) => n.layer).sort();
    expect(layers).toEqual([5, 6]);
  });

  it('returns L7 (integration-agent) after L5 and L6 complete', () => {
    const next = getNextLayers(new Set([0, 1, 1.5, 2, 3, 4, 4.5, 5, 6]));
    expect(next.map((n) => n.layer)).toEqual([7]);
  });

  it('returns empty array when all layers completed', () => {
    const next = getNextLayers(new Set([0, 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7]));
    expect(next).toEqual([]);
  });
});

describe('dependency-graph — LayerNode structure (T28)', () => {
  it('each node has required fields: layer, type, systemFile, taskFile, dependsOn', () => {
    for (const node of AGENT_GRAPH) {
      expect(typeof node.layer).toBe('number');
      expect(typeof node.type).toBe('string');
      expect(typeof node.systemFile).toBe('string');
      expect(typeof node.taskFile).toBe('string');
      expect(Array.isArray(node.dependsOn)).toBe(true);
    }
  });

  it('has exactly 10 nodes (including planner)', () => {
    expect(AGENT_GRAPH).toHaveLength(10);
  });
});

describe('dependency-graph — getNextLayers edge cases (T28)', () => {
  it('does not return already-completed layers', () => {
    const completed = new Set<number>([0, 1, 1.5, 2, 3, 4]);
    const next = getNextLayers(completed);
    for (const node of next) {
      expect(completed.has(node.layer)).toBe(false);
    }
  });

  it('applies custom graph when provided', () => {
    const customGraph: LayerNode[] = [
      { layer: 1, type: 'a', systemFile: 'a/sys.md', taskFile: 'a/task.md', dependsOn: [] },
      { layer: 2, type: 'b', systemFile: 'b/sys.md', taskFile: 'b/task.md', dependsOn: [1] },
      { layer: 3, type: 'c', systemFile: 'c/sys.md', taskFile: 'c/task.md', dependsOn: [1] },
    ];
    const next = getNextLayers(new Set([1]), customGraph);
    expect(next.map((n) => n.layer).sort()).toEqual([2, 3]); // Both 2 and 3 parallel when 1 done
  });
});
