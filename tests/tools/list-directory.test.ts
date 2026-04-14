import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listDirectoryTool } from '../../src/tools/list-directory.js';

describe('listDirectoryTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-ls-'));
    process.chdir(tempDir);

    mkdirSync(join(tempDir, 'src'));
    mkdirSync(join(tempDir, 'tests'));
    writeFileSync(join(tempDir, 'README.md'), '# test');
    writeFileSync(join(tempDir, 'package.json'), '{}');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists files and directories', async () => {
    const result = await listDirectoryTool.execute!({ path: '.' }, {} as any) as any;
    const names = result.entries.map((e: any) => e.name);
    expect(names).toContain('src');
    expect(names).toContain('README.md');
  });

  it('marks directories and files with type', async () => {
    const result = await listDirectoryTool.execute!({ path: '.' }, {} as any) as any;
    const src = result.entries.find((e: any) => e.name === 'src');
    const readme = result.entries.find((e: any) => e.name === 'README.md');
    expect(src?.type).toBe('directory');
    expect(readme?.type).toBe('file');
  });

  it('shows file sizes for files', async () => {
    const result = await listDirectoryTool.execute!({ path: '.' }, {} as any) as any;
    const readme = result.entries.find((e: any) => e.name === 'README.md');
    expect(readme?.size).toBeTruthy();
  });

  it('directories come before files', async () => {
    const result = await listDirectoryTool.execute!({ path: '.' }, {} as any) as any;
    const dirs = result.entries.filter((e: any) => e.type === 'directory');
    const files = result.entries.filter((e: any) => e.type === 'file');
    const firstFileIdx = result.entries.indexOf(files[0]);
    const lastDirIdx = result.entries.indexOf(dirs[dirs.length - 1]);
    expect(lastDirIdx).toBeLessThan(firstFileIdx);
  });

  it('reports directory and file counts', async () => {
    const result = await listDirectoryTool.execute!({ path: '.' }, {} as any) as any;
    expect(result.directories).toBe(2); // src, tests
    expect(result.files).toBe(2); // README.md, package.json
  });

  it('returns error for paths outside project', async () => {
    const result = await listDirectoryTool.execute!({ path: '../..' }, {} as any) as any;
    expect(result.error).toContain('outside');
  });
});
