import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGitignoreFilter, isIgnored } from '../../src/utils/gitignore.js';

describe('createGitignoreFilter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-gitignore-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('always ignores node_modules', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(ig.ignores('node_modules/foo.js')).toBe(true);
  });

  it('always ignores .git', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(ig.ignores('.git/config')).toBe(true);
  });

  it('always ignores .codebite', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(ig.ignores('.codebite/index/foo.json')).toBe(true);
  });

  it('respects .gitignore patterns', () => {
    writeFileSync(join(tempDir, '.gitignore'), '*.log\nbuild/\n');
    const ig = createGitignoreFilter(tempDir);
    expect(ig.ignores('app.log')).toBe(true);
    expect(ig.ignores('build/output.js')).toBe(true);
    expect(ig.ignores('src/app.ts')).toBe(false);
  });

  it('allows normal source files', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(ig.ignores('src/index.ts')).toBe(false);
    expect(ig.ignores('README.md')).toBe(false);
  });
});

describe('isIgnored', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-gitignore-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns true for ignored paths', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(isIgnored(ig, join(tempDir, 'node_modules', 'foo.js'), tempDir)).toBe(true);
  });

  it('returns false for allowed paths', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(isIgnored(ig, join(tempDir, 'src', 'index.ts'), tempDir)).toBe(false);
  });

  it('returns true for paths outside project', () => {
    const ig = createGitignoreFilter(tempDir);
    expect(isIgnored(ig, '/some/other/path', tempDir)).toBe(true);
  });
});
