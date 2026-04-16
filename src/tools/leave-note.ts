import { tool } from 'ai';
import { z } from 'zod';

/**
 * Creates a `leave_note` tool that writes persistent notes into a shared array.
 * The array is owned by the caller (agent.ts) and injected into every subsequent
 * step via the context-manager's notes injection, so notes survive compression.
 *
 * Usage by the agent:
 *   leave_note({ note: "src/agent.ts:130 — stepCountIs enforced via stopWhen" })
 *
 * Notes are ideal for:
 *   - Key file paths and line numbers the agent will need later
 *   - Discovered facts that may be compressed away from tool results
 *   - Cross-file relationships and important function signatures
 *   - Anything worth keeping that fits in 1-3 sentences
 */
export function createLeaveNoteTool(notesStore: string[]) {
  return tool({
    description:
      'Save a persistent note that will be visible in every future step of this session, even after old tool results are compressed away. ' +
      'Use for key findings you will need later: file paths, line numbers, function signatures, important relationships, or architectural facts. ' +
      'Be specific — include concrete details like "src/agent.ts:130 uses stopWhen: stepCountIs()" rather than vague summaries.',
    inputSchema: z.object({
      note: z
        .string()
        .min(1)
        .describe(
          'The note text. Include specific file:line references, code snippets, or factual findings. ' +
          'Markdown is supported. Keep it concise (1–5 sentences). ' +
          'You can also write [AGENT_NOTE: ...] inline in your reasoning text to preserve a snippet from assistant trimming.',
        ),
    }),
    execute: async ({ note }) => {
      notesStore.push(note);
      return {
        saved: true,
        noteIndex: notesStore.length,
        message: `Note #${notesStore.length} saved. It will appear in all subsequent steps.`,
      };
    },
  });
}
