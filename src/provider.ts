import { type LanguageModel, type EmbeddingModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import type { CodebiteConfig } from './config.js';

// ---------------------------------------------------------------------------
// Vercel AI Gateway
//
// Per Vercel docs, the `ai` package natively routes to the gateway when:
//   1. AI_GATEWAY_API_KEY is set in the environment
//   2. The model string is passed directly (e.g. 'openai/gpt-5.4-nano')
//
// No custom baseURL or provider factory is needed. The gateway key is set
// from config.apiKey at call time so it never needs to be an env var the
// user has to manage themselves.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provider factories (non-Vercel)
// ---------------------------------------------------------------------------

type AnyProvider =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createGoogleGenerativeAI>
  | ReturnType<typeof createMistral>;

function makeProvider(provider: string, apiKey: string): AnyProvider {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    case 'mistral':
      return createMistral({ apiKey });
    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: openai, anthropic, google, mistral, vercel`
      );
  }
}

// ---------------------------------------------------------------------------
// Public resolvers
// ---------------------------------------------------------------------------

export function resolveModel(
  config: Pick<CodebiteConfig, 'provider' | 'model' | 'apiKey'>
): LanguageModel {
  if (config.provider === 'vercel') {
    // Set the gateway key so the `ai` package can route the request.
    // The model string (e.g. 'openai/gpt-5.4-nano') is passed directly —
    // the Vercel AI SDK accepts string model IDs for the gateway natively.
    process.env.AI_GATEWAY_API_KEY = config.apiKey;
    return config.model as unknown as LanguageModel;
  }

  const p = makeProvider(config.provider, config.apiKey);
  return p.languageModel(config.model as any);
}

// Providers that expose a textEmbeddingModel and their default model IDs
const EMBEDDING_MODELS: Record<string, string> = {
  openai: 'text-embedding-3-small',
  vercel: 'text-embedding-3-small',
  google: 'text-embedding-004',
  mistral: 'mistral-embed',
  // anthropic has no embedding API
};

export function resolveEmbeddingModel(
  config: Pick<CodebiteConfig, 'provider' | 'model' | 'apiKey'>
): EmbeddingModel {
  if (config.provider === 'vercel') {
    // Use the openai embedding model via the gateway
    process.env.AI_GATEWAY_API_KEY = config.apiKey;
    return `openai/${EMBEDDING_MODELS.vercel}` as unknown as EmbeddingModel;
  }

  const modelId = EMBEDDING_MODELS[config.provider];
  if (!modelId) {
    throw new Error(
      `Provider "${config.provider}" does not support embeddings. ` +
        `Supported: ${Object.keys(EMBEDDING_MODELS).join(', ')}`
    );
  }

  const p = makeProvider(config.provider, config.apiKey);
  return (p as any).textEmbeddingModel(modelId) as EmbeddingModel;
}
