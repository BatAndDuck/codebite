import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileTool } from '../../src/tools/read-file.js';

describe('readFileTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-read-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads a file with line numbers', async () => {
    writeFileSync(join(tempDir, 'hello.ts'), 'const x = 1;\nconst y = 2;\n');
    const result = await readFileTool.execute!({ path: 'hello.ts', offset: 0, limit: 500 }, {} as any);
    expect(result).not.toHaveProperty('error');
    expect((result as any).content).toContain('const x = 1;');
    expect((result as any).content).toContain('   1 |');
  });

  it('returns error for missing file', async () => {
    const result = await readFileTool.execute!({ path: 'nonexistent.ts', offset: 0, limit: 500 }, {} as any);
    expect((result as any).error).toContain('not found');
  });

  it('returns error for binary files', async () => {
    writeFileSync(join(tempDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await readFileTool.execute!({ path: 'image.png', offset: 0, limit: 500 }, {} as any);
    expect((result as any).error).toContain('binary');
  });

  it('applies offset and limit', async () => {
    const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    writeFileSync(join(tempDir, 'big.txt'), content);
    const result = await readFileTool.execute!({ path: 'big.txt', offset: 5, limit: 3 }, {} as any) as any;
    expect(result.content).toContain('line 6');
    expect(result.content).toContain('line 8');
    expect(result.content).not.toContain('line 5\n');
  });

  it('reports totalLines and truncated status', async () => {
    const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    writeFileSync(join(tempDir, 'large.txt'), content);
    const result = await readFileTool.execute!({ path: 'large.txt', offset: 0, limit: 10 }, {} as any) as any;
    expect(result.totalLines).toBe(100);
    expect(result.truncated).toBe(true);
  });

  it('rejects paths outside project', async () => {
    const result = await readFileTool.execute!({ path: '../../../etc/passwd', offset: 0, limit: 500 }, {} as any);
    expect((result as any).error).toContain('outside');
  });

  it('detects language from extension', async () => {
    writeFileSync(join(tempDir, 'app.ts'), 'export const x = 1;');
    const result = await readFileTool.execute!({ path: 'app.ts', offset: 0, limit: 500 }, {} as any) as any;
    expect(result.language).toBe('TypeScript');
  });
});
