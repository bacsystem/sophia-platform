# Shared Skill: Output Format

Adhere to these output format standards in all code and reports you generate.

---

## taskComplete Format

When calling the `taskComplete` tool at the end of your run, use this structure:

```json
{
  "summary": "One sentence describing what was accomplished.",
  "filesCreated": [
    "path/to/file1.ts",
    "path/to/file2.ts"
  ],
  "filesModified": [
    "path/to/existing-file.ts"
  ],
  "notes": "Optional: blockers, concerns, or follow-up items."
}
```

Rules:
- `summary` is mandatory and must be one sentence.
- `filesCreated` must list every file written via `createFile`.
- `filesModified` must list every pre-existing file changed.
- `notes` is optional; use it for `DONE_WITH_CONCERNS` escalations.
- Do not claim completion before all required layer artifacts exist (see Conventions skill, Artefactos por Capa).

---

## Severity Levels

Use these severity levels uniformly across all agent reports and findings:

| Level | Meaning |
|-------|---------|
| `CRITICAL` | System compromise, data loss, or complete feature failure. Fix immediately. |
| `HIGH` | Significant bug, security vulnerability, or broken contract. Fix before ship. |
| `MEDIUM` | Degraded behavior, missing edge case, non-trivial code smell. Fix in next iteration. |
| `LOW` | Minor quality issue, style inconsistency, performance micro-optimization. Fix when convenient. |
| `INFO` | Observation, suggestion, or informational note. No action required. |

---

## Tabular Report Format

Security audits, integration validations, and finding reports must use this table structure:

```markdown
| # | Severity | Component | Finding | Remediation |
|---|----------|-----------|---------|-------------|
| 1 | CRITICAL  | auth/login | JWT secret below 32 chars | Rotate secret, enforce min length in startup |
| 2 | HIGH      | api/users  | Missing rate limit on /register | Add rateLimitPlugin to route |
| 3 | MEDIUM    | frontend   | Token stored in localStorage | Move to httpOnly cookie |
```

Rules:
- Severity values must use the exact enum above (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).
- Component must be the file path or module name — no vague labels like "backend".
- Finding must be one declarative sentence.
- Remediation must be actionable (what to do, not just what is wrong).
- If no findings: write `No findings at this severity level.` under the table.

---

## Integration Severity Mapping

For the Integration Agent (Layer 7) cross-layer validation:

| Code | Severity | Meaning |
|------|----------|---------|
| `BROKEN` | `CRITICAL` | Layer artifact missing or pipeline-blocking defect |
| `MISMATCH` | `HIGH` | Contract mismatch between layers (e.g., API response differs from frontend expectation) |
| `MISSING` | `MEDIUM` | Expected artifact not generated (non-blocking) |
| `OK` | `INFO` | Layer validated successfully |

---

## WebSocket Event Payloads

When emitting real-time events from agents, use these shapes:

```typescript
// Agent status update
{ event: 'agent:status',  data: { agentId, projectId, status: 'working' | 'completed' | 'failed' | 'paused' } }

// Agent log line
{ event: 'agent:log',     data: { agentId, projectId, message: string, timestamp: string } }

// Agent warning (memory, timeout, etc.)
{ event: 'agent:warning', data: { agentId, projectId, code: string, message: string } }

// Quality gate result
{ event: 'quality:gate',  data: { projectId, coverage: number, threshold: number, passed: boolean } }
```
