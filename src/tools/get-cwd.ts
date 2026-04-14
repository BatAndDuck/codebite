import { tool } from 'ai';
import { z } from 'zod';

export const getCwdTool = tool({
  description: 'Get the current working directory (the project root being analyzed).',
  inputSchema: z.object({}),
  execute: async () => ({ cwd: process.cwd() }),
});
