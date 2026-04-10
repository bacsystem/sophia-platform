import fs from 'node:fs/promises';
import path from 'node:path';
import { RESERVED_OUTPUT_SCHEMAS } from './tool-definitions.js';

const MAX_FILE_SIZE = 100 * 1024; // 100 KB
const MAX_FILES_CREATE = 100;

interface ToolInput {
  path?: string;
  content?: string;
  summary?: string;
}

interface ToolResult {
  type: 'text';
  text: string;
}

/**
 * @description Resolves and validates a user-supplied relative path against the project base dir.
 * Prevents path traversal attacks by ensuring the resolved path stays within baseDir.
 */
function safePath(baseDir: string, userPath: string): string {
  if (!userPath) throw new Error('Path is required');
  const normalized = path.normalize(userPath);
  // Reject absolute paths and traversal attempts before resolution
  if (path.isAbsolute(normalized)) throw new Error('Path must be relative');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

/**
 * @description Recursively lists all files under a directory.
 * Returns paths relative to baseDir.
 */
async function listFilesRecursive(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await listFilesRecursive(abs, baseDir));
      } else {
        results.push(path.relative(baseDir, abs));
      }
    }
  } catch {
    // Directory doesn't exist yet — return empty list
  }
  return results;
}

/** Validates the reserved `test-mapping.json` schema before writing it to disk. */
function validateTestMappingContent(content: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid test-mapping.json: content must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { mappings?: unknown }).mappings)) {
    throw new Error('Invalid test-mapping.json: missing mappings array');
  }

  const { mappings } = parsed as { mappings: unknown[] };
  for (const [index, entry] of mappings.entries()) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid test-mapping.json: mappings[${index}] must be an object`);
    }

    const mapping = entry as {
      criteriaId?: unknown;
      testFile?: unknown;
      testName?: unknown;
      type?: unknown;
    };

    if (typeof mapping.criteriaId !== 'string') {
      throw new Error(`Invalid test-mapping.json: mappings[${index}].criteriaId must be a string`);
    }

    if (!(typeof mapping.testFile === 'string' || mapping.testFile === null)) {
      throw new Error(`Invalid test-mapping.json: mappings[${index}].testFile must be string|null`);
    }

    if (!(typeof mapping.testName === 'string' || mapping.testName === null)) {
      throw new Error(`Invalid test-mapping.json: mappings[${index}].testName must be string|null`);
    }

    if (!(mapping.type === 'unit' || mapping.type === 'integration' || mapping.type === null)) {
      throw new Error(`Invalid test-mapping.json: mappings[${index}].type must be unit|integration|null`);
    }
  }
}

/** Validates any reserved output file that has a fixed schema contract. */
function validateReservedOutput(relPath: string, content: string): void {
  if (!Object.hasOwn(RESERVED_OUTPUT_SCHEMAS, relPath)) {
    return;
  }

  if (relPath === 'test-mapping.json') {
    validateTestMappingContent(content);
  }
}

/**
 * @description Executes a Tool Use tool call from Claude.
 * Returns the tool result to send back in the next API call.
 * If onFileCheckpoint is provided, it is called immediately after each createFile (non-fatal).
 */
export async function executeTool(
  toolName: string,
  toolInput: ToolInput,
  projectDir: string,
  onFileCheckpoint?: (relPath: string, sizeBytes: number) => Promise<void>,
): Promise<{ result: ToolResult; done: boolean; summary?: string }> {
  switch (toolName) {
    case 'createFile': {
      const { path: relPath, content = '' } = toolInput;
      if (!relPath) throw new Error('createFile requires path');
      if (content.length > MAX_FILE_SIZE) {
        throw new Error(`File too large: max ${MAX_FILE_SIZE / 1024}KB`);
      }

      // Count existing files to enforce limit
      const existing = await listFilesRecursive(projectDir, projectDir);
      if (existing.length >= MAX_FILES_CREATE) {
        throw new Error(`Too many files: max ${MAX_FILES_CREATE} per agent run`);
      }

      validateReservedOutput(relPath, content);

      const absPath = safePath(projectDir, relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content, 'utf8');

      // Immediate checkpoint — non-fatal
      if (onFileCheckpoint) {
        const sizeBytes = Buffer.byteLength(content, 'utf8');
        onFileCheckpoint(relPath, sizeBytes).catch(() => { /* non-fatal */ });
      }

      return { result: { type: 'text', text: `File created: ${relPath}` }, done: false };
    }

    case 'readFile': {
      const { path: relPath } = toolInput;
      if (!relPath) throw new Error('readFile requires path');
      const absPath = safePath(projectDir, relPath);
      const content = await fs.readFile(absPath, 'utf8');
      if (content.length > MAX_FILE_SIZE) {
        return {
          result: {
            type: 'text',
            text: `[File too large to read inline. Size: ${content.length} bytes]`,
          },
          done: false,
        };
      }
      return { result: { type: 'text', text: content }, done: false };
    }

    case 'listFiles': {
      const relDir = toolInput.path ?? '';
      const absDir = relDir ? safePath(projectDir, relDir) : projectDir;
      const files = await listFilesRecursive(absDir, projectDir);
      const text = files.length > 0 ? files.join('\n') : '(empty)';
      return { result: { type: 'text', text }, done: false };
    }

    case 'taskComplete': {
      const { summary = '' } = toolInput;
      return { result: { type: 'text', text: 'Task marked complete.' }, done: true, summary };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
