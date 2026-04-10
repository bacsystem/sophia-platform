/**
 * Generates a markdown HU traceability matrix from criteria and test mapping.
 */
import type { CriteriaMap } from './criteria-extractor.js';
import type { TestMapping } from './orchestrator.js';

function getCriterionStatus(mapping: TestMapping['mappings'][number] | undefined): string {
  if (!mapping?.testFile) {
    return '❌ MISSING';
  }

  if (!mapping.testName || !mapping.type) {
    return '⚠️ PARTIAL';
  }

  return '✅ COVERED';
}

/**
 * Generates a markdown certification report with requirement→test traceability.
 *
 * @param criteriaMap - Parsed HU acceptance criteria from the spec
 * @param testMapping - Test mapping output from the QA agent
 * @returns Markdown string with traceability matrix and coverage summary
 */
export function generateCertificationReport(
  criteriaMap: CriteriaMap,
  testMapping: TestMapping,
): string {
  const mappingIndex = new Map(
    testMapping.mappings.map((m) => [m.criteriaId, m]),
  );

  const allIds = Object.values(criteriaMap).flatMap((hu) =>
    hu.criteria.map((c) => c.id),
  );
  const total = allIds.length;
  const covered = allIds.filter((id) => {
    const m = mappingIndex.get(id);
    return m?.testFile != null;
  }).length;
  const coveragePercent = total === 0 ? 100 : Math.round((covered / total) * 100);

  const rows: string[] = [];

  for (const [huId, hu] of Object.entries(criteriaMap)) {
    for (const criterion of hu.criteria) {
      const mapping = mappingIndex.get(criterion.id);
      const testName = mapping?.testName ?? '—';
      const testFile = mapping?.testFile ?? '—';
      const status = getCriterionStatus(mapping);
      rows.push(
        `| ${huId} — ${hu.name} | ${criterion.id}: ${criterion.text} | ${testName} | ${testFile} | ${status} |`,
      );
    }
  }

  const header = [
    '| HU | Criterion | Test | Test File | Status |',
    '|---|---|---|---|---|',
  ];

  const lines = [
    '# Certification Report',
    '',
    `Coverage: ${covered}/${total} criteria (${coveragePercent}%)`,
    '',
    ...header,
    ...rows,
  ];

  return lines.join('\n');
}
