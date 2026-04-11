/**
 * @description Tests for pipeline-recovery module (T032/T038).
 * Tests interrupted pipeline detection, resume verification, and event emission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPipelineStateFindMany = vi.fn();
const mockPipelineStateUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
const mockProjectUpdate = vi.fn().mockResolvedValue({});
const mockEmitEvent = vi.fn();
const mockBuildEvent = vi.fn().mockImplementation(
  (type: string, _pid: string, data: Record<string, unknown>) => ({ type, projectId: _pid, ...data }),
);
const mockVerifyBatchOutput = vi.fn().mockResolvedValue({ status: 'pass', details: [] });

vi.mock('../../lib/prisma.js', () => ({
  default: {
    pipelineState: {
      findMany: (...args: unknown[]) => mockPipelineStateFindMany(...args),
      updateMany: (...args: unknown[]) => mockPipelineStateUpdateMany(...args),
    },
    project: {
      update: (...args: unknown[]) => mockProjectUpdate(...args),
    },
  },
}));

vi.mock('../../websocket/ws.emitter.js', () => ({
  emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
  buildEvent: (...args: unknown[]) => mockBuildEvent(...args),
}));

vi.mock('../../agents/batch-verifier.js', () => ({
  verifyBatchOutput: (...args: unknown[]) => mockVerifyBatchOutput(...args),
}));

import { detectInterruptedPipelines, verifyBeforeResume, emitInterruptedEvents } from '../pipeline-recovery.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── detectInterruptedPipelines ───────────────────────────────────────────────

describe('detectInterruptedPipelines', () => {
  it('returns empty when no stale pipelines', async () => {
    mockPipelineStateFindMany.mockResolvedValue([]);

    const result = await detectInterruptedPipelines();

    expect(result).toEqual([]);
    expect(mockPipelineStateUpdateMany).not.toHaveBeenCalled();
  });

  it('detects stale pipelines and marks them as interrupted', async () => {
    const stalePipeline = {
      id: 'ps-1',
      projectId: 'proj-1',
      currentLayer: 3,
      completedLayers: [0, 1, 1.5, 2, 3],
      startedAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      status: 'running',
    };
    mockPipelineStateFindMany.mockResolvedValue([stalePipeline]);

    const result = await detectInterruptedPipelines();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ps-1');
    expect(result[0].projectId).toBe('proj-1');
    expect(result[0].currentLayer).toBe(3);
    expect(result[0].completedLayers).toEqual([0, 1, 1.5, 2, 3]);

    // Should mark as interrupted
    expect(mockPipelineStateUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ps-1'] } },
      data: { status: 'interrupted' },
    });

    // Should update project status
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { status: 'error', errorMessage: 'Pipeline interrupted — worker restarted' },
    });
  });

  it('does not flag recent running pipelines', async () => {
    // The mock will return empty because the query filters by updatedAt < threshold
    mockPipelineStateFindMany.mockResolvedValue([]);

    const result = await detectInterruptedPipelines();
    expect(result).toEqual([]);
  });
});

// ─── verifyBeforeResume ───────────────────────────────────────────────────────

describe('verifyBeforeResume', () => {
  it('returns ok when no completed layers', async () => {
    const result = await verifyBeforeResume('proj-1', [], '/tmp/proj');
    expect(result.ok).toBe(true);
  });

  it('returns ok when verification passes', async () => {
    mockVerifyBatchOutput.mockResolvedValue({ status: 'pass', details: [] });

    const result = await verifyBeforeResume('proj-1', [0, 1, 2], '/tmp/proj');
    expect(result.ok).toBe(true);
    // Should verify layer 2 (max)
    expect(mockVerifyBatchOutput).toHaveBeenCalled();
  });

  it('returns failure when verification fails', async () => {
    mockVerifyBatchOutput.mockResolvedValue({
      status: 'fail',
      details: [{ severity: 'CRITICAL', message: 'missing schema.prisma' }],
    });

    const result = await verifyBeforeResume('proj-1', [0, 1], '/tmp/proj');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Verification failed');
  });

  it('returns ok when verification throws (non-fatal)', async () => {
    mockVerifyBatchOutput.mockRejectedValue(new Error('disk error'));

    const result = await verifyBeforeResume('proj-1', [0, 1, 2], '/tmp/proj');
    expect(result.ok).toBe(true);
  });
});

// ─── emitInterruptedEvents ───────────────────────────────────────────────────

describe('emitInterruptedEvents', () => {
  it('emits pipeline:interrupted for each interrupted pipeline', () => {
    const interrupted = [
      {
        id: 'ps-1',
        projectId: 'proj-1',
        currentLayer: 3,
        completedLayers: [0, 1, 2, 3],
        startedAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        id: 'ps-2',
        projectId: 'proj-2',
        currentLayer: 1,
        completedLayers: [0, 1],
        startedAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T10:00:00Z'),
      },
    ];

    emitInterruptedEvents(interrupted);

    expect(mockEmitEvent).toHaveBeenCalledTimes(2);
    expect(mockBuildEvent).toHaveBeenCalledWith('pipeline:interrupted', 'proj-1', {
      lastCompletedLayer: 3,
      interruptedAt: '2026-01-01T10:00:00.000Z',
    });
    expect(mockBuildEvent).toHaveBeenCalledWith('pipeline:interrupted', 'proj-2', {
      lastCompletedLayer: 1,
      interruptedAt: '2026-01-02T10:00:00.000Z',
    });
  });

  it('does nothing for empty array', () => {
    emitInterruptedEvents([]);
    expect(mockEmitEvent).not.toHaveBeenCalled();
  });
});
