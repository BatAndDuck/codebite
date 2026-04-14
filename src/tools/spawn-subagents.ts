import { tool } from 'ai';
import { z } from 'zod';

export function createSpawnSubagentsTool(runSubagent: (task: string) => Promise<string>) {
  return tool({
    description:
      'Spawn 1–5 focused subagents that run in parallel, each exploring an independent subtask and returning its findings. Use this to parallelize independent investigations — e.g., "analyze auth flow", "check test coverage", "trace DB schema". Subagents cannot spawn further subagents. Only available in deep mode.',
    inputSchema: z.object({
      tasks: z
        .array(
          z.object({
            id: z
              .string()
              .min(1)
              .describe('Short unique identifier for this subtask, e.g. "auth-flow", "db-schema"'),
            task: z
              .string()
              .min(1)
              .describe('Full task description for the subagent to execute'),
          })
        )
        .min(1)
        .max(5)
        .describe('List of 1–5 parallel subtasks to delegate'),
    }),
    execute: async ({ tasks }) => {
      const settled = await Promise.allSettled(
        tasks.map((t) => runSubagent(t.task))
      );

      const results = settled.map((outcome, i) => {
        const { id, task } = tasks[i];
        if (outcome.status === 'fulfilled') {
          return {
            id,
            task,
            status: 'fulfilled' as const,
            findings: outcome.value,
            error: '',
          };
        }
        return {
          id,
          task,
          status: 'rejected' as const,
          findings: '',
          error:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
        };
      });

      return { results };
    },
  });
}
