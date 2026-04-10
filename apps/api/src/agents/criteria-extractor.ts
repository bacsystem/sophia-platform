/**
 * @description Parses HU acceptance criteria from a spec.md file.
 * Each HU section starting with `### HU-XX — Name` is scanned for
 * `- [ ] criterion` checkboxes. Criteria receive sequential IDs: HU-14.CA-01, etc.
 */

export interface Criterion {
  id: string;
  text: string;
}

export interface HUEntry {
  name: string;
  criteria: Criterion[];
}

/** Map from HU code (e.g. "HU-14") to its name and acceptance criteria list. */
export type CriteriaMap = Record<string, HUEntry>;

// Matches `### HU-14 — Execute Agent Pipeline` (em-dash or regular dash)
const HU_HEADER = /^###\s+(HU-\d+)\s+[—–-]+\s+(.+)$/;
// Matches `- [ ] criterion text`
const CHECKBOX = /^-\s+\[\s*\]\s+(.+)$/;

/**
 * @description Extracts acceptance criteria from spec.md content.
 * Parses all `### HU-XX` headers and their `- [ ]` checkboxes.
 * HUs without checkboxes are included with an empty criteria array.
 *
 * @param specContent - Raw markdown text of the spec.md file
 * @returns CriteriaMap keyed by HU code
 */
export function extractCriteria(specContent: string): CriteriaMap {
  const result: CriteriaMap = {};

  let currentHU: string | null = null;
  let criteriaIndex = 0;

  for (const line of specContent.split('\n')) {
    const huMatch = HU_HEADER.exec(line.trim());
    if (huMatch) {
      currentHU = huMatch[1];
      const name = huMatch[2].trim();
      result[currentHU] = { name, criteria: [] };
      criteriaIndex = 0;
      continue;
    }

    if (currentHU) {
      const cbMatch = CHECKBOX.exec(line.trim());
      if (cbMatch) {
        criteriaIndex++;
        const id = `${currentHU}.CA-${String(criteriaIndex).padStart(2, '0')}`;
        result[currentHU].criteria.push({ id, text: cbMatch[1].trim() });
      }
    }
  }

  return result;
}
