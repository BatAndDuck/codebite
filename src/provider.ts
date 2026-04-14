import { type LanguageModel, type EmbeddingModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAzure } from '@ai-sdk/azure';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createFireworks } from '@ai-sdk/fireworks';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProvider(provider: string, apiKey: string, baseURL?: string): any {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    case 'mistral':
      return createMistral({ apiKey });
    case 'groq':
      return createGroq({ apiKey });
    case 'xai':
      return createXai({ apiKey });
    case 'cohere':
      return createCohere({ apiKey });
    case 'deepseek':
      return createDeepSeek({ apiKey });
    case 'bedrock':
      // Uses the AWS credential chain: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
      // AWS_REGION env vars (or ~/.aws/credentials, IAM roles).
      // apiKey in config is ignored for Bedrock — set it to any placeholder.
      return createAmazonBedrock();
    case 'azure':
      // baseURL should be your Azure OpenAI endpoint, e.g.:
      // https://<resource>.openai.azure.com/openai/deployments
      return createAzure({ apiKey, ...(baseURL ? { baseURL } : {}) });
    case 'togetherai':
      return createTogetherAI({ apiKey });
    case 'fireworks':
      return createFireworks({ apiKey });
    case 'litellm':
      // LiteLLM exposes an OpenAI-compatible API.
      // Defaults to http://localhost:4000 when baseURL is not set.
      return createOpenAI({ apiKey, baseURL: baseURL || 'http://localhost:4000' });
    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: ` +
          `openai, anthropic, google, mistral, vercel, groq, xai, cohere, deepseek, ` +
          `bedrock, azure, togetherai, fireworks, litellm`
      );
  }
}

// ---------------------------------------------------------------------------
// Public resolvers
// ---------------------------------------------------------------------------

export function resolveModel(
  config: Pick<CodebiteConfig, 'provider' | 'model' | 'apiKey' | 'baseURL'>
): LanguageModel {
  if (config.provider === 'vercel') {
    // Set the gateway key so the `ai` package can route the request.
    // The model string (e.g. 'openai/gpt-5.4-nano') is passed directly —
    // the Vercel AI SDK accepts string model IDs for the gateway natively.
    process.env.AI_GATEWAY_API_KEY = config.apiKey;
    return config.model as unknown as LanguageModel;
  }

  const p = makeProvider(config.provider, config.apiKey, config.baseURL);
  return p.languageModel(config.model);
}

// Providers that expose a textEmbeddingModel and their default model IDs
const EMBEDDING_MODELS: Record<string, string> = {
  openai: 'text-embedding-3-small',
  vercel: 'text-embedding-3-small',
  google: 'text-embedding-004',
  mistral: 'mistral-embed',
  cohere: 'embed-multilingual-v3.0',
  bedrock: 'amazon.titan-embed-text-v2:0',
  azure: 'text-embedding-3-small',
  litellm: 'text-embedding-3-small',
  // anthropic, groq, xai, deepseek, togetherai, fireworks have no embedding API
};

/** Returns the canonical embedding model ID string for a given provider. */
export function resolveEmbeddingModelId(
  config: Pick<CodebiteConfig, 'provider'>
): string {
  if (config.provider === 'vercel') {
    return `openai/${EMBEDDING_MODELS.vercel}`;
  }

  const modelId = EMBEDDING_MODELS[config.provider];
  if (!modelId) {
    throw new Error(
      `Provider "${config.provider}" does not support embeddings. ` +
        `Supported: ${Object.keys(EMBEDDING_MODELS).join(', ')}`
    );
  }

  return modelId;
}

export function resolveEmbeddingModel(
  config: Pick<CodebiteConfig, 'provider' | 'model' | 'apiKey' | 'baseURL'>
): EmbeddingModel {
  if (config.provider === 'vercel') {
    // Use the openai embedding model via the gateway
    process.env.AI_GATEWAY_API_KEY = config.apiKey;
    return `openai/${EMBEDDING_MODELS.vercel}` as unknown as EmbeddingModel;
  }

  const modelId = resolveEmbeddingModelId(config);
  const p = makeProvider(config.provider, config.apiKey, config.baseURL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (p as any).textEmbeddingModel(modelId) as EmbeddingModel;
}
