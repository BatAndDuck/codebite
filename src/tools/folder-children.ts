import { tool } from 'ai';
import { z } from 'zod';
import { listDirectoryTool } from './list-directory.js';

export const folderChildrenTool = tool({
  description:
    'Show only the immediate child folders and files for a directory. This is a one-level folder structure view, not a recursive tree.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('Directory to inspect (default: project root)'),
  }),
  execute: async ({ path }) => listDirectoryTool.execute!({ path }, {} as any),
});
