import { tool } from 'ai';
import { z } from 'zod';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createGitignoreFilter } from '../utils/gitignore.js';

interface TreeEntry {
  name: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

export const directoryTreeTool = tool({
  description:
    'Show the directory tree structure. Respects .gitignore. Use to understand project layout.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('Directory to show tree for (default: project root)'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .default(4)
      .describe('Maximum depth to traverse (default 4)'),
    includeFiles: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include files or just directories'),
  }),
  execute: async ({ path: dirPath, maxDepth, includeFiles }) => {
    const cwd = process.cwd();
    const absPath = resolve(cwd, dirPath);
    const ig = createGitignoreFilter(cwd);

    let entryCount = 0;
    const MAX_ENTRIES = 200;

    function buildTree(dir: string, depth: number): TreeEntry[] {
      if (depth > maxDepth || entryCount >= MAX_ENTRIES) return [];

      let entries: string[];
      try {
        entries = readdirSync(dir).sort();
      } catch {
        return [];
      }

      const result: TreeEntry[] = [];

      for (const entry of entries) {
        if (entryCount >= MAX_ENTRIES) break;

        const fullPath = join(dir, entry);
        const rel = relative(cwd, fullPath);

        if (ig.ignores(rel) || ig.ignores(rel + '/')) continue;

        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          entryCount++;
          const children = buildTree(fullPath, depth + 1);
          result.push({ name: entry + '/', type: 'directory', children });
        } else if (includeFiles) {
          entryCount++;
          result.push({ name: entry, type: 'file' });
        }
      }

      return result;
    }

    const tree = buildTree(absPath, 1);
    const display = formatTree(tree, '');

    return {
      root: relative(cwd, absPath) || '.',
      totalEntries: entryCount,
      truncated: entryCount >= MAX_ENTRIES,
      tree: display,
    };
  },
});

function formatTree(entries: TreeEntry[], prefix: string): string {
  const lines: string[] = [];

  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    lines.push(prefix + connector + entry.name);

    if (entry.children && entry.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(formatTree(entry.children, childPrefix));
    }
  });

  return lines.join('\n');
}
