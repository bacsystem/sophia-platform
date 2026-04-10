/**
 * @description Tests for criteria-extractor: parses HU acceptance criteria from spec.md (T36).
 */
import { describe, it, expect } from 'vitest';
import { extractCriteria } from '../../agents/criteria-extractor.js';

const SPEC_BASIC = `
# Project Spec

## HUs de Implementación

### HU-14 — Execute Agent Pipeline
Como sistema, quiero ejecutar el pipeline.

**Criterios de aceptación:**
- [ ] Pipeline runs all 9 agents in order
- [ ] Each agent receives context from prior layers
- [ ] Failed agent marks project as error

### HU-15 — Retry Failed Agent
Como sistema, quiero reintentar agentes fallidos.

**Criterios de aceptación:**
- [ ] Failed agent can be retried without restarting pipeline
- [ ] Retry skips already-completed layers
`.trim();

const SPEC_NO_CRITERIA = `
### HU-20 — Simple Feature
Esta HU no tiene criterios explícitos.
`.trim();

const SPEC_MULTI_HU = `
### HU-01 — User Registration
**Criterios de aceptación:**
- [ ] Email must be unique
- [ ] Password min 8 chars

### HU-02 — User Login
**Criterios de aceptación:**
- [ ] Returns JWT on success
- [ ] Returns 401 on invalid credentials
- [ ] Rate limited to 5 attempts
`.trim();

describe('criteria-extractor — extractCriteria (T36)', () => {
  it('extracts criteria with sequential IDs per HU', () => {
    const result = extractCriteria(SPEC_BASIC);

    expect(result['HU-14']).toBeDefined();
    expect(result['HU-14'].criteria).toHaveLength(3);
    expect(result['HU-14'].criteria[0]).toEqual({ id: 'HU-14.CA-01', text: 'Pipeline runs all 9 agents in order' });
    expect(result['HU-14'].criteria[1]).toEqual({ id: 'HU-14.CA-02', text: 'Each agent receives context from prior layers' });
    expect(result['HU-14'].criteria[2]).toEqual({ id: 'HU-14.CA-03', text: 'Failed agent marks project as error' });
  });

  it('extracts criteria for multiple HUs', () => {
    const result = extractCriteria(SPEC_MULTI_HU);

    expect(result['HU-01']).toBeDefined();
    expect(result['HU-01'].criteria).toHaveLength(2);
    expect(result['HU-01'].criteria[0].id).toBe('HU-01.CA-01');

    expect(result['HU-02']).toBeDefined();
    expect(result['HU-02'].criteria).toHaveLength(3);
    expect(result['HU-02'].criteria[2].id).toBe('HU-02.CA-03');
  });

  it('includes HU name in result', () => {
    const result = extractCriteria(SPEC_BASIC);

    expect(result['HU-14'].name).toBe('Execute Agent Pipeline');
    expect(result['HU-15'].name).toBe('Retry Failed Agent');
  });

  it('handles HU without criteria gracefully (returns empty array)', () => {
    const result = extractCriteria(SPEC_NO_CRITERIA);

    expect(result['HU-20']).toBeDefined();
    expect(result['HU-20'].criteria).toHaveLength(0);
  });

  it('returns empty object for spec with no HUs', () => {
    const result = extractCriteria('# Just a readme with no HUs');
    expect(Object.keys(result)).toHaveLength(0);
  });
});
