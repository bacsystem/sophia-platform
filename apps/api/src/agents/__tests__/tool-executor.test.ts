import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeTool } from '../tool-executor.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sophia-tool-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('executeTool — createFile', () => {
  it('creates a file with the given content', async () => {
    const result = await executeTool('createFile', { path: 'hello.txt', content: 'world' }, tmpDir);
    expect(result.result.text).toContain('hello.txt');
    const content = await fs.readFile(path.join(tmpDir, 'hello.txt'), 'utf8');
    expect(content).toBe('world');
  });

  it('creates nested directories automatically', async () => {
    await executeTool('createFile', { path: 'src/lib/util.ts', content: 'export {}' }, tmpDir);
    const content = await fs.readFile(path.join(tmpDir, 'src/lib/util.ts'), 'utf8');
    expect(content).toBe('export {}');
  });

  it('throws on path traversal attempt', async () => {
    await expect(
      executeTool('createFile', { path: '../outside.txt', content: 'evil' }, tmpDir),
    ).rejects.toThrow('Path traversal detected');
  });

  it('throws on absolute path', async () => {
    await expect(
      executeTool('createFile', { path: '/etc/passwd', content: 'evil' }, tmpDir),
    ).rejects.toThrow('Path must be relative');
  });

  it('throws when file exceeds MAX_FILE_SIZE', async () => {
    const bigContent = 'x'.repeat(101 * 1024); // 101 KB
    await expect(
      executeTool('createFile', { path: 'big.txt', content: bigContent }, tmpDir),
    ).rejects.toThrow('too large');
  });
});

describe('executeTool — readFile', () => {
  it('reads an existing file', async () => {
    await fs.writeFile(path.join(tmpDir, 'existing.ts'), 'const x = 1;', 'utf8');
    const result = await executeTool('readFile', { path: 'existing.ts' }, tmpDir);
    expect(result.result.text).toContain('const x = 1;');
  });

  it('throws when file not found', async () => {
    await expect(
      executeTool('readFile', { path: 'missing.ts' }, tmpDir),
    ).rejects.toThrow();
  });

  it('throws on path traversal', async () => {
    await expect(
      executeTool('readFile', { path: '../../etc/passwd' }, tmpDir),
    ).rejects.toThrow('Path traversal detected');
  });
});

describe('executeTool — listFiles', () => {
  it('lists files in the project directory', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.ts'), '', 'utf8');
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'sub', 'b.ts'), '', 'utf8');

    const result = await executeTool('listFiles', {}, tmpDir);
    expect(result.result.text).toContain('a.ts');
    expect(result.result.text).toContain('b.ts');
  });

  it('returns (empty) when directory is empty', async () => {
    const result = await executeTool('listFiles', {}, tmpDir);
    expect(result.result.text).toBe('(empty)');
  });
});

describe('executeTool — taskComplete', () => {
  it('signals done=true with summary', async () => {
    const result = await executeTool('taskComplete', { summary: 'All done!' }, tmpDir);
    expect(result.done).toBe(true);
    expect(result.summary).toBe('All done!');
  });
});

describe('executeTool — unknown tool', () => {
  it('throws for an unknown tool name', async () => {
    await expect(
      executeTool('unknownTool', {}, tmpDir),
    ).rejects.toThrow();
  });
});

describe('executeTool — reserved output schema validation (T40)', () => {
  it('accepts a valid test-mapping.json payload', async () => {
    const result = await executeTool(
      'createFile',
      {
        path: 'test-mapping.json',
        content: JSON.stringify({
          mappings: [
            {
              criteriaId: 'HU-14.CA-01',
              testFile: 'src/__tests__/project.test.ts',
              testName: 'should create project',
              type: 'unit',
            },
          ],
        }),
      },
      tmpDir,
    );

    expect(result.result.text).toContain('test-mapping.json');
  });

  it('rejects an invalid test-mapping.json payload', async () => {
    await expect(
      executeTool(
        'createFile',
        {
          path: 'test-mapping.json',
          content: JSON.stringify({ mappings: [{ criteriaId: 'HU-14.CA-01' }] }),
        },
        tmpDir,
      ),
    ).rejects.toThrow('Invalid test-mapping.json');
  });
});

describe('executeTool — createFile checkpoint (T18)', () => {
  it('calls onFileCheckpoint immediately after file is written', async () => {
    const checkpoint = vi.fn().mockResolvedValue(undefined);

    await executeTool('createFile', { path: 'src/schema.sql', content: 'CREATE TABLE t' }, tmpDir, checkpoint);

    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(checkpoint).toHaveBeenCalledWith('src/schema.sql', expect.any(Number));
  });

  it('does NOT call checkpoint for other tools', async () => {
    const checkpoint = vi.fn().mockResolvedValue(undefined);
    await fs.writeFile(path.join(tmpDir, 'existing.ts'), 'x', 'utf8');

    await executeTool('readFile', { path: 'existing.ts' }, tmpDir, checkpoint);

    expect(checkpoint).not.toHaveBeenCalled();
  });

  it('checkpoint failure does not break createFile (non-fatal)', async () => {
    const checkpoint = vi.fn().mockRejectedValue(new Error('DB down'));

    const result = await executeTool('createFile', { path: 'a.sql', content: 'SELECT 1' }, tmpDir, checkpoint);

    expect(result.result.text).toContain('a.sql');
    expect(result.done).toBe(false);
    // File was still created despite checkpoint failure
    const content = await fs.readFile(path.join(tmpDir, 'a.sql'), 'utf8');
    expect(content).toBe('SELECT 1');
  });
});
