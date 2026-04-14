import { describe, it, expect } from 'vitest';
import { resolveModel, resolveEmbeddingModel } from '../src/provider.js';

describe('resolveModel', () => {
  it('returns a language model for openai', () => {
    const model = resolveModel({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for anthropic', () => {
    const model = resolveModel({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-ant-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for google', () => {
    const model = resolveModel({ provider: 'google', model: 'gemini-2.0-flash', apiKey: 'AIza-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for mistral', () => {
    const model = resolveModel({ provider: 'mistral', model: 'mistral-large-latest', apiKey: 'key-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for vercel (openai-compatible gateway)', () => {
    const model = resolveModel({ provider: 'vercel', model: 'gpt-4o-mini', apiKey: 'vck-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for groq', () => {
    const model = resolveModel({ provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'gsk-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for xai', () => {
    const model = resolveModel({ provider: 'xai', model: 'grok-2-1212', apiKey: 'xai-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for cohere', () => {
    const model = resolveModel({ provider: 'cohere', model: 'command-r-plus', apiKey: 'co-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for deepseek', () => {
    const model = resolveModel({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'ds-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for bedrock', () => {
    const model = resolveModel({ provider: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', apiKey: 'placeholder' });
    expect(model).toBeDefined();
  });

  it('returns a language model for azure', () => {
    const model = resolveModel({ provider: 'azure', model: 'gpt-4o', apiKey: 'az-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for togetherai', () => {
    const model = resolveModel({ provider: 'togetherai', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', apiKey: 'tog-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for fireworks', () => {
    const model = resolveModel({ provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', apiKey: 'fw-test' });
    expect(model).toBeDefined();
  });

  it('returns a language model for litellm (custom baseURL)', () => {
    const model = resolveModel({ provider: 'litellm', model: 'gpt-4o', apiKey: 'any', baseURL: 'http://localhost:4000' });
    expect(model).toBeDefined();
  });

  it('returns a language model for litellm (default baseURL)', () => {
    const model = resolveModel({ provider: 'litellm', model: 'ollama/llama3', apiKey: 'none' });
    expect(model).toBeDefined();
  });

  it('throws on unknown provider', () => {
    expect(() =>
      resolveModel({ provider: 'unknown-llm', model: 'some-model', apiKey: 'test' })
    ).toThrow('Unknown provider');
  });
});

describe('resolveEmbeddingModel', () => {
  it('returns embedding model for openai', () => {
    const model = resolveEmbeddingModel({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for vercel (routed via gateway)', () => {
    const model = resolveEmbeddingModel({ provider: 'vercel', model: 'gpt-4o', apiKey: 'vck-test' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for google', () => {
    const model = resolveEmbeddingModel({ provider: 'google', model: 'gemini-2.0-flash', apiKey: 'AIza-test' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for cohere', () => {
    const model = resolveEmbeddingModel({ provider: 'cohere', model: 'command-r-plus', apiKey: 'co-test' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for bedrock', () => {
    const model = resolveEmbeddingModel({ provider: 'bedrock', model: 'any', apiKey: 'placeholder' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for azure', () => {
    const model = resolveEmbeddingModel({ provider: 'azure', model: 'gpt-4o', apiKey: 'az-test' });
    expect(model).toBeDefined();
  });

  it('returns embedding model for litellm', () => {
    const model = resolveEmbeddingModel({ provider: 'litellm', model: 'any', apiKey: 'none' });
    expect(model).toBeDefined();
  });

  it('throws for anthropic (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-ant' })
    ).toThrow('does not support embeddings');
  });

  it('throws for groq (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'groq', model: 'llama3', apiKey: 'gsk-test' })
    ).toThrow('does not support embeddings');
  });

  it('throws for xai (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'xai', model: 'grok-2', apiKey: 'xai-test' })
    ).toThrow('does not support embeddings');
  });

  it('throws for deepseek (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'ds-test' })
    ).toThrow('does not support embeddings');
  });

  it('throws for togetherai (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'togetherai', model: 'llama3', apiKey: 'tog-test' })
    ).toThrow('does not support embeddings');
  });

  it('throws for fireworks (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'fireworks', model: 'llama3', apiKey: 'fw-test' })
    ).toThrow('does not support embeddings');
  });

  it('throws for unknown provider', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'unknown', model: 'x', apiKey: 'x' })
    ).toThrow();
  });
});
