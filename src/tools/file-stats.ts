import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { detectLanguage, isBinaryFile } from '../utils/language-detect.js';

export const fileStatsTool = tool({
  description:
    'Get file statistics: line count, size, language, and last modified date. Use before reading large files.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root'),
  }),
  execute: async ({ path: filePath }) => {
    const cwd = process.cwd();
    const absPath = resolve(cwd, filePath);
    const rel = relative(cwd, absPath);

    if (rel.startsWith('..')) {
      return { error: 'Cannot access files outside the project directory.' };
    }

    if (!existsSync(absPath)) {
      return { error: `File not found: ${filePath}` };
    }

    try {
      const stat = statSync(absPath);

      if (stat.isDirectory()) {
        return { error: `Path is a directory, not a file: ${filePath}` };
      }

      const language = detectLanguage(absPath);
      const binary = isBinaryFile(absPath);

      let lines: number | undefined;
      if (!binary) {
        try {
          const content = readFileSync(absPath, 'utf-8');
          lines = content.split('\n').length;
        } catch {
          // ignore
        }
      }

      return {
        path: rel,
        sizeBytes: stat.size,
        sizeHuman: formatSize(stat.size),
        lines,
        language,
        binary,
        lastModified: stat.mtime.toISOString(),
      };
    } catch (err: any) {
      return { error: `Failed to get stats: ${err.message}` };
    }
  },
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
