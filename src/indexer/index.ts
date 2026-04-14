import { type LanguageModel } from 'ai';
import { glob } from 'glob';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

const MAX_FILE_SIZE = 100 * 1024; // 100KB

export async function buildIndex(
  config: CodebiteConfig,
  model: LanguageModel,
  onProgress?: (status: string) => void
): Promise<IndexStats> {
  const startTime = Date.now();
  const cwd = process.cwd();
  const ig = createGitignoreFilter(cwd);

  // Create .codebite directories
  const codebiteDir = join(cwd, '.codebite');
  const indexDir = join(codebiteDir, 'index');
  mkdirSync(indexDir, { recursive: true });

  // Scan for files
  onProgress?.('Scanning files...');
  const allFiles = await glob('**/*', {
    cwd,
    nodir: true,
    dot: false,
    absolute: true,
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
  const concurrency = 3; // Analyze 3 files at a time

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const rel = relative(cwd, resolve(file));
        const content = readFileSync(file, 'utf-8');
        const language = detectLanguage(file);

        onProgress?.(
          `Analyzing (${i + 1}/${files.length}): ${rel}`
        );

        try {
          return await analyzeFile(model, rel, content, language);
        } catch (err: any) {
          // Skip files that fail analysis
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result) analyses.push(result);
    }
  }

  // Save individual analysis files
  onProgress?.('Saving analysis results...');
  for (const analysis of analyses) {
    const filename = analysis.path.replace(/[/\\]/g, '__') + '.json';
    writeFileSync(
      join(indexDir, filename),
      JSON.stringify(analysis, null, 2),
      'utf-8'
    );
  }

  // Generate embeddings for purpose + summary
  onProgress?.('Generating embeddings...');
  let embeddingModel;
  try {
    embeddingModel = resolveEmbeddingModel(config);
  } catch (err: any) {
    // If provider doesn't support embeddings, save analyses without vectors
    onProgress?.(`Skipping embeddings: ${err.message}`);
    const durationMs = Date.now() - startTime;
    return {
      filesAnalyzed: analyses.length,
      chunksStored: 0,
      durationMs,
    };
  }

  const textsToEmbed = analyses.map(
    (a) => `${a.purpose}\n${a.summary}`
  );

  const embeddings = await generateEmbeddings(embeddingModel, textsToEmbed);

  // Save vectors
  const vectorData = {
    model: config.model,
    createdAt: new Date().toISOString(),
    entries: analyses.map((a, i) => ({
      path: a.path,
      vector: embeddings[i],
    })),
  };

  writeFileSync(
    join(codebiteDir, 'vectors.json'),
    JSON.stringify(vectorData),
    'utf-8'
  );

  const durationMs = Date.now() - startTime;
  return {
    filesAnalyzed: analyses.length,
    chunksStored: embeddings.length,
    durationMs,
  };
}
