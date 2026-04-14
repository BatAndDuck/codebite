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

  it('throws for anthropic (no embedding API)', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-ant' })
    ).toThrow('does not support embeddings');
  });

  it('throws for unknown provider', () => {
    expect(() =>
      resolveEmbeddingModel({ provider: 'unknown', model: 'x', apiKey: 'x' })
    ).toThrow();
  });
});
