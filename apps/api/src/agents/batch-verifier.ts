import fs from 'node:fs/promises';
import path from 'node:path';
import type { LayerNode } from './dependency-graph.js';

export type Severity = 'CRITICAL' | 'MEDIUM' | 'LOW';

export interface VerificationDetail {
  severity: Severity;
  message: string;
  file?: string;
}

export interface VerificationResult {
  status: 'pass' | 'warn' | 'fail';
  details: VerificationDetail[];
}

/**
 * Expected file patterns per agent layer.
 * Used when no execution plan is available (basic structural validation).
 */
const EXPECTED_PATTERNS: Record<number, string[]> = {
  0: ['plan/execution-plan.md'],
  1: ['prisma/schema.prisma'],
  1.5: ['prisma/seed.ts'],
  2: ['src/modules/'],
  3: ['src/app/', 'src/components/'],
  4: ['test-mapping.json'],
  7: ['certification.md'],
};

/**
 * @description Parses an execution plan for expected output files for a given agent type.
 * Looks for file paths in code fences or bullet points under the agent's section.
 */
function extractExpectedFiles(planContent: string, agentType: string): string[] {
  const files: string[] = [];
  const agentSection = new RegExp(
    `##\\s+${agentType.replace('-', '[\\s-]')}[\\s\\S]*?(?=##\\s|$)`,
    'i',
  );
  const match = planContent.match(agentSection);
  if (!match) return files;

  const section = match[0];
  // Match file paths in backticks or after bullet points
  const fileMatches = section.matchAll(/`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,10})`/g);
  for (const m of fileMatches) {
    files.push(m[1]);
  }
  return files;
}

/**
 * @description Verifies the output of a completed agent layer.
 * Checks expected files exist and are non-empty.
 * Uses execution plan when available for fine-grained validation,
 * otherwise falls back to basic structural patterns.
 */
export async function verifyBatchOutput(
  layerDef: LayerNode,
  projectDir: string,
  planContent?: string,
): Promise<VerificationResult> {
  const details: VerificationDetail[] = [];

  // Determine expected files from plan or fallback patterns
  let expectedFiles: string[] = [];
  if (planContent) {
    expectedFiles = extractExpectedFiles(planContent, layerDef.type);
  }
  if (expectedFiles.length === 0) {
    expectedFiles = EXPECTED_PATTERNS[layerDef.layer] ?? [];
  }

  for (const expected of expectedFiles) {
    const absPath = path.join(projectDir, expected);

    // Check if it's a directory pattern (ends with /)
    if (expected.endsWith('/')) {
      try {
        const entries = await fs.readdir(absPath);
        if (entries.length === 0) {
          details.push({
            severity: 'MEDIUM',
            message: `Directory "${expected}" exists but is empty`,
            file: expected,
          });
        }
      } catch {
        details.push({
          severity: 'MEDIUM',
          message: `Expected directory "${expected}" not found`,
          file: expected,
        });
      }
      continue;
    }

    // File check
    try {
      const stat = await fs.stat(absPath);
      if (stat.size === 0) {
        details.push({
          severity: 'MEDIUM',
          message: `File "${expected}" exists but is empty (0 bytes)`,
          file: expected,
        });
      }
    } catch {
      details.push({
        severity: 'CRITICAL',
        message: `Expected file "${expected}" not found`,
        file: expected,
      });
    }
  }

  // Determine overall status
  const hasCritical = details.some((d) => d.severity === 'CRITICAL');
  const hasWarnings = details.some((d) => d.severity === 'MEDIUM' || d.severity === 'LOW');

  return {
    status: hasCritical ? 'fail' : hasWarnings ? 'warn' : 'pass',
    details,
  };
}
