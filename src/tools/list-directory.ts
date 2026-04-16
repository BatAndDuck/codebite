import { tool } from 'ai';
import { z } from 'zod';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createGitignoreFilter } from '../utils/gitignore.js';
import { formatSize } from '../utils/format-size.js';

export const listDirectoryTool = tool({
  description:
    'List only the immediate child files and folders in a specific directory (non-recursive). Shows type and size.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('Directory to list (default: project root)'),
  }),
  execute: async ({ path: dirPath }) => {
    const cwd = process.cwd();
    const absPath = resolve(cwd, dirPath);
    const rel = relative(cwd, absPath);
    const ig = createGitignoreFilter(cwd);

    if (rel.startsWith('..')) {
      return { error: 'Cannot list directories outside the project.' };
    }

    try {
      const entries = readdirSync(absPath, { withFileTypes: true }).filter((entry) => {
        const entryRel = rel && rel !== '.' ? `${rel}/${entry.name}` : entry.name;
        return !ig.ignores(entryRel) && !ig.ignores(entryRel + '/');
      });

      const items = entries.map((entry) => {
        const fullPath = join(absPath, entry.name);
        let size: number | undefined;

        if (entry.isFile()) {
          try {
            size = statSync(fullPath).size;
          } catch {
            // ignore
          }
        }

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: size !== undefined ? formatSize(size) : undefined,
        };
      });

      const dirs = items.filter((i) => i.type === 'directory').sort((a, b) => a.name.localeCompare(b.name));
      const files = items.filter((i) => i.type === 'file').sort((a, b) => a.name.localeCompare(b.name));

      return {
        path: rel || '.',
        directories: dirs.length,
        files: files.length,
        entries: [...dirs, ...files],
      };
    } catch (err: any) {
      return { error: `Cannot list directory: ${err.message}` };
    }
  },
});

