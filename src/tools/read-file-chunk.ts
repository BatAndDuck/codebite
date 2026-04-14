import { tool } from 'ai';
import { z } from 'zod';
import { readFileTool } from './read-file.js';

export const readFileChunkTool = tool({
  description:
    'Read only a focused chunk of a file. Use this for large files or when you need a specific section without pulling the whole file chunk into context.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root'),
    offset: z
      .number()
      .int()
      .min(0)
      .describe('Start reading from this line (0-based)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .default(200)
      .describe('Max lines to read in this chunk (default 200, max 250)'),
  }),
  execute: async ({ path, offset, limit }) =>
    readFileTool.execute!({ path, offset, limit }, {} as any),
});
