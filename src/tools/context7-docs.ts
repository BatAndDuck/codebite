import { createMCPClient } from '@ai-sdk/mcp';
import { tool } from 'ai';
import { z } from 'zod';

const CONTEXT7_MCP_URL = 'https://mcp.context7.com/mcp';

export function createContext7DocsTool(context7ApiKey?: string) {
  return tool({
    description:
      'Fetch up-to-date documentation for a library, framework, SDK, API, CLI, or cloud service using Context7 MCP. Use for setup, configuration, migrations, API syntax, and version-specific docs.',
    inputSchema: z.object({
      libraryName: z
        .string()
        .min(1)
        .describe('Official library or product name, for example "Next.js", "Prisma", or "React"'),
      query: z
        .string()
        .min(1)
        .describe('Specific documentation question or task to answer'),
      libraryId: z
        .string()
        .optional()
        .describe('Optional exact Context7 library ID like "/vercel/next.js" to skip resolution'),
    }),
    execute: async ({ libraryName, query, libraryId }) => {
      let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

      try {
        if (!context7ApiKey) {
          return {
            error:
              'Context7 documentation lookup is not configured. Set tools.context7ApiKey in .codebite.local.json or CONTEXT7_API_KEY in the environment.',
          };
        }

        client = await createMCPClient({
          transport: {
            type: 'http',
            url: CONTEXT7_MCP_URL,
            headers: {
              CONTEXT7_API_KEY: context7ApiKey,
            },
          },
        });

        const tools = await client.tools();
        const resolveTool = tools['resolve-library-id'];
        const queryTool = tools['query-docs'];

        if (!queryTool?.execute) {
          return { error: 'Context7 MCP did not expose the query-docs tool.' };
        }

        let resolvedLibraryId = libraryId;
        let resolveResult: unknown = undefined;

        if (!resolvedLibraryId) {
          if (!resolveTool?.execute) {
            return { error: 'Context7 MCP did not expose the resolve-library-id tool.' };
          }

          resolveResult = await resolveTool.execute({ libraryName, query }, {} as any);
          resolvedLibraryId = extractLibraryId(resolveResult);
        }

        if (!resolvedLibraryId) {
          return {
            error: `Could not resolve a Context7 library ID for "${libraryName}".`,
            resolveResult,
          };
        }

        const docsResult = await queryTool.execute(
          {
            libraryId: resolvedLibraryId,
            query,
          },
          {} as any
        );

        return {
          libraryName,
          libraryId: resolvedLibraryId,
          resolveResult,
          docs: docsResult,
        };
      } catch (err: any) {
        return { error: `Context7 lookup failed: ${err.message}` };
      } finally {
        await client?.close();
      }
    },
  });
}

function extractLibraryId(result: unknown): string | undefined {
  const candidates = collectLibraryIds(result);
  return candidates[0];
}

function collectLibraryIds(value: unknown): string[] {
  if (typeof value === 'string') {
    const matches = value.match(/\/[a-z0-9._-]+(?:\/[a-z0-9._-]+)+/gi);
    return matches ?? [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLibraryIds(item));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as Record<string, unknown>;
  const directKeys = [
    'context7CompatibleLibraryID',
    'context7CompatibleLibraryId',
    'libraryId',
    'id',
  ];

  const direct = directKeys
    .map((key) => obj[key])
    .filter((item): item is string => typeof item === 'string' && item.startsWith('/'));

  return [
    ...direct,
    ...Object.values(obj).flatMap((item) => collectLibraryIds(item)),
  ];
}
