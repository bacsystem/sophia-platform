/**
 * @description Tests for context-builder: token budget, file prioritization, summarization.
 * T20 (token-budget prioritization) + T21 (context-builder tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  default: {
    generatedFile: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec\nBuild a cool app.');
      if (filePath.includes('project_memory.md')) return Promise.resolve('## Layer 1: dba-agent\n### Summary\nSchema created.');
      // Default: return short content
      return Promise.resolve('file content here');
    }),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('context-builder — file summarization (T20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('summarizes files larger than 10KB (first 50 + last 20 lines)', async () => {
    // Generate a large file content > 10KB (each line ~80 chars to ensure >10KB total)
    const lines = Array.from(
      { length: 200 },
      (_, i) => `line ${i + 1}: this is padding content to ensure the file exceeds the 10KB threshold limit`,
    );
    const largeContent = lines.join('\n');
    expect(largeContent.length).toBeGreaterThan(10 * 1024);

    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      if (String(p).includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.resolve(largeContent);
    });

    mockFindMany.mockResolvedValue([
      { path: 'src/large-file.ts', sizeBytes: 15_000 },
    ]);
    mockCount.mockResolvedValue(1);

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([1]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
    });
    // Should contain summary indicator
    expect(result).toContain('large-file.ts');
    // Should NOT contain all 200 lines (it's summarized)
    expect(result).not.toContain('line 100:');
    // Should contain first and last lines
    expect(result).toContain('line 1:');
    expect(result).toContain('line 200:');
  });
});

describe('context-builder — project_memory injection (T17/T21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('injects project_memory when file exists', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec content');
      if (String(p).includes('project_memory.md')) return Promise.resolve('## Layer 1: dba-agent\n### Summary\nCreated schema.');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([1]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
    });

    expect(result).toContain('Project Memory');
    expect(result).toContain('Layer 1: dba-agent');
    expect(result).toContain('Created schema.');
  });

  it('omits project_memory section when file does not exist', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec content');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
    });

    expect(result).not.toContain('Project Memory');
  });
});

describe('context-builder — parallel-safe injection (T30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('queries using completedLayers set (in) for parallel-safe injection', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([1, 1.5, 2, 3]),
      taskTemplate: '{{SPEC}}\n{{FILES_LIST}}',
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          layer: { in: [1, 1.5, 2, 3] },
        }),
      }),
    );
  });
});

describe('context-builder — certification context injection (T42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('injects criteriaMap and test-mapping.json for integration-agent (L7)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) {
        return Promise.resolve('### HU-14 — Create project\n\n- [ ] User can create a project');
      }
      if (filePath.includes('test-mapping.json')) {
        return Promise.resolve('{"mappings":[{"criteriaId":"HU-14.CA-01","testFile":"src/__tests__/project.test.ts","testName":"should create project","type":"unit"}]}');
      }
      if (filePath.includes('project_memory.md')) {
        return Promise.reject(new Error('ENOENT'));
      }
      return Promise.resolve('file content here');
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([1, 1.5, 2, 3, 4, 4.5, 5, 6]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 7,
    });

    expect(result).toContain('Criteria Map');
    expect(result).toContain('HU-14.CA-01');
    expect(result).toContain('test-mapping.json');
  });
});

describe('context-builder — token budget (T20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('includes all files when under token budget', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      if (String(p).includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.resolve('small content'); // < 10KB
    });

    // 5 small files
    mockFindMany.mockResolvedValue([
      { path: 'a.sql', sizeBytes: 100 },
      { path: 'b.sql', sizeBytes: 200 },
      { path: 'c.ts', sizeBytes: 150 },
      { path: 'd.ts', sizeBytes: 100 },
      { path: 'e.ts', sizeBytes: 120 },
    ]);
    mockCount.mockResolvedValue(5);

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([1, 1.5, 2]),
      taskTemplate: '{{SPEC}}\n{{FILES_LIST}}',
    });

    expect(result).toContain('a.sql');
    expect(result).toContain('e.ts');
  });
});

describe('context-builder — spec artifacts injection (M10-T004/T006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('injects ambiguities.md and brainstorm.md for layers >= 1', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec content');
      if (filePath.endsWith('spec/ambiguities.md')) return Promise.resolve('### Ambigüedad 1: Rendimiento\n- **Término**: rápido');
      if (filePath.endsWith('spec/brainstorm.md')) return Promise.resolve('### Decisión 1: Auth\n| Enfoque | Pros | Cons |');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 1,
    });

    expect(result).toContain('Ambiguities');
    expect(result).toContain('Ambigüedad 1: Rendimiento');
    expect(result).toContain('Brainstorm');
    expect(result).toContain('Decisión 1: Auth');
  });

  it('does not inject spec artifacts when currentLayer is undefined (spec-agent itself)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
    });

    expect(result).not.toContain('Ambiguities');
    expect(result).not.toContain('Brainstorm');
  });

  it('handles missing ambiguities.md gracefully (brainstorm still injected)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('spec/brainstorm.md')) return Promise.resolve('### Decisión 1: DB model');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 2,
    });

    expect(result).not.toContain('Ambiguities');
    expect(result).toContain('Brainstorm');
    expect(result).toContain('Decisión 1: DB model');
  });

  it('injects ambiguities before brainstorm in correct order', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('spec/ambiguities.md')) return Promise.resolve('AMBIGUITIES_CONTENT');
      if (filePath.endsWith('spec/brainstorm.md')) return Promise.resolve('BRAINSTORM_CONTENT');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 3,
    });

    const ambIdx = result.indexOf('AMBIGUITIES_CONTENT');
    const brainIdx = result.indexOf('BRAINSTORM_CONTENT');
    expect(ambIdx).toBeGreaterThan(-1);
    expect(brainIdx).toBeGreaterThan(-1);
    expect(ambIdx).toBeLessThan(brainIdx);
  });
});

describe('context-builder — execution-plan injection (M10-T010)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('injects execution-plan.md for layers >= 1', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('plan/execution-plan.md')) return Promise.resolve('## DBA Agent\nFoco: schema.prisma');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 1,
    });

    expect(result).toContain('Execution Plan');
    expect(result).toContain('DBA Agent');
    expect(result).toContain('Foco: schema.prisma');
  });

  it('does not inject execution-plan.md for layer 0 (planner itself)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 0,
    });

    expect(result).not.toContain('Execution Plan');
  });

  it('handles missing execution-plan.md gracefully', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('spec.md')) return Promise.resolve('# Spec');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 2,
    });

    expect(result).not.toContain('Execution Plan');
  });

  it('injects execution-plan after brainstorm and before memory', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('spec/brainstorm.md')) return Promise.resolve('BRAINSTORM_HERE');
      if (filePath.endsWith('plan/execution-plan.md')) return Promise.resolve('PLAN_HERE');
      if (filePath.includes('project_memory.md')) return Promise.resolve('MEMORY_HERE');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 1,
    });

    const brainstormIdx = result.indexOf('BRAINSTORM_HERE');
    const planIdx = result.indexOf('PLAN_HERE');
    const memoryIdx = result.indexOf('MEMORY_HERE');
    expect(brainstormIdx).toBeGreaterThan(-1);
    expect(planIdx).toBeGreaterThan(-1);
    expect(memoryIdx).toBeGreaterThan(-1);
    expect(planIdx).toBeGreaterThan(brainstormIdx);
    expect(memoryIdx).toBeGreaterThan(planIdx);
  });
});

describe('context-builder — test-contracts injection (M10-T017/T018)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('injects test-contracts.md for layer 2 (backend-agent)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('test-contracts.md')) return Promise.resolve('## Entity: User\n### CRUD operations\nPOST /api/users');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0, 1]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 2,
    });

    expect(result).toContain('Test Contracts');
    expect(result).toContain('Entity: User');
    expect(result).toContain('POST /api/users');
  });

  it('injects test-contracts.md for layer 3 (frontend-agent)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('test-contracts.md')) return Promise.resolve('## Entity: Project\nExpected UI');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0, 1, 2]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 3,
    });

    expect(result).toContain('Test Contracts');
    expect(result).toContain('Entity: Project');
  });

  it('does NOT inject test-contracts.md for layer 4 (QA agent)', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('test-contracts.md')) return Promise.resolve('## Entity: User\nShould not appear');
      if (filePath.includes('project_memory.md')) return Promise.reject(new Error('ENOENT'));
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0, 1, 2, 3]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 4,
    });

    expect(result).not.toContain('Test Contracts');
    expect(result).not.toContain('Should not appear');
  });

  it('handles missing test-contracts.md gracefully', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0, 1]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 2,
    });

    expect(result).not.toContain('Test Contracts');
  });

  it('injects test-contracts after execution-plan and before memory', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readFile as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      const filePath = String(p);
      if (filePath.includes('spec.md')) return Promise.resolve('# Spec');
      if (filePath.endsWith('plan/execution-plan.md')) return Promise.resolve('PLAN_HERE');
      if (filePath.endsWith('test-contracts.md')) return Promise.resolve('CONTRACTS_HERE');
      if (filePath.includes('project_memory.md')) return Promise.resolve('MEMORY_HERE');
      return Promise.reject(new Error('ENOENT'));
    });

    const { buildTaskPrompt } = await import('../../agents/context-builder.js');
    const result = await buildTaskPrompt({
      projectId: 'p1',
      projectDir: '/proj',
      completedLayers: new Set([0, 1]),
      taskTemplate: 'Spec: {{SPEC}}\nFiles: {{FILES_LIST}}',
      currentLayer: 2,
    });

    const planIdx = result.indexOf('PLAN_HERE');
    const contractsIdx = result.indexOf('CONTRACTS_HERE');
    const memoryIdx = result.indexOf('MEMORY_HERE');
    expect(planIdx).toBeGreaterThan(-1);
    expect(contractsIdx).toBeGreaterThan(-1);
    expect(memoryIdx).toBeGreaterThan(-1);
    expect(contractsIdx).toBeGreaterThan(planIdx);
    expect(memoryIdx).toBeGreaterThan(contractsIdx);
  });
});
