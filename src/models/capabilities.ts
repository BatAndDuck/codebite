export type ModelTier = 'small' | 'medium' | 'large';

export interface ModelCapabilities {
  /** Advertised total context window (tokens). */
  contextWindow: number;
  /**
   * Conservative practical input budget — lower than contextWindow to account
   * for gateway timeouts, slow inference on large inputs, and full-envelope
   * overhead (tool schemas, synthetic turns, etc.).
   * This is what we actually budget against.
   */
  safeInputBudget: number;
  /** Max tokens to request for model output. */
  maxOutputTokens: number;
  /** Minimum tokens always kept free for the model's response. */
  reservedOutput: number;
  /** Recommended max agent steps; caps config.maxSteps for this model. */
  recommendedMaxSteps: number;
  /** Tier drives prompt variant and default tool parameters. */
  tier: ModelTier;
  /** SDK-level retry count for transient transport failures (429/5xx/timeout). */
  maxRetries: number;
}

const DEFAULTS: ModelCapabilities = {
  contextWindow: 8_192,
  safeInputBudget: 6_000,
  maxOutputTokens: 1_024,
  reservedOutput: 1_024,
  recommendedMaxSteps: 12,
  tier: 'small',
  maxRetries: 2,
};

// Registry: "provider/model" → partial capabilities merged over DEFAULTS.
// Unknown (provider, model) combos fall back to the conservative small-tier default.
const REGISTRY: Record<string, Partial<ModelCapabilities>> = {
  // ── Anthropic ────────────────────────────────────────────────────────────────
  'anthropic/claude-3-5-haiku-20241022':  { contextWindow: 200_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'anthropic/claude-haiku-4-5':           { contextWindow: 200_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'anthropic/claude-haiku-4-5-20251001':  { contextWindow: 200_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'anthropic/claude-3-5-sonnet-20241022': { contextWindow: 200_000, safeInputBudget: 120_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 50, tier: 'large',  maxRetries: 2 },
  'anthropic/claude-sonnet-4-6':          { contextWindow: 200_000, safeInputBudget: 120_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 50, tier: 'large',  maxRetries: 2 },
  'anthropic/claude-opus-4-7':            { contextWindow: 200_000, safeInputBudget: 120_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 50, tier: 'large',  maxRetries: 2 },
  // ── OpenAI ───────────────────────────────────────────────────────────────────
  'openai/gpt-4o':                        { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'openai/gpt-4o-mini':                   { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'openai/gpt-4.1':                       { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'openai/gpt-4.1-mini':                  { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'openai/gpt-5.4-mini':                  { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'openai/gpt-5.4-nano':                  { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'openai/o1':                            { contextWindow: 200_000, safeInputBudget: 80_000,  maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 20, tier: 'large',  maxRetries: 1 },
  'openai/o3-mini':                       { contextWindow: 200_000, safeInputBudget: 80_000,  maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 20, tier: 'large',  maxRetries: 1 },
  // ── Google ───────────────────────────────────────────────────────────────────
  'google/gemini-2.0-flash':              { contextWindow: 1_048_576, safeInputBudget: 200_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 60, tier: 'large', maxRetries: 2 },
  'google/gemini-2.5-pro':               { contextWindow: 1_048_576, safeInputBudget: 200_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 60, tier: 'large', maxRetries: 2 },
  'google/gemini-1.5-flash':              { contextWindow: 1_048_576, safeInputBudget: 200_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 60, tier: 'large', maxRetries: 2 },
  'google/gemini-1.5-pro':               { contextWindow: 1_048_576, safeInputBudget: 200_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 60, tier: 'large', maxRetries: 2 },
  // ── DeepSeek (direct) ────────────────────────────────────────────────────────
  'deepseek/deepseek-chat':               { contextWindow: 64_000,  safeInputBudget: 24_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 20, tier: 'medium', maxRetries: 3 },
  'deepseek/deepseek-reasoner':           { contextWindow: 64_000,  safeInputBudget: 24_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 15, tier: 'medium', maxRetries: 3 },
  // ── DeepSeek through Vercel gateway — conservative input budget due to timeout risk ──
  'vercel/deepseek/deepseek-chat':        { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-v3':          { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-v3.1':        { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-v3.2':        { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-v3.2-thinking': { contextWindow: 64_000, safeInputBudget: 18_000, maxOutputTokens: 8_192, reservedOutput: 8_192, recommendedMaxSteps: 30, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-v4-flash':    { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  'vercel/deepseek/deepseek-r1':          { contextWindow: 64_000,  safeInputBudget: 18_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'medium', maxRetries: 3 },
  // ── MiniMax through Vercel gateway ──────────────────────────────────────────
  'vercel/minimax/minimax-m2.5':          { contextWindow: 40_960,  safeInputBudget: 24_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 35, tier: 'medium', maxRetries: 2 },
  // ── Vercel gateway — OpenAI models ───────────────────────────────────────────
  'vercel/openai/gpt-4o':                 { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'vercel/openai/gpt-4o-mini':            { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'vercel/openai/gpt-4.1':               { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'vercel/openai/gpt-4.1-mini':          { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'vercel/openai/gpt-5.4-mini':          { contextWindow: 128_000, safeInputBudget: 80_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 40, tier: 'large',  maxRetries: 2 },
  'vercel/openai/gpt-5.4-nano':          { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 2_048, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  // ── Groq ─────────────────────────────────────────────────────────────────────
  'groq/llama-3.3-70b-versatile':         { contextWindow: 128_000, safeInputBudget: 32_000,  maxOutputTokens: 2_048, reservedOutput: 2_048, recommendedMaxSteps: 25, tier: 'medium', maxRetries: 3 },
  'groq/llama-3.1-8b-instant':            { contextWindow: 128_000, safeInputBudget: 16_000,  maxOutputTokens: 1_024, reservedOutput: 1_024, recommendedMaxSteps: 15, tier: 'medium', maxRetries: 3 },
  'groq/mixtral-8x7b-32768':              { contextWindow: 32_000,  safeInputBudget: 12_000,  maxOutputTokens: 1_024, reservedOutput: 1_024, recommendedMaxSteps: 12, tier: 'small',  maxRetries: 3 },
  // ── Mistral ───────────────────────────────────────────────────────────────────
  'mistral/mistral-large-latest':         { contextWindow: 128_000, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'mistral/mistral-small-latest':         { contextWindow: 128_000, safeInputBudget: 32_000,  maxOutputTokens: 2_048, reservedOutput: 2_048, recommendedMaxSteps: 20, tier: 'medium', maxRetries: 2 },
  // ── xAI ───────────────────────────────────────────────────────────────────────
  'xai/grok-2':                           { contextWindow: 131_072, safeInputBudget: 60_000,  maxOutputTokens: 4_096, reservedOutput: 4_096, recommendedMaxSteps: 30, tier: 'large',  maxRetries: 2 },
  'xai/grok-3-mini':                      { contextWindow: 131_072, safeInputBudget: 40_000,  maxOutputTokens: 2_048, reservedOutput: 2_048, recommendedMaxSteps: 25, tier: 'medium', maxRetries: 2 },
  // ── Together AI ───────────────────────────────────────────────────────────────
  'togetherai/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo':  { contextWindow: 131_072, safeInputBudget: 16_000, maxOutputTokens: 1_024, reservedOutput: 1_024, recommendedMaxSteps: 12, tier: 'small',  maxRetries: 2 },
  'togetherai/meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo': { contextWindow: 131_072, safeInputBudget: 40_000, maxOutputTokens: 2_048, reservedOutput: 2_048, recommendedMaxSteps: 25, tier: 'medium', maxRetries: 2 },
  // ── Fireworks ──────────────────────────────────────────────────────────────────
  'fireworks/accounts/fireworks/models/llama-v3p1-8b-instruct':  { contextWindow: 131_072, safeInputBudget: 16_000, maxOutputTokens: 1_024, reservedOutput: 1_024, recommendedMaxSteps: 12, tier: 'small',  maxRetries: 2 },
  'fireworks/accounts/fireworks/models/llama-v3p3-70b-instruct': { contextWindow: 131_072, safeInputBudget: 40_000, maxOutputTokens: 2_048, reservedOutput: 2_048, recommendedMaxSteps: 25, tier: 'medium', maxRetries: 2 },
};

/**
 * Returns capabilities for the given provider + model combo.
 * Unknown combos fall back to conservative small-tier defaults.
 * Optional `overrides` win over everything (for user-configured custom endpoints).
 */
export function getCapabilities(
  provider: string,
  model: string,
  overrides?: Partial<ModelCapabilities>,
): ModelCapabilities {
  const key = `${provider}/${model}`;
  const registered = REGISTRY[key] ?? {};
  return { ...DEFAULTS, ...registered, ...overrides };
}

/** Default read_file line limit per tier (smaller = less context bloat per step). */
export const READ_FILE_LIMIT_BY_TIER: Record<ModelTier, number> = {
  small: 150,
  medium: 300,
  large: 500,
};
