/**
 * @description Agent dependency graph for parallel pipeline execution.
 * Defines which layers can run in parallel and which require sequential ordering.
 * Parallel pairs: L4 (QA) ‖ L4.5 (Security), L5 (Docs) ‖ L6 (Deploy).
 */

export interface LayerNode {
  /** Numeric layer identifier (matches orchestrator layer numbering) */
  layer: number;
  /** Agent type string used for logging and skill-file lookup */
  type: string;
  systemFile: string;
  taskFile: string;
  /** Layers that must be completed before this one can start */
  dependsOn: number[];
}

/**
 * @description Full 9-node dependency graph for the Sophia agent pipeline.
 * L4 and L4.5 can run in parallel (both depend only on L3).
 * L5 and L6 can run in parallel (both depend on L4 and L4.5).
 */
export const AGENT_GRAPH: LayerNode[] = [
  { layer: 1,   type: 'dba-agent',         systemFile: 'dba-agent/system.md',         taskFile: 'dba-agent/task.md',         dependsOn: [] },
  { layer: 1.5, type: 'seed-agent',        systemFile: 'seed-agent/system.md',        taskFile: 'seed-agent/task.md',        dependsOn: [1] },
  { layer: 2,   type: 'backend-agent',     systemFile: 'backend-agent/system.md',     taskFile: 'backend-agent/task.md',     dependsOn: [1, 1.5] },
  { layer: 3,   type: 'frontend-agent',    systemFile: 'frontend-agent/system.md',    taskFile: 'frontend-agent/task.md',    dependsOn: [2] },
  { layer: 4,   type: 'qa-agent',          systemFile: 'qa-agent/system.md',          taskFile: 'qa-agent/task.md',          dependsOn: [3] },
  { layer: 4.5, type: 'security-agent',    systemFile: 'security-agent/system.md',    taskFile: 'security-agent/task.md',    dependsOn: [3] },
  { layer: 5,   type: 'docs-agent',        systemFile: 'docs-agent/system.md',        taskFile: 'docs-agent/task.md',        dependsOn: [4, 4.5] },
  { layer: 6,   type: 'deploy-agent',      systemFile: 'deploy-agent/system.md',      taskFile: 'deploy-agent/task.md',      dependsOn: [4, 4.5] },
  { layer: 7,   type: 'integration-agent', systemFile: 'integration-agent/system.md', taskFile: 'integration-agent/task.md', dependsOn: [5, 6] },
];

/**
 * @description Returns all layers that are ready to execute given the set of completed layers.
 * A layer is ready when all its dependencies have been completed and it is not yet completed.
 * @param completed - Set of layer numbers that have already finished.
 * @param graph - Optional custom graph (defaults to AGENT_GRAPH).
 */
export function getNextLayers(completed: Set<number>, graph: LayerNode[] = AGENT_GRAPH): LayerNode[] {
  return graph.filter(
    (node) =>
      !completed.has(node.layer) &&
      node.dependsOn.every((dep) => completed.has(dep)),
  );
}
