import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createGitignoreFilter } from './gitignore.js';

interface TreeEntry {
  name: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

export interface DirectorySnapshotOptions {
  cwd?: string;
  path?: string;
  maxDepth?: number;
  includeFiles?: boolean;
  maxEntries?: number;
}

export interface DirectorySnapshot {
  root: string;
  totalEntries: number;
  truncated: boolean;
  tree: string;
}

export function getDirectorySnapshot(options: DirectorySnapshotOptions = {}): DirectorySnapshot {
  const cwd = options.cwd ?? process.cwd();
  const dirPath = options.path ?? '.';
  const maxDepth = options.maxDepth ?? 4;
  const includeFiles = options.includeFiles ?? true;
  const maxEntries = options.maxEntries;

  const absPath = resolve(cwd, dirPath);
  const relPath = relative(cwd, absPath);

  if (relPath.startsWith('..')) {
    throw new Error('Cannot inspect directories outside the project.');
  }

  const ig = createGitignoreFilter(cwd);
  let entryCount = 0;

  function buildTree(dir: string, depth: number): TreeEntry[] {
    if (depth > maxDepth || (maxEntries !== undefined && entryCount >= maxEntries)) return [];

    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return [];
    }

      const result: TreeEntry[] = [];

      for (const entry of entries) {
        if (maxEntries !== undefined && entryCount >= maxEntries) break;

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
        entryCount += 1;
        const children = buildTree(fullPath, depth + 1);
        result.push({ name: entry + '/', type: 'directory', children });
      } else if (includeFiles) {
        entryCount += 1;
        result.push({ name: entry, type: 'file' });
      }
    }

    return result;
  }

  const tree = buildTree(absPath, 1);

  return {
    root: relPath || '.',
    totalEntries: entryCount,
    truncated: maxEntries !== undefined ? entryCount >= maxEntries : false,
    tree: formatTree(tree, ''),
  };
}

export function getRepositoryStructure(maxDepth: number = Number.POSITIVE_INFINITY): string {
  const snapshot = getDirectorySnapshot({
    path: '.',
    maxDepth,
    includeFiles: true,
  });

  return snapshot.tree || '(empty project root)';
}

function formatTree(entries: TreeEntry[], prefix: string): string {
  const lines: string[] = [];

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    lines.push(prefix + connector + entry.name);

    if (entry.children && entry.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(formatTree(entry.children, childPrefix));
    }
  });

  return lines.join('\n');
}
