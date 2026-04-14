import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { isBinaryFile, detectLanguage } from '../utils/language-detect.js';
import { truncateLines } from '../utils/truncate.js';
import { createGitignoreFilter, isIgnored } from '../utils/gitignore.js';

export const readFileTool = tool({
  description:
    'Read the contents of a file with line numbers. For large files, use offset and limit to read specific sections. Check file-stats first for large files.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Start reading from this line (0-based)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .default(500)
      .describe('Max lines to read (default 500, max 1000)'),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    const cwd = process.cwd();
    const absPath = resolve(cwd, filePath);
    const relPath = relative(cwd, absPath);
    const ig = createGitignoreFilter(cwd);

    if (relPath.startsWith('..')) {
      return { error: 'Cannot read files outside the project directory.' };
    }

    if (isIgnored(ig, absPath, cwd)) {
      return { error: `Cannot read ignored file: ${filePath}` };
    }

    if (!existsSync(absPath)) {
      return { error: `File not found: ${filePath}` };
    }

    if (isBinaryFile(absPath)) {
      return {
        error: `Cannot read binary file: ${filePath}`,
        language: detectLanguage(absPath),
      };
    }

    try {
      const content = readFileSync(absPath, 'utf-8');
      const language = detectLanguage(absPath);
      const result = truncateLines(content, limit, offset);

      return {
        path: relPath,
        language,
        totalLines: result.totalLines,
        showing: { from: offset + 1, to: Math.min(offset + limit, result.totalLines) },
        truncated: result.truncated,
        content: result.text,
      };
    } catch (err: any) {
      return { error: `Failed to read file: ${err.message}` };
    }
  },
});
