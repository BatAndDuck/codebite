import { describe, it, expect } from 'vitest';
import { shellCommandTool, isCommandAllowed } from '../../src/tools/shell-command.js';

describe('isCommandAllowed', () => {
  it('allows git log', () => {
    expect(isCommandAllowed('git log')).toBe(true);
    expect(isCommandAllowed('git log --oneline -20')).toBe(true);
  });

  it('allows git blame', () => {
    expect(isCommandAllowed('git blame src/index.ts')).toBe(true);
  });

  it('allows git diff', () => {
    expect(isCommandAllowed('git diff HEAD~1')).toBe(true);
  });

  it('allows git status', () => {
    expect(isCommandAllowed('git status')).toBe(true);
  });

  it('allows git ls-files', () => {
    expect(isCommandAllowed('git ls-files')).toBe(true);
  });

  it('allows npm outdated', () => {
    expect(isCommandAllowed('npm outdated')).toBe(true);
    expect(isCommandAllowed('npm outdated --json')).toBe(true);
  });

  it('allows npm show and npm view', () => {
    expect(isCommandAllowed('npm show zod version')).toBe(true);
    expect(isCommandAllowed('npm view chalk version')).toBe(true);
  });

  it('allows wc', () => {
    expect(isCommandAllowed('wc -l src/index.ts')).toBe(true);
  });

  it('rejects rm', () => {
    expect(isCommandAllowed('rm -rf /')).toBe(false);
  });

  it('rejects cat', () => {
    expect(isCommandAllowed('cat /etc/passwd')).toBe(false);
  });

  it('rejects npm install', () => {
    expect(isCommandAllowed('npm install malicious-pkg')).toBe(false);
  });

  it('rejects npm publish', () => {
    expect(isCommandAllowed('npm publish')).toBe(false);
  });

  it('rejects git push', () => {
    expect(isCommandAllowed('git push')).toBe(false);
  });

  it('rejects git commit', () => {
    expect(isCommandAllowed('git commit -m "hack"')).toBe(false);
  });

  it('rejects empty command', () => {
    expect(isCommandAllowed('')).toBe(false);
  });

  it('rejects command injection attempts', () => {
    expect(isCommandAllowed('git log; rm -rf /')).toBe(false);
    expect(isCommandAllowed('git log && cat /etc/passwd')).toBe(false);
  });
});

describe('shellCommandTool', () => {
  it('returns error for disallowed command', async () => {
    const result = await shellCommandTool.execute!({ command: 'rm -rf /' }, {} as any) as any;
    expect(result.error).toContain('not allowed');
  });

  it('executes allowed command without "not allowed" error', async () => {
    const result = await shellCommandTool.execute!({ command: 'git status' }, {} as any) as any;
    // May error if not a git repo, but should not return "not allowed"
    if (result.error) {
      expect(result.error).not.toContain('not allowed');
    } else {
      expect(result.output).toBeDefined();
    }
  });
});
