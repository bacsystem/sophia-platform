/**
 * @description Tests for quality gate — criteria coverage verification and re-run logic (T39).
 */
import { describe, it, expect } from 'vitest';
import { verifyCriteriaCoverage } from '../../agents/quality-gate.js';
import type { CriteriaMap } from '../../agents/criteria-extractor.js';
import type { TestMapping } from '../../agents/orchestrator.js';

const CRITERIA_MAP: CriteriaMap = {
  'HU-14': {
    name: 'Execute Pipeline',
    criteria: [
      { id: 'HU-14.CA-01', text: 'Pipeline runs all 9 agents' },
      { id: 'HU-14.CA-02', text: 'Each agent receives context' },
      { id: 'HU-14.CA-03', text: 'Failed agent marks error' },
      { id: 'HU-14.CA-04', text: 'Progress emitted via WebSocket' },
      { id: 'HU-14.CA-05', text: 'Retry skips completed layers' },
    ],
  },
};

const FULL_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-14.CA-01', testFile: 'a.test.ts', testName: 'test 1', type: 'unit' },
    { criteriaId: 'HU-14.CA-02', testFile: 'a.test.ts', testName: 'test 2', type: 'unit' },
    { criteriaId: 'HU-14.CA-03', testFile: 'a.test.ts', testName: 'test 3', type: 'integration' },
    { criteriaId: 'HU-14.CA-04', testFile: 'a.test.ts', testName: 'test 4', type: 'unit' },
    { criteriaId: 'HU-14.CA-05', testFile: 'a.test.ts', testName: 'test 5', type: 'unit' },
  ],
};

const PARTIAL_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-14.CA-01', testFile: 'a.test.ts', testName: 'test 1', type: 'unit' },
    { criteriaId: 'HU-14.CA-02', testFile: 'a.test.ts', testName: 'test 2', type: 'unit' },
    { criteriaId: 'HU-14.CA-03', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-14.CA-04', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-14.CA-05', testFile: null, testName: null, type: null },
  ],
};

describe('quality-gate — verifyCriteriaCoverage (T39)', () => {
  it('returns 100% coverage when all criteria have tests', () => {
    const result = verifyCriteriaCoverage(CRITERIA_MAP, FULL_MAPPING);

    expect(result.coveragePercent).toBe(100);
    expect(result.covered).toBe(5);
    expect(result.total).toBe(5);
    expect(result.missing).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it('returns partial coverage with list of missing criteria', () => {
    const result = verifyCriteriaCoverage(CRITERIA_MAP, PARTIAL_MAPPING);

    expect(result.coveragePercent).toBe(40);
    expect(result.covered).toBe(2);
    expect(result.total).toBe(5);
    expect(result.missing).toHaveLength(3);
    expect(result.missing).toContain('HU-14.CA-03');
    expect(result.missing).toContain('HU-14.CA-04');
    expect(result.missing).toContain('HU-14.CA-05');
  });

  it('fails gate when coverage < 80% (default threshold)', () => {
    const result = verifyCriteriaCoverage(CRITERIA_MAP, PARTIAL_MAPPING);
    expect(result.passed).toBe(false);
  });

  it('passes gate when coverage meets custom threshold', () => {
    const result = verifyCriteriaCoverage(CRITERIA_MAP, PARTIAL_MAPPING, 40);
    expect(result.passed).toBe(true);
  });

  it('handles empty test mapping gracefully (0% coverage)', () => {
    const result = verifyCriteriaCoverage(CRITERIA_MAP, { mappings: [] });

    expect(result.coveragePercent).toBe(0);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(false);
  });

  it('handles empty criteria map (100% trivially)', () => {
    const result = verifyCriteriaCoverage({}, FULL_MAPPING);

    expect(result.coveragePercent).toBe(100);
    expect(result.total).toBe(0);
    expect(result.passed).toBe(true);
  });
});
