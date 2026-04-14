import { tool } from 'ai';
import { z } from 'zod';
import { getDirectorySnapshot } from '../utils/project-structure.js';

export const directoryTreeTool = tool({
  description:
    'Show the directory tree structure. Respects .gitignore. Use to understand project layout.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('Directory to show tree for (default: project root)'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .default(4)
      .describe('Maximum depth to traverse (default 4)'),
    includeFiles: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include files or just directories'),
  }),
  execute: async ({ path: dirPath, maxDepth, includeFiles }) => {
    try {
      return getDirectorySnapshot({
        path: dirPath,
        maxDepth,
        includeFiles,
        maxEntries: 200,
      });
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
