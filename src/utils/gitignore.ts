import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import ignore, { type Ignore } from 'ignore';

const ALWAYS_IGNORE = [
  'node_modules',
  '.git',
  '.codebite',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.parcel-cache',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
  '.DS_Store',
  'Thumbs.db',
];

export function createGitignoreFilter(projectRoot: string): Ignore {
  const ig = ignore();

  ig.add(ALWAYS_IGNORE);

  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    ig.add(content);
  }

  return ig;
}

export function isIgnored(
  ig: Ignore,
  filePath: string,
  projectRoot: string
): boolean {
  const rel = relative(projectRoot, filePath);
  if (!rel || rel.startsWith('..')) return true;
  return ig.ignores(rel);
}
