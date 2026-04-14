import { tool } from 'ai';
import { z } from 'zod';
import { glob } from 'glob';
import { relative, resolve } from 'node:path';
import { createGitignoreFilter } from '../utils/gitignore.js';

export const globSearchTool = tool({
  description:
    'Find files matching a glob pattern (e.g., "**/*.ts", "src/**/*.test.js"). Returns relative file paths.',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern to match files'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(50)
      .describe('Max results to return (default 50)'),
  }),
  execute: async ({ pattern, maxResults }) => {
    const cwd = process.cwd();
    const ig = createGitignoreFilter(cwd);

    try {
      const matches = await glob(pattern, {
        cwd,
        nodir: true,
        dot: false,
        absolute: true,
      });

      const filtered = matches
        .map((m) => relative(cwd, resolve(m)).replace(/\\/g, '/'))
        .filter((rel) => !ig.ignores(rel))
        .slice(0, maxResults);

      return {
        pattern,
        totalMatches: matches.length,
        showing: filtered.length,
        files: filtered,
      };
    } catch (err: any) {
      return { error: `Glob search failed: ${err.message}` };
    }
  },
});
