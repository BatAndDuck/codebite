import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { grepSearchTool } from '../../src/tools/grep-search.js';

describe('grepSearchTool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-grep-'));
    process.chdir(tempDir);

    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'auth.ts'), `
export function authenticate(user: string) {
  // TODO: implement authentication
  return true;
}

export function validateToken(token: string) {
  return token.length > 0;
}
`);
    writeFileSync(join(tempDir, 'src', 'utils.ts'), `
export function formatDate(date: Date) {
  return date.toISOString();
}
`);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds text matches across files', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'authenticate',
      fileGlob: '**/*.ts',
      isRegex: false,
      maxResults: 30,
      contextLines: 2,
    }, {} as any) as any;
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].file).toBe('src/auth.ts');
  });

  it('performs case-insensitive search', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'AUTHENTICATE',
      fileGlob: '**/*.ts',
      isRegex: false,
      maxResults: 30,
      contextLines: 0,
    }, {} as any) as any;
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('supports regex patterns', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'export function \\w+',
      fileGlob: '**/*.ts',
      isRegex: true,
      maxResults: 30,
      contextLines: 0,
    }, {} as any) as any;
    expect(result.matches.length).toBeGreaterThan(2);
  });

  it('returns context lines', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'TODO',
      fileGlob: '**/*.ts',
      isRegex: false,
      maxResults: 30,
      contextLines: 2,
    }, {} as any) as any;
    expect(result.matches[0].context.length).toBeGreaterThan(1);
  });

  it('returns empty matches for no results', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'xyznonexistentpattern',
      fileGlob: '**/*.ts',
      isRegex: false,
      maxResults: 30,
      contextLines: 0,
    }, {} as any) as any;
    expect(result.matches).toEqual([]);
  });

  it('reports line numbers', async () => {
    const result = await grepSearchTool.execute!({
      pattern: 'validateToken',
      fileGlob: '**/*.ts',
      isRegex: false,
      maxResults: 30,
      contextLines: 0,
    }, {} as any) as any;
    expect(result.matches[0].line).toBeGreaterThan(0);
  });
});
