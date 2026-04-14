import { tool } from 'ai';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { embed, type EmbeddingModel } from 'ai';
import { LocalIndex } from 'vectra';
import { INDEX_DIR_NAME } from '../indexer/index.js';

export function createSemanticSearchTool(embeddingModel: EmbeddingModel) {
  return tool({
    description:
      'Search the codebase semantically using the pre-built vector index. Finds files whose purpose, functions, and service integrations match your query conceptually. Ideal for queries like "integrations to Notification Hub" or "where is payment processing handled". The index must be built first via "codebite index".',
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
      const indexDir = join(cwd, INDEX_DIR_NAME);

      if (!existsSync(indexDir)) {
        return {
          error:
            'No index found. Run "codebite index" to analyze and index the codebase first.',
        };
      }

      try {
        const vectorIndex = new LocalIndex(indexDir);

        if (!(await vectorIndex.isIndexCreated())) {
          return {
            error:
              'Index directory exists but index is not initialized. Run "codebite index" to rebuild it.',
          };
        }

        // Generate embedding for query
        const { embedding: queryVector } = await embed({
          model: embeddingModel,
          value: query,
        });

        // Query the vector index
        const queryResults = await vectorIndex.queryItems(queryVector, maxResults);

        const results = queryResults.map((r) => {
          const m = r.item.metadata as Record<string, any>;

          // Parse JSON-serialized arrays back to typed values
          const parseArr = <T>(val: unknown): T[] => {
            if (typeof val === 'string') {
              try { return JSON.parse(val); } catch { return []; }
            }
            return Array.isArray(val) ? val : [];
          };

          return {
            path: String(m['path'] ?? ''),
            score: Math.round(r.score * 1000) / 1000,
            purpose: String(m['purpose'] ?? ''),
            summary: String(m['summary'] ?? ''),
            language: String(m['language'] ?? ''),
            linesOfCode: Number(m['linesOfCode'] ?? 0),
            exports: parseArr<string>(m['exports']),
            services: parseArr<string>(m['services']),
            functions: parseArr<{ name: string; description: string }>(m['functions']),
          };
        });

        return { query, results };
      } catch (err: any) {
        return { error: `Semantic search failed: ${err.message}` };
      }
    },
  });
}
