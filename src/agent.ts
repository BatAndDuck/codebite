import { generateText, stepCountIs, type LanguageModel } from 'ai';
import type { CodebiteConfig } from './config.js';
import { getAllTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/system.js';
import { resolveEmbeddingModel } from './provider.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
  onStep?: (step: AgentStepInfo) => void;
}

export async function runAgent(options: RunAgentOptions): Promise<string> {
  const { model, question, config, onStep } = options;

  // Provide embedding model for semantic search when index exists
  const indexExists =
    existsSync(join(process.cwd(), '.codebite', 'vectors.json')) &&
    existsSync(join(process.cwd(), '.codebite', 'index'));

  let embeddingModel;
  if (indexExists) {
    try {
      embeddingModel = resolveEmbeddingModel(config);
    } catch {
      // Provider doesn't support embeddings — semantic search won't be available
    }
  }

  const tools = getAllTools(config, embeddingModel);
  const systemPrompt = buildSystemPrompt(config);

  let stepNumber = 0;

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: question,
    tools,
    stopWhen: stepCountIs(config.maxSteps),
    toolChoice: 'auto',
    onStepFinish: (event) => {
      if (onStep) {
        stepNumber += 1;
        const stepStartMs = Date.now();

        const toolCalls: ToolCallInfo[] = (event.toolCalls ?? []).map((tc: any) => {
          const matchingResult = (event.toolResults ?? []).find(
            (tr: any) => tr.toolCallId === tc.toolCallId
          );
          return {
            toolName: tc.toolName as string,
            args: tc.input ?? {},
            result: matchingResult?.output ?? undefined,
          };
        });

        const usage = event.usage ?? { inputTokens: 0, outputTokens: 0 };

        onStep({
          stepNumber,
          toolCalls,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          },
          durationMs: Date.now() - stepStartMs,
        });
      }
    },
  });

  return result.text;
}
