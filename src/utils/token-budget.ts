import type { ModelMessage } from 'ai';
import type { ModelCapabilities } from '../models/capabilities.js';

export type BudgetPressure = 'ok' | 'tight' | 'critical';

export interface BudgetResult {
  /** Estimated total envelope tokens for this step. */
  estimatedTokens: number;
  /** Tokens remaining in the safe budget after reserving output headroom. */
  remaining: number;
  /** Compression pressure level. */
  pressure: BudgetPressure;
}

/**
 * Pessimistic token estimator: 1 token ≈ 3 chars.
 * Code/JSON is denser than prose (~4 chars/token) but 3 keeps us safely
 * under-estimated so we compress before limits are hit, not after.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

function estimateValue(value: unknown): number {
  return estimateTokens(typeof value === 'string' ? value : JSON.stringify(value ?? ''));
}

/**
 * Estimates total input tokens for the upcoming LLM call and computes
 * pressure relative to the model's safe input budget.
 *
 * The full envelope includes:
 *   - All messages (system, user, assistant, tool)
 *   - Tool schema overhead (estimated constant; caller can override)
 *
 * Pressure thresholds (relative to safeInputBudget):
 *   ok       → remaining >= 30%
 *   tight    → remaining 10–30%
 *   critical → remaining < 10%
 */
export function computeBudget(
  capabilities: ModelCapabilities,
  messages: ModelMessage[],
  toolSchemasEstimate = 2_000,
): BudgetResult {
  const budget = capabilities.safeInputBudget;

  let estimatedTokens = toolSchemasEstimate;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      estimatedTokens += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as any[]) {
        estimatedTokens += estimateValue(
          part.text ?? part.output ?? part.value ?? part,
        );
      }
    }
  }

  const remaining = budget - estimatedTokens - capabilities.reservedOutput;
  const pct = budget > 0 ? remaining / budget : 0;

  const pressure: BudgetPressure =
    pct < 0.10 ? 'critical' :
    pct < 0.30 ? 'tight' :
    'ok';

  return { estimatedTokens, remaining, pressure };
}
