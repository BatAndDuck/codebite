import { tool } from 'ai';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { embed, type EmbeddingModel } from 'ai';

interface FileAnalysis {
  path: string;
  purpose: string;
  exports: string[];
  dependencies: string[];
  summary: string;
  language: string;
  linesOfCode: number;
}

export function createSemanticSearchTool(embeddingModel: EmbeddingModel) {
  return tool({
    description:
      'Search the codebase semantically using the pre-built index. Finds files whose purpose and content match your query conceptually. The index must be built first via "codebite index".',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Natural language description of what you are looking for'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Max results to return'),
    }),
    execute: async ({ query, maxResults }) => {
      const cwd = process.cwd();
      const indexDir = join(cwd, '.codebite', 'index');
      const vectorsPath = join(cwd, '.codebite', 'vectors.json');

      if (!existsSync(indexDir) || !existsSync(vectorsPath)) {
        return {
          error:
            'No index found. Run "codebite index" to analyze and index the codebase first.',
        };
      }

      try {
        // Generate embedding for query
        const { embedding: queryVector } = await embed({
          model: embeddingModel,
          value: query,
        });

        // Load stored vectors
        const vectorData: { entries: Array<{ path: string; vector: number[] }> } =
          JSON.parse(readFileSync(vectorsPath, 'utf-8'));

        // Compute cosine similarity
        const scored = vectorData.entries.map((entry) => ({
          path: entry.path,
          score: cosineSimilarity(queryVector, entry.vector),
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, maxResults);

        // Load analysis details for top results
        const results = topResults.map((r) => {
          const analysisPath = join(
            indexDir,
            r.path.replace(/[/\\]/g, '__') + '.json'
          );
          let analysis: FileAnalysis | null = null;
          if (existsSync(analysisPath)) {
            try {
              analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
            } catch {
              // ignore
            }
          }

          return {
            path: r.path,
            score: Math.round(r.score * 1000) / 1000,
            purpose: analysis?.purpose,
            summary: analysis?.summary,
            exports: analysis?.exports,
            language: analysis?.language,
          };
        });

        return { query, results };
      } catch (err: any) {
        return { error: `Semantic search failed: ${err.message}` };
      }
    },
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export { cosineSimilarity };
