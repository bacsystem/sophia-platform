/**
 * Certification E2E test (T43):
 * spec criteria extraction → quality gate validation → certification report generation.
 * Verifies the full HU traceability pipeline as an integration of all Phase 4 modules.
 */
import { describe, it, expect } from 'vitest';
import { extractCriteria } from '../../agents/criteria-extractor.js';
import { verifyCriteriaCoverage } from '../../agents/quality-gate.js';
import { generateCertificationReport } from '../../agents/certification-report.js';
import type { TestMapping } from '../../agents/orchestrator.js';

const SPEC_MD = `
# Spec

## HU-20 — Register user

### HU-20 — Register user

- [ ] Form validates required fields
- [ ] Duplicate emails are rejected
- [ ] Password is hashed before storage

### HU-21 — Login

- [ ] Returns JWT on valid credentials
- [ ] Rejects invalid password
`;

const FULL_TEST_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-20.CA-01', testFile: 'src/__tests__/auth.test.ts', testName: 'validates required fields', type: 'unit' },
    { criteriaId: 'HU-20.CA-02', testFile: 'src/__tests__/auth.test.ts', testName: 'rejects duplicate email', type: 'integration' },
    { criteriaId: 'HU-20.CA-03', testFile: 'src/__tests__/auth.test.ts', testName: 'hashes password', type: 'unit' },
    { criteriaId: 'HU-21.CA-01', testFile: 'src/__tests__/auth.test.ts', testName: 'returns JWT on login', type: 'unit' },
    { criteriaId: 'HU-21.CA-02', testFile: 'src/__tests__/auth.test.ts', testName: 'rejects invalid password', type: 'unit' },
  ],
};

const PARTIAL_TEST_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-20.CA-01', testFile: 'src/__tests__/auth.test.ts', testName: 'validates required fields', type: 'unit' },
    { criteriaId: 'HU-20.CA-02', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-20.CA-03', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-21.CA-01', testFile: 'src/__tests__/auth.test.ts', testName: 'returns JWT on login', type: 'unit' },
    { criteriaId: 'HU-21.CA-02', testFile: null, testName: null, type: null },
  ],
};

describe('Certification pipeline — E2E (T43)', () => {
  it('full pipeline: extracts 5 criteria from 2 HUs', () => {
    const criteria = extractCriteria(SPEC_MD);
    expect(Object.keys(criteria)).toHaveLength(2);
    expect(criteria['HU-20'].criteria).toHaveLength(3);
    expect(criteria['HU-21'].criteria).toHaveLength(2);
  });

  it('full pipeline: quality gate passes at 100% coverage', () => {
    const criteria = extractCriteria(SPEC_MD);
    const result = verifyCriteriaCoverage(criteria, FULL_TEST_MAPPING);
    expect(result.passed).toBe(true);
    expect(result.coveragePercent).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('full pipeline: quality gate fails at 40% coverage (3/5 missing)', () => {
    const criteria = extractCriteria(SPEC_MD);
    const result = verifyCriteriaCoverage(criteria, PARTIAL_TEST_MAPPING);
    expect(result.passed).toBe(false);
    expect(result.covered).toBe(2);
    expect(result.total).toBe(5);
    expect(result.missing).toHaveLength(3);
    expect(result.missing).toContain('HU-20.CA-02');
    expect(result.missing).toContain('HU-20.CA-03');
    expect(result.missing).toContain('HU-21.CA-02');
  });

  it('full pipeline: certification report generated with correct matrix for 100% coverage', () => {
    const criteria = extractCriteria(SPEC_MD);
    const report = generateCertificationReport(criteria, FULL_TEST_MAPPING);
    expect(report).toContain('# Certification Report');
    expect(report).toContain('Coverage: 5/5 criteria (100%)');
    expect(report).toContain('✅ COVERED');
    expect(report).not.toContain('❌ MISSING');
    // Matrix rows include HU IDs and criteria IDs
    expect(report).toContain('HU-20.CA-01');
    expect(report).toContain('HU-21.CA-01');
  });

  it('full pipeline: certification report shows MISSING for uncovered criteria in partial mapping', () => {
    const criteria = extractCriteria(SPEC_MD);
    const report = generateCertificationReport(criteria, PARTIAL_TEST_MAPPING);
    expect(report).toContain('Coverage: 2/5 criteria (40%)');
    expect(report).toContain('❌ MISSING');
    expect(report).toContain('✅ COVERED');
    // Missing criteria rows
    expect(report).toContain('HU-20.CA-02');
    expect(report).toContain('HU-21.CA-02');
  });

  it('full pipeline: custom threshold — 40% passes with threshold=40', () => {
    const criteria = extractCriteria(SPEC_MD);
    const result = verifyCriteriaCoverage(criteria, PARTIAL_TEST_MAPPING, 40);
    expect(result.passed).toBe(true);
    expect(result.coveragePercent).toBe(40);
  });
});
