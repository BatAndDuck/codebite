import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { globSearchTool } from '../../src/tools/glob-search.js';

describe('globSearchTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-glob-'));
    process.chdir(tempDir);

    // Create test structure
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    mkdirSync(join(tempDir, 'tests'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), '');
    writeFileSync(join(tempDir, 'src', 'utils.ts'), '');
    writeFileSync(join(tempDir, 'src', 'config.js'), '');
    writeFileSync(join(tempDir, 'tests', 'index.test.ts'), '');
    writeFileSync(join(tempDir, 'README.md'), '');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds TypeScript files', async () => {
    const result = await globSearchTool.execute!({ pattern: '**/*.ts', maxResults: 50 }, {} as any) as any;
    expect(result.files).toContain('src/index.ts');
    expect(result.files).toContain('src/utils.ts');
    expect(result.files).toContain('tests/index.test.ts');
  });

  it('excludes JavaScript files from TS glob', async () => {
    const result = await globSearchTool.execute!({ pattern: '**/*.ts', maxResults: 50 }, {} as any) as any;
    expect(result.files).not.toContain('src/config.js');
  });

  it('finds files in specific directory', async () => {
    const result = await globSearchTool.execute!({ pattern: 'src/**/*', maxResults: 50 }, {} as any) as any;
    expect(result.files.some((f: string) => f.startsWith('src/'))).toBe(true);
    expect(result.files.every((f: string) => f.startsWith('src/'))).toBe(true);
  });

  it('respects maxResults', async () => {
    const result = await globSearchTool.execute!({ pattern: '**/*', maxResults: 2 }, {} as any) as any;
    expect(result.files.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for no matches', async () => {
    const result = await globSearchTool.execute!({ pattern: '**/*.xyz', maxResults: 50 }, {} as any) as any;
    expect(result.files).toEqual([]);
    expect(result.totalMatches).toBe(0);
  });

  it('finds markdown files', async () => {
    const result = await globSearchTool.execute!({ pattern: '**/*.md', maxResults: 50 }, {} as any) as any;
    expect(result.files).toContain('README.md');
  });
});
