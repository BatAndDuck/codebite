import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';
import { relative, resolve } from 'node:path';
import { createGitignoreFilter } from '../utils/gitignore.js';
import { isBinaryFile } from '../utils/language-detect.js';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  context: string[];
}

export const grepSearchTool = tool({
  description:
    'Search file contents for a text pattern or regex. Returns matching lines with context.',
  inputSchema: z.object({
    pattern: z.string().describe('Search pattern (text or regex)'),
    fileGlob: z
      .string()
      .optional()
      .default('**/*')
      .describe('Glob to filter which files to search (default: all files)'),
    isRegex: z
      .boolean()
      .optional()
      .default(false)
      .describe('Treat pattern as regex'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe('Max matches to return'),
    contextLines: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .default(2)
      .describe('Lines of context around each match'),
  }),
  execute: async ({ pattern, fileGlob, isRegex, maxResults, contextLines }) => {
    const cwd = process.cwd();
    const ig = createGitignoreFilter(cwd);

    let regex: RegExp;
    try {
      regex = isRegex ? new RegExp(pattern, 'i') : new RegExp(escapeRegex(pattern), 'i');
    } catch (err: any) {
      return { error: `Invalid regex pattern: ${err.message}` };
    }

    try {
      const files = await glob(fileGlob, {
        cwd,
        nodir: true,
        dot: false,
        absolute: true,
      });

      const matches: GrepMatch[] = [];
      let filesSearched = 0;

      for (const file of files) {
        if (matches.length >= maxResults) break;

        const rel = relative(cwd, resolve(file)).replace(/\\/g, '/');
        if (ig.ignores(rel)) continue;
        if (isBinaryFile(file)) continue;

        filesSearched++;
        let content: string;
        try {
          content = readFileSync(file, 'utf-8');
        } catch {
          continue;
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;
          if (!regex.test(lines[i])) continue;

          const ctxStart = Math.max(0, i - contextLines);
          const ctxEnd = Math.min(lines.length - 1, i + contextLines);
          const context = lines
            .slice(ctxStart, ctxEnd + 1)
            .map((l, idx) => `${(ctxStart + idx + 1).toString().padStart(4)} | ${l}`);

          matches.push({
            file: rel,
            line: i + 1,
            content: lines[i].trim(),
            context,
          });
        }
      }

      return {
        pattern,
        filesSearched,
        totalMatches: matches.length,
        matches,
      };
    } catch (err: any) {
      return { error: `Search failed: ${err.message}` };
    }
  },
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
