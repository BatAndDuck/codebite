import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileStatsTool } from '../../src/tools/file-stats.js';

describe('fileStatsTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-stats-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns stats for a TypeScript file', async () => {
    writeFileSync(join(tempDir, 'index.ts'), 'const x = 1;\nconst y = 2;\n');
    const result = await fileStatsTool.execute!({ path: 'index.ts' }, {} as any) as any;
    expect(result.language).toBe('TypeScript');
    expect(result.lines).toBe(3);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.binary).toBe(false);
    expect(result.lastModified).toBeTruthy();
  });

  it('returns error for missing file', async () => {
    const result = await fileStatsTool.execute!({ path: 'missing.ts' }, {} as any) as any;
    expect(result.error).toContain('not found');
  });

  it('returns error for directories', async () => {
    mkdirSync(join(tempDir, 'mydir'));
    const result = await fileStatsTool.execute!({ path: 'mydir' }, {} as any) as any;
    expect(result.error).toContain('directory');
  });

  it('marks binary files correctly', async () => {
    writeFileSync(join(tempDir, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await fileStatsTool.execute!({ path: 'img.png' }, {} as any) as any;
    expect(result.binary).toBe(true);
    expect(result.lines).toBeUndefined();
  });

  it('rejects paths outside project', async () => {
    const result = await fileStatsTool.execute!({ path: '../../etc/passwd' }, {} as any) as any;
    expect(result.error).toContain('outside');
  });

  it('formats size as human readable', async () => {
    writeFileSync(join(tempDir, 'small.txt'), 'hello');
    const result = await fileStatsTool.execute!({ path: 'small.txt' }, {} as any) as any;
    expect(result.sizeHuman).toBe('5B');
  });

  it('rejects ignored files', async () => {
    writeFileSync(join(tempDir, '.gitignore'), 'secret.txt\n');
    writeFileSync(join(tempDir, 'secret.txt'), 'top secret');
    const result = await fileStatsTool.execute!({ path: 'secret.txt' }, {} as any) as any;
    expect(result.error).toContain('ignored');
  });
});
