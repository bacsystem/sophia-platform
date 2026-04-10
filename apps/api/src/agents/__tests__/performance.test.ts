/**
 * T49: Performance benchmarks for M9 improvements.
 * These tests assert that key operations complete within defined SLA targets.
 * They do NOT require live DB or Anthropic API — all I/O is mocked or in-memory.
 */
import { describe, it, expect, vi } from 'vitest';
import { extractCriteria } from '../../agents/criteria-extractor.js';
import { generateCertificationReport } from '../../agents/certification-report.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function elapsedAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function generateSpec(huCount: number, criteriaPerHu: number): string {
  const lines: string[] = ['# Spec\n'];
  for (let h = 1; h <= huCount; h++) {
    lines.push(`### HU-${String(h).padStart(2, '0')} — Feature ${h}\n`);
    for (let c = 1; c <= criteriaPerHu; c++) {
      lines.push(`- [ ] Criterion ${h}.${c}: some acceptance criterion text that is long enough\n`);
    }
  }
  return lines.join('');
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

describe('Performance benchmarks (T49)', () => {
  // Target: criteria extraction < 1s for any realistic spec
  it('extractCriteria: 50 HUs × 5 criteria = 250 total — completes in < 200ms', () => {
    const spec = generateSpec(50, 5);
    const ms = elapsed(() => extractCriteria(spec));
    // 250 criteria parsed purely from regex — should be well under 200ms
    expect(ms).toBeLessThan(200);
  });

  it('extractCriteria: 10 HUs × 3 criteria = 30 total — completes in < 20ms', () => {
    const spec = generateSpec(10, 3);
    const ms = elapsed(() => extractCriteria(spec));
    expect(ms).toBeLessThan(20);
  });

  // Target: certification report generation < 500ms
  it('generateCertificationReport: 50 HUs × 5 criteria (100% covered) — completes in < 200ms', () => {
    const spec = generateSpec(50, 5);
    const criteria = extractCriteria(spec);
    const allIds = Object.values(criteria).flatMap((hu) => hu.criteria.map((c) => c.id));
    const mappings = allIds.map((id) => ({
      criteriaId: id,
      testFile: 'src/__tests__/test.test.ts',
      testName: `test for ${id}`,
      type: 'unit' as const,
    }));

    const ms = elapsed(() => generateCertificationReport(criteria, { mappings }));
    expect(ms).toBeLessThan(200);
  });

  // Target: skill file composition — test the string operations that composeSystemPrompt does
  it('string composition (composeSystemPrompt equivalent): 10 shared skills × 5KB each — < 10ms', () => {
    const skill5kb = 'x'.repeat(5_000);
    const skills = Array.from({ length: 10 }, () => skill5kb);
    const agentSystem = 'x'.repeat(5_000);

    const ms = elapsed(() => {
      void [...skills, agentSystem].join('\n\n---\n\n');
    });
    expect(ms).toBeLessThan(10);
  });

  // Skill load time equivalent — JSON parse of a 50-entry test-mapping.json
  it('JSON.parse test-mapping.json (250 mappings): < 10ms', () => {
    const mappings = Array.from({ length: 250 }, (_, i) => ({
      criteriaId: `HU-${String(Math.floor(i / 5) + 1).padStart(2, '0')}.CA-0${(i % 5) + 1}`,
      testFile: `src/__tests__/hu-${i}.test.ts`,
      testName: `test case ${i}`,
      type: i % 2 === 0 ? 'unit' : 'integration',
    }));
    const raw = JSON.stringify({ mappings });

    const ms = elapsed(() => JSON.parse(raw));
    expect(ms).toBeLessThan(10);
  });

  // Persist latency simulation — async function call overhead without DB
  it('async function dispatch overhead (10 concurrent agent-like tasks): < 50ms total', async () => {
    const mockPersist = vi.fn().mockResolvedValue(undefined);

    const ms = await elapsedAsync(async () => {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) => mockPersist(`turn-${i}`, 'content')),
      );
    });
    expect(ms).toBeLessThan(50);
  });
});
