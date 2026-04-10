/**
 * Tests for the HU certification report generator.
 * @module certification-report.test
 */
import { describe, it, expect } from 'vitest';
import { generateCertificationReport } from '../../agents/certification-report.js';
import type { CriteriaMap } from '../../agents/criteria-extractor.js';
import type { TestMapping } from '../../agents/orchestrator.js';

const CRITERIA_MAP: CriteriaMap = {
  'HU-14': {
    name: 'Create project',
    criteria: [
      { id: 'HU-14.CA-01', text: 'User can create a project with name' },
      { id: 'HU-14.CA-02', text: 'User can set project description' },
      { id: 'HU-14.CA-03', text: 'Duplicate names are rejected' },
    ],
  },
  'HU-15': {
    name: 'List projects',
    criteria: [
      { id: 'HU-15.CA-01', text: 'Returns paginated list' },
      { id: 'HU-15.CA-02', text: 'Filters by status' },
    ],
  },
};

const FULL_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: 'should create project', type: 'unit' },
    { criteriaId: 'HU-14.CA-02', testFile: 'src/__tests__/project.test.ts', testName: 'should set description', type: 'unit' },
    { criteriaId: 'HU-14.CA-03', testFile: 'src/__tests__/project.test.ts', testName: 'should reject duplicates', type: 'integration' },
    { criteriaId: 'HU-15.CA-01', testFile: 'src/__tests__/list.test.ts', testName: 'should paginate', type: 'integration' },
    { criteriaId: 'HU-15.CA-02', testFile: 'src/__tests__/list.test.ts', testName: 'should filter', type: 'unit' },
  ],
};

const PARTIAL_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: 'should create project', type: 'unit' },
    { criteriaId: 'HU-14.CA-02', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-14.CA-03', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-15.CA-01', testFile: 'src/__tests__/list.test.ts', testName: 'should paginate', type: 'integration' },
    { criteriaId: 'HU-15.CA-02', testFile: null, testName: null, type: null },
  ],
};

const MIXED_MAPPING: TestMapping = {
  mappings: [
    { criteriaId: 'HU-14.CA-01', testFile: 'src/__tests__/project.test.ts', testName: null, type: null },
    { criteriaId: 'HU-14.CA-02', testFile: 'src/__tests__/project.test.ts', testName: 'should set description', type: 'unit' },
    { criteriaId: 'HU-14.CA-03', testFile: null, testName: null, type: null },
    { criteriaId: 'HU-15.CA-01', testFile: 'src/__tests__/list.test.ts', testName: 'should paginate', type: 'integration' },
    { criteriaId: 'HU-15.CA-02', testFile: null, testName: null, type: null },
  ],
};

describe('generateCertificationReport', () => {
  it('includes a markdown title and coverage summary for 100% coverage', () => {
    const report = generateCertificationReport(CRITERIA_MAP, FULL_MAPPING);
    expect(report).toContain('# Certification Report');
    expect(report).toContain('Coverage: 5/5 criteria (100%)');
  });

  it('includes the matrix table header', () => {
    const report = generateCertificationReport(CRITERIA_MAP, FULL_MAPPING);
    expect(report).toContain('| HU | Criterion | Test | Test File | Status |');
    expect(report).toContain('|---|---|---|---|---|');
  });

  it('marks fully covered criteria as ✅ COVERED', () => {
    const report = generateCertificationReport(CRITERIA_MAP, FULL_MAPPING);
    expect(report).toContain('✅ COVERED');
    expect(report).not.toContain('❌ MISSING');
  });

  it('marks null-mapped criteria as ❌ MISSING', () => {
    const report = generateCertificationReport(CRITERIA_MAP, PARTIAL_MAPPING);
    expect(report).toContain('❌ MISSING');
  });

  it('marks incomplete mappings as ⚠️ PARTIAL', () => {
    const report = generateCertificationReport(CRITERIA_MAP, MIXED_MAPPING);
    expect(report).toContain('⚠️ PARTIAL');
  });

  it('shows correct partial coverage summary (2/5 = 40%)', () => {
    const report = generateCertificationReport(CRITERIA_MAP, PARTIAL_MAPPING);
    expect(report).toContain('Coverage: 2/5 criteria (40%)');
  });

  it('includes HU name and criteriaId in each row', () => {
    const report = generateCertificationReport(CRITERIA_MAP, FULL_MAPPING);
    expect(report).toContain('HU-14');
    expect(report).toContain('Create project');
    expect(report).toContain('HU-14.CA-01');
    expect(report).toContain('HU-15');
    expect(report).toContain('List projects');
  });

  it('returns trivial 100% for empty criteria map', () => {
    const report = generateCertificationReport({}, { mappings: [] });
    expect(report).toContain('Coverage: 0/0 criteria (100%)');
  });
});
