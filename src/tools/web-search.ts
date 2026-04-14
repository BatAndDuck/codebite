import { tool } from 'ai';
import { z } from 'zod';
import { tavily } from '@tavily/core';

export function createWebSearchTool(tavilyApiKey: string) {
  return tool({
    description:
      'Search the web for documentation, API references, library versions, best practices, and technical information. Use when you need external context about libraries, frameworks, or tools used in the project.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe('Max results to return'),
    }),
    execute: async ({ query, maxResults }) => {
      try {
        const client = tavily({ apiKey: tavilyApiKey });
        const response = await client.search(query, {
          maxResults,
          searchDepth: 'basic',
        });

        return {
          query,
          results: response.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content?.slice(0, 500),
          })),
        };
      } catch (err: any) {
        return { error: `Web search failed: ${err.message}` };
      }
    },
  });
}
