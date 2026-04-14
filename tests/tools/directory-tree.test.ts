import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { directoryTreeTool } from '../../src/tools/directory-tree.js';

describe('directoryTreeTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-tree-'));
    process.chdir(tempDir);

    mkdirSync(join(tempDir, 'src', 'utils'), { recursive: true });
    mkdirSync(join(tempDir, 'tests'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), '');
    writeFileSync(join(tempDir, 'src', 'utils', 'helper.ts'), '');
    writeFileSync(join(tempDir, 'tests', 'index.test.ts'), '');
    writeFileSync(join(tempDir, 'README.md'), '');
    writeFileSync(join(tempDir, 'package.json'), '{}');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('shows directory structure', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: true }, {} as any) as any;
    expect(result.tree).toContain('src/');
    expect(result.tree).toContain('README.md');
  });

  it('shows nested directories', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: true }, {} as any) as any;
    expect(result.tree).toContain('utils/');
    expect(result.tree).toContain('helper.ts');
  });

  it('respects maxDepth', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 1, includeFiles: true }, {} as any) as any;
    expect(result.tree).toContain('src/');
    // At depth 1, we see src/ but not src/utils/
    expect(result.tree).not.toContain('helper.ts');
  });

  it('can hide files', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: false }, {} as any) as any;
    expect(result.tree).toContain('src/');
    expect(result.tree).not.toContain('README.md');
  });

  it('ignores node_modules', async () => {
    mkdirSync(join(tempDir, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'some-pkg', 'index.js'), '');
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: true }, {} as any) as any;
    expect(result.tree).not.toContain('node_modules');
  });

  it('returns root path', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: true }, {} as any) as any;
    expect(result.root).toBe('.');
  });

  it('reports total entry count', async () => {
    const result = await directoryTreeTool.execute!({ path: '.', maxDepth: 4, includeFiles: true }, {} as any) as any;
    expect(result.totalEntries).toBeGreaterThan(0);
  });
});
