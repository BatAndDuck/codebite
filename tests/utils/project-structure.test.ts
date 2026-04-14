import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getDirectorySnapshot,
  getRepositoryStructure,
} from '../../src/utils/project-structure.js';

describe('project structure snapshots', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-structure-'));
    process.chdir(tempDir);

    mkdirSync(join(tempDir, 'src', 'utils'), { recursive: true });
    mkdirSync(join(tempDir, 'tests', 'fixtures'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), '');
    writeFileSync(join(tempDir, 'src', 'utils', 'helper.ts'), '');
    writeFileSync(join(tempDir, 'tests', 'fixtures', 'sample.txt'), '');
    writeFileSync(join(tempDir, 'README.md'), '# test');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds a directory snapshot for a subfolder', () => {
    const result = getDirectorySnapshot({
      cwd: tempDir,
      path: 'src',
      maxDepth: 3,
      includeFiles: true,
    });

    expect(result.root).toBe('src');
    expect(result.tree).toContain('index.ts');
    expect(result.tree).toContain('utils/');
  });

  it('returns the full repository structure by default', () => {
    const result = getRepositoryStructure();

    expect(result).toContain('src/');
    expect(result).toContain('utils/');
    expect(result).toContain('helper.ts');
  });
});
