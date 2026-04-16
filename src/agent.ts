import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from 'ai';
import type { CodebiteConfig } from './config.js';
import { getAllTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/system.js';
import { buildExecutionPrompt } from './prompts/execution.js';
import { resolveEmbeddingModel } from './provider.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRepositoryStructure } from './utils/project-structure.js';
import { INDEX_DIR_NAME } from './indexer/index.js';
import {
  createDiagnosticsLogger,
  type StepInputSnapshot,
} from './utils/diagnostics.js';
import { compressMessages } from './utils/context-manager.js';
import { createLeaveNoteTool } from './tools/leave-note.js';

export interface ToolCallInfo {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentStepInfo {
  stepNumber: number;
  toolCalls: ToolCallInfo[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
}

export interface RunAgentOptions {
  model: LanguageModel;
  question: string;
  config: CodebiteConfig;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  diagnosticsPath?: string;
  activeChatId?: string | null;
  onStep?: (step: AgentStepInfo) => void;
}

export async function runAgent(options: RunAgentOptions): Promise<string> {
  const { model, question, config, history = [], diagnosticsPath, activeChatId, onStep } = options;

  // Provide embedding model for semantic search when index exists
  const indexExists = existsSync(join(process.cwd(), INDEX_DIR_NAME, 'meta.json'));

  let embeddingModel;
  if (indexExists) {
    try {
      embeddingModel = resolveEmbeddingModel(config);
    } catch {
      // Provider doesn't support embeddings — semantic search won't be available
    }
  }

  const runSubagent = config.deepMode && !config.disableSubagents
    ? (task: string) =>
        runAgent({
          model,
          question: task,
          config: { ...config, deepMode: false, maxSteps: Math.min(config.maxSteps, 20) },
        })
    : undefined;

  // G: Shared notes store — populated by the leave_note tool during the run,
  // injected into every subsequent step via compressMessages.
  const agentNotes: string[] = [];

  const tools = {
    ...getAllTools(config, embeddingModel, runSubagent),
    leave_note: createLeaveNoteTool(agentNotes),
  };
  // Fix 2: capture registered tool names from the registry now, before the run starts.
  // event.activeTools in experimental_onStepStart is never populated by the Vercel AI SDK
  // for toolChoice:'auto' runs, so we derive it here from the actual registry instead.
  const registeredToolNames = Object.keys(tools);

  const projectStructure = getRepositoryStructure();
  const systemPrompt = buildSystemPrompt(config, projectStructure, question);
  const executionPrompt = buildExecutionPrompt(question);
  const conversation: ModelMessage[] = [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: 'user',
      content: executionPrompt,
    },
  ];

  const stepInputs = new Map<number, StepInputSnapshot & { startedAtMs: number }>();
  const diagnosticsLogger = diagnosticsPath
    ? createDiagnosticsLogger(diagnosticsPath)
    : undefined;

  diagnosticsLogger?.writeRunStart({
    timestamp: new Date().toISOString(),
    question,
    executionPrompt,
    activeChatId: activeChatId ?? null,
    historyMessages: history.length,
    systemPrompt,
    initialMessages: conversation,
    repositoryStructure: projectStructure,
    registeredTools: registeredToolNames,   // Fix 2: full tool list at run start
    config: {
      provider: config.provider,
      model: config.model,
      maxSteps: config.maxSteps,
      deepMode: config.deepMode,
      disableSubagents: config.disableSubagents,
    },
  });

  let result;
  try {
    result = await generateText({
      model,
      // System prompt is passed as a message (not top-level `system`) so we can attach
      // Anthropic `cacheControl: ephemeral` — lets Anthropic/Vercel-gateway reuse the
      // ~2k-token system prompt across steps (and across runs within the 5-min TTL)
      // instead of paying for it every call. Providers that don't understand this field
      // silently ignore it, so it's safe across all 14 supported providers.
      messages: [
        {
          role: 'system',
          content: systemPrompt,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        } as ModelMessage,
        ...conversation,
      ],
      tools,
      stopWhen: stepCountIs(config.maxSteps),
      toolChoice: 'auto',
      // A + C + G: Before each LLM call, apply context compression:
      //   - Compress old tool results (read_file → signatures+header, grep → matches only)
      //   - Deduplicate overlapping file reads
      //   - Trim reasoning text from old assistant messages (keep tool-call records)
      //   - Inject agent scratchpad notes (from leave_note calls) at the top
      // The SDK's internal history is unchanged; only the model's view is trimmed.
      prepareStep: ({ stepNumber, messages }) => {
        const compressed = compressMessages(messages as ModelMessage[], {
          stepNumber,
          agentNotes,
        });
        return { messages: compressed };
      },
      experimental_onStepStart: (event) => {
        // Fix 3: event.system is empty because we inject the system prompt as a message
        // (to attach cacheControl). Extract it from messages[role=system] instead so the
        // log always has a populated `system` field, and keep only conversation messages
        // in `messages` (cleaner separation in the log).
        const systemMsg = (event.messages as any[]).find(m => m.role === 'system');
        const systemContent: unknown = systemMsg
          ? (typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content)
          : event.system;
        const conversationMessages = (event.messages as any[]).filter(m => m.role !== 'system');

        const snapshot = {
          stepNumber: event.stepNumber + 1,
          startedAt: new Date().toISOString(),
          startedAtMs: Date.now(),
          system: systemContent,           // Fix 3: extracted from messages, never empty
          messages: conversationMessages,  // Fix 3: system-stripped conversation only
          activeTools: registeredToolNames, // Fix 2: from registry, always populated
          toolChoice: event.toolChoice,
        };
        stepInputs.set(event.stepNumber, snapshot);

        diagnosticsLogger?.writeStepStart({
          timestamp: snapshot.startedAt,
          stepNumber: snapshot.stepNumber,
          system: snapshot.system,
          messages: snapshot.messages,
          activeTools: snapshot.activeTools,
          toolChoice: snapshot.toolChoice,
        });
      },
      onStepFinish: (event) => {
        const stepInput = stepInputs.get(event.stepNumber);
        const durationMs = stepInput ? Date.now() - stepInput.startedAtMs : 0;

        const toolCalls: ToolCallInfo[] = (event.toolCalls ?? []).map((tc: any) => {
          const matchingResult: any = (event.toolResults ?? []).find(
            (tr: any) => tr.toolCallId === tc.toolCallId
          );
          return {
            toolName: tc.toolName as string,
            args: tc.input ?? {},
            result: matchingResult?.output ?? matchingResult?.error ?? undefined,
          };
        });

        const usage = event.usage ?? { inputTokens: 0, outputTokens: 0 };

        diagnosticsLogger?.writeStepFinish({
          timestamp: new Date().toISOString(),
          stepNumber: event.stepNumber + 1,
          durationMs,
          finishReason: event.finishReason,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
          },
          llmResponse: {
            id: (event.response as any)?.id,
            modelId: (event.response as any)?.modelId,
            headers: (event.response as any)?.headers,
          },
          text: event.text,
          toolCalls: event.toolCalls,
          toolResults: event.toolResults,
          responseMessages: event.response?.messages,
        });

        if (onStep) {
          onStep({
            stepNumber: event.stepNumber + 1,
            toolCalls,
            usage: {
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            },
            durationMs,
          });
        }
      },
      onFinish: (event) => {
        diagnosticsLogger?.writeRunFinish({
          timestamp: new Date().toISOString(),
          stepCount: event.steps.length,
          totalUsage: event.totalUsage,
          finishReason: event.finishReason,
          finalText: event.text,
          // Fix 1b: explicit flag so empty-response runs are queryable
          // in diagnostics without having to parse finalText.
          emptyResponse: !event.text || event.text.trim().length === 0,
        });
      },
    });
  } catch (err) {
    diagnosticsLogger?.writeError({
      timestamp: new Date().toISOString(),
      error: err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : String(err),
      context: 'generateText threw an error',
    });
    throw err;
  }

  // Fix 1a: Guard against silent empty-response failures. The Vercel AI SDK can
  // return an empty string when the model emits tool calls without producing a
  // final text token, or when generation is interrupted. finishReason stays
  // "stop" in this case, so diagnostics alone would not surface the issue.
  // Auto-retry is NOT safe here — the model may have legitimately exhausted
  // its step budget or be waiting on a tool result that never arrived. Fail
  // loudly so the user can re-run with --max-steps or rephrase.
  if (!result.text || result.text.trim().length === 0) {
    const emptyErr = new Error(
      'Agent produced no response text. The model may have stopped before writing an answer. ' +
        'Try rephrasing the question or increasing --max-steps.',
    );
    diagnosticsLogger?.writeError({
      timestamp: new Date().toISOString(),
      error: { name: emptyErr.name, message: emptyErr.message, stack: emptyErr.stack },
      context: 'Agent finished with empty text',
    });
    throw emptyErr;
  }

  return result.text;
}
