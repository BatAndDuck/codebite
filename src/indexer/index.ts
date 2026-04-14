import { type LanguageModel } from 'ai';
import { glob } from 'glob';
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { LocalIndex } from 'vectra';
import type { CodebiteConfig } from '../config.js';
import { createGitignoreFilter } from '../utils/gitignore.js';
import { detectLanguage, isBinaryFile } from '../utils/language-detect.js';
import { analyzeFile, type FileAnalysis } from './analyzer.js';
import { generateEmbeddings } from './embeddings.js';
import { resolveEmbeddingModel } from '../provider.js';

export interface IndexStats {
  filesAnalyzed: number;
  chunksStored: number;
  durationMs: number;
}

export interface IndexMeta {
  createdAt: string;
  model: string;
  filesAnalyzed: number;
}

const MAX_FILE_SIZE = 100 * 1024; // 100KB

export const INDEX_DIR_NAME = '.codebite-index';

/** Build a rich text representation of a file analysis for embedding. */
function buildEmbedText(analysis: FileAnalysis): string {
  const parts = [analysis.purpose, analysis.summary];

  if (analysis.services.length > 0) {
    parts.push(`Services: ${analysis.services.join(', ')}`);
  }
  if (analysis.functions.length > 0) {
    const fnSummary = analysis.functions
      .map((f) => `${f.name}: ${f.description}`)
      .join('; ');
    parts.push(`Functions: ${fnSummary}`);
  }

  return parts.join('\n');
}

export async function buildIndex(
  config: CodebiteConfig,
  model: LanguageModel,
  onProgress?: (status: string) => void
): Promise<IndexStats> {
  const startTime = Date.now();
  const cwd = process.cwd();
  const ig = createGitignoreFilter(cwd);

  // Scan for files
  onProgress?.('Scanning files...');
  const allFiles = await glob('**/*', {
    cwd,
    nodir: true,
    dot: false,
    absolute: true,
    ignore: [`${INDEX_DIR_NAME}/**`],
  });

  const files = allFiles.filter((f) => {
    const rel = relative(cwd, resolve(f));
    if (ig.ignores(rel)) return false;
    if (isBinaryFile(f)) return false;
    try {
      const stat = readFileSync(f); // check readability
      return stat.length <= MAX_FILE_SIZE;
    } catch {
      return false;
    }
  });

  onProgress?.(`Found ${files.length} files to analyze...`);

  // Analyze each file with LLM
  const analyses: FileAnalysis[] = [];
  const concurrency = 3;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const rel = relative(cwd, resolve(file));
        const content = readFileSync(file, 'utf-8');
        const language = detectLanguage(file);

        onProgress?.(`Analyzing (${i + 1}/${files.length}): ${rel}`);

        try {
          return await analyzeFile(model, rel, content, language);
        } catch {
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result) analyses.push(result);
    }
  }

  // Generate embeddings for rich text (purpose + summary + services + functions)
  onProgress?.('Generating embeddings...');
  let embeddingModel;
  try {
    embeddingModel = resolveEmbeddingModel(config);
  } catch (err: any) {
    onProgress?.(`Skipping embeddings: ${err.message}`);
    const durationMs = Date.now() - startTime;
    return { filesAnalyzed: analyses.length, chunksStored: 0, durationMs };
  }

  const textsToEmbed = analyses.map(buildEmbedText);
  const embeddings = await generateEmbeddings(embeddingModel, textsToEmbed);

  // Build vectra LocalIndex at .codebite-index/
  onProgress?.('Storing vector index...');
  const indexDir = join(cwd, INDEX_DIR_NAME);

  // Clear and recreate the index directory
  if (existsSync(indexDir)) {
    rmSync(indexDir, { recursive: true, force: true });
  }
  mkdirSync(indexDir, { recursive: true });

  const vectorIndex = new LocalIndex(indexDir);
  await vectorIndex.createIndex();

  await vectorIndex.beginUpdate();
  try {
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      await vectorIndex.insertItem({
        vector: embeddings[i],
        metadata: {
          path: analysis.path,
          purpose: analysis.purpose,
          summary: analysis.summary,
          language: analysis.language,
          linesOfCode: analysis.linesOfCode,
          // Store arrays as JSON strings (vectra only supports primitive arrays)
          exports: JSON.stringify(analysis.exports),
          dependencies: JSON.stringify(analysis.dependencies),
          services: JSON.stringify(analysis.services),
          patterns: JSON.stringify(analysis.patterns),
          functions: JSON.stringify(analysis.functions),
        },
      });
    }
    await vectorIndex.endUpdate();
  } catch (err) {
    await vectorIndex.cancelUpdate();
    throw err;
  }

  // Write metadata file for staleness checks
  const meta: IndexMeta = {
    createdAt: new Date().toISOString(),
    model: config.model,
    filesAnalyzed: analyses.length,
  };
  writeFileSync(join(indexDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  const durationMs = Date.now() - startTime;
  return {
    filesAnalyzed: analyses.length,
    chunksStored: embeddings.length,
    durationMs,
  };
}

/** Read index metadata without loading the full vector index. */
export function readIndexMeta(cwd: string = process.cwd()): IndexMeta | null {
  const metaPath = join(cwd, INDEX_DIR_NAME, 'meta.json');
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as IndexMeta;
  } catch {
    return null;
  }
}
