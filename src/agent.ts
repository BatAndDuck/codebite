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
  createContextDiagnosisLogger,
  type StepInputSnapshot,
} from './utils/context-diagnosis.js';

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
  contextDiagnosisPath?: string;
  activeChatId?: string | null;
  onStep?: (step: AgentStepInfo) => void;
}

export async function runAgent(options: RunAgentOptions): Promise<string> {
  const { model, question, config, history = [], contextDiagnosisPath, activeChatId, onStep } = options;

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

  const tools = getAllTools(config, embeddingModel, runSubagent);
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
  const diagnosisLogger = contextDiagnosisPath
    ? createContextDiagnosisLogger(contextDiagnosisPath)
    : undefined;

  diagnosisLogger?.writeRunStart({
    timestamp: new Date().toISOString(),
    question,
    executionPrompt,
    activeChatId: activeChatId ?? null,
    historyMessages: history.length,
    systemPrompt,
    initialMessages: conversation,
    repositoryStructure: projectStructure,
  });

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: conversation,
    tools,
    stopWhen: stepCountIs(config.maxSteps),
    toolChoice: 'auto',
    experimental_onStepStart: (event) => {
      stepInputs.set(event.stepNumber, {
        stepNumber: event.stepNumber + 1,
        startedAt: new Date().toISOString(),
        startedAtMs: Date.now(),
        system: event.system,
        messages: event.messages,
        activeTools: event.activeTools?.map((toolName) => String(toolName)),
        toolChoice: event.toolChoice,
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

      diagnosisLogger?.writeStep({
        timestamp: new Date().toISOString(),
        stepNumber: event.stepNumber + 1,
        finishReason: event.finishReason,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        },
        inputContext: stepInput
          ? {
              startedAt: stepInput.startedAt,
              system: stepInput.system,
              messages: stepInput.messages,
              activeTools: stepInput.activeTools,
              toolChoice: stepInput.toolChoice,
            }
          : undefined,
        output: {
          text: event.text,
          toolCalls: event.toolCalls,
          toolResults: event.toolResults,
          responseMessages: event.response?.messages,
        },
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
      diagnosisLogger?.writeRunFinish({
        timestamp: new Date().toISOString(),
        stepCount: event.steps.length,
        totalUsage: event.totalUsage,
        finishReason: event.finishReason,
        finalText: event.text,
      });
    },
  });

  return result.text;
}
