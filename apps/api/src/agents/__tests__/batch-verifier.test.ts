/**
 * @description Tests for batch-verifier: output validation after each agent layer.
 * T019 (create batch-verifier) + T024 (integration tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  default: {
    stat: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe('batch-verifier — verifyBatchOutput (M10-T019)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pass when expected file exists and is non-empty', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('pass');
    expect(result.details).toHaveLength(0);
  });

  it('returns fail (CRITICAL) when expected file is missing', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('fail');
    expect(result.details).toHaveLength(1);
    expect(result.details[0].severity).toBe('CRITICAL');
    expect(result.details[0].message).toContain('not found');
    expect(result.details[0].file).toBe('prisma/schema.prisma');
  });

  it('returns warn (MEDIUM) when expected file is empty', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 0 });

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('warn');
    expect(result.details[0].severity).toBe('MEDIUM');
    expect(result.details[0].message).toContain('empty');
  });

  it('uses plan content to extract expected files when provided', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 500 });

    const planContent = `## DBA Agent\nFoco: generar \`prisma/schema.prisma\` y \`prisma/migrations/init.sql\`\n\n## Seed Agent\nGenerar seed.ts`;

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
      planContent,
    );

    expect(result.status).toBe('pass');
    // Should have checked both files from plan
    expect(fsMod.default.stat).toHaveBeenCalledTimes(2);
  });

  it('falls back to structural patterns when plan has no files for agent', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 100 });

    const planContent = `## Backend Agent\nBuild the routes`;

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
      planContent,
    );

    // Fell back to EXPECTED_PATTERNS[1] = ['prisma/schema.prisma']
    expect(result.status).toBe('pass');
    expect(fsMod.default.stat).toHaveBeenCalledTimes(1);
  });

  it('checks directory patterns (ending with /) using readdir', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readdir as ReturnType<typeof vi.fn>).mockResolvedValue(['module1', 'module2']);

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 2, type: 'backend-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('pass');
    expect(fsMod.default.readdir).toHaveBeenCalled();
  });

  it('returns warn for empty directory', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 2, type: 'backend-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('warn');
    expect(result.details.some((d) => d.message.includes('empty'))).toBe(true);
  });

  it('returns pass for layer with no expected patterns and no plan', async () => {
    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 5, type: 'docs-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
    );

    expect(result.status).toBe('pass');
    expect(result.details).toHaveLength(0);
  });
});

describe('batch-verifier — plan-based extraction (M10-T024)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts multiple files from plan agent section with backtick paths', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 500 });

    const planContent = [
      '## Backend Agent',
      'Foco: crear `src/modules/auth/auth.routes.ts`, `src/modules/auth/auth.service.ts`',
      'También generar `src/modules/auth/auth.schema.ts`',
      '',
      '## Frontend Agent',
      'Generar `src/app/login/page.tsx`',
    ].join('\n');

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 2, type: 'backend-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
      planContent,
    );

    expect(result.status).toBe('pass');
    // Should have checked 3 files from backend-agent section
    expect(fsMod.default.stat).toHaveBeenCalledTimes(3);
  });

  it('returns fail when plan specifies file that is missing', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ size: 200 })  // first file OK
      .mockRejectedValueOnce(new Error('ENOENT'));  // second file missing

    const planContent = '## Seed Agent\nGenerar `prisma/seed.ts` y `prisma/factories.ts`';

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1.5, type: 'seed-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
      planContent,
    );

    expect(result.status).toBe('fail');
    expect(result.details).toHaveLength(1);
    expect(result.details[0].severity).toBe('CRITICAL');
    expect(result.details[0].file).toBe('prisma/factories.ts');
  });

  it('uses only the matching agent section from plan, ignores other agents', async () => {
    const fsMod = await import('node:fs/promises');
    (fsMod.default.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 100 });

    const planContent = [
      '## DBA Agent',
      'Generar `prisma/schema.prisma`',
      '',
      '## Frontend Agent',
      'Generar `src/app/page.tsx` y `src/components/Header.tsx`',
    ].join('\n');

    const { verifyBatchOutput } = await import('../../agents/batch-verifier.js');
    const result = await verifyBatchOutput(
      { layer: 1, type: 'dba-agent', systemFile: '', taskFile: '', dependsOn: [] },
      '/proj',
      planContent,
    );

    expect(result.status).toBe('pass');
    // Only checked 1 file from DBA section, not frontend files
    expect(fsMod.default.stat).toHaveBeenCalledTimes(1);
  });
});
