/**
 * Lightweight lookup of pre-built index summaries (B).
 *
 * During `codebite index`, the indexer writes `.codebite-index/file-summaries.json`
 * keyed by file path. This module reads that file and exposes a fast O(1) lookup
 * so `read_file` can prepend semantic context (purpose, exports, function list)
 * without loading the full vector index.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INDEX_DIR_NAME } from '../indexer/index.js';

export const FILE_SUMMARIES_FILENAME = 'file-summaries.json';

export interface FileSummaryEntry {
  purpose: string;
  summary: string;
  exports: string[];
  functions: Array<{ name: string; description: string }>;
  language: string;
  linesOfCode: number;
}

/** Map of normalized path (forward slashes) → summary. */
export type FileSummaries = Record<string, FileSummaryEntry>;

/**
 * Loads `file-summaries.json` from the index directory.
 * Returns `null` if the index has never been built or if the file is missing/corrupt.
 */
export function loadFileSummaries(cwd: string = process.cwd()): FileSummaries | null {
  const summariesPath = join(cwd, INDEX_DIR_NAME, FILE_SUMMARIES_FILENAME);
  if (!existsSync(summariesPath)) return null;
  try {
    return JSON.parse(readFileSync(summariesPath, 'utf-8')) as FileSummaries;
  } catch {
    return null;
  }
}

/**
 * Look up the summary for a given file path.
 * Tries both the raw path and a forward-slash normalised version.
 */
export function getFileSummary(
  filePath: string,
  summaries: FileSummaries | null,
): FileSummaryEntry | null {
  if (!summaries) return null;
  const normalized = filePath.replace(/\\/g, '/');
  return summaries[normalized] ?? summaries[filePath] ?? null;
}
