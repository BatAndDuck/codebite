import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { truncateText } from '../utils/truncate.js';

const ALLOWED_COMMANDS = [
  'git log',
  'git blame',
  'git diff',
  'git show',
  'git status',
  'git branch',
  'git tag',
  'git shortlog',
  'git rev-parse',
  'git ls-files',
  'npm outdated',
  'npm show',
  'npm view',
  'wc',
  'du',
];

const SHELL_METACHARACTERS = /[;&|`$><\n\r]/;

function isCommandAllowed(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  // Block any shell metacharacters (injection attempts)
  if (SHELL_METACHARACTERS.test(trimmed)) return false;
  return ALLOWED_COMMANDS.some(
    (allowed) =>
      trimmed === allowed || trimmed.startsWith(allowed + ' ')
  );
}

export const shellCommandTool = tool({
  description: `Execute a restricted read-only shell command for code analysis. This is not a general shell. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}. Use for git history, blame, diff, file statistics, and npm package metadata such as outdated/show/view.`,
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
  }),
  execute: async ({ command }) => {
    if (!isCommandAllowed(command)) {
      return {
        error: `Command not allowed: "${command}". Allowed: ${ALLOWED_COMMANDS.join(', ')}`,
      };
    }

    try {
      const output = execSync(command, {
        cwd: process.cwd(),
        timeout: 10000,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        command,
        output: truncateText(output, 5000),
      };
    } catch (err: any) {
      return {
        error: `Command failed: ${err.message}`,
        stderr: err.stderr ? truncateText(String(err.stderr), 1000) : undefined,
      };
    }
  },
});

export { isCommandAllowed };
