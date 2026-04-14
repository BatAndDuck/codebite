import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, saveConfig, configSchema } from '../src/config.js';

describe('configSchema', () => {
  it('validates a correct config', () => {
    const result = configSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test123',
      maxSteps: 30,
      deepMode: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts vercel as provider', () => {
    const result = configSchema.safeParse({
      provider: 'vercel',
      model: 'gpt-4o-mini',
      apiKey: 'vck-test',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty provider', () => {
    const result = configSchema.safeParse({
      provider: '',
      model: 'gpt-4o',
      apiKey: 'sk-test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty model', () => {
    const result = configSchema.safeParse({
      provider: 'openai',
      model: '',
      apiKey: 'sk-test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty apiKey', () => {
    const result = configSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: '',
    });
    expect(result.success).toBe(false);
  });

  it('applies defaults for maxSteps, deepMode, and disableSubagents', () => {
    const result = configSchema.parse({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'sk-ant-test',
    });
    expect(result.maxSteps).toBe(30);
    expect(result.deepMode).toBe(false);
    expect(result.disableSubagents).toBe(false);
    expect(result.tools).toEqual({});
  });

  it('accepts disableSubagents: true', () => {
    const result = configSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      disableSubagents: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.disableSubagents).toBe(true);
  });

  it('accepts optional nested tool config', () => {
    const result = configSchema.parse({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      tools: {
        tavilyApiKey: 'tvly-xxx',
      },
    });
    expect(result.tools.tavilyApiKey).toBe('tvly-xxx');
  });

  it('rejects maxSteps out of range', () => {
    const result = configSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      maxSteps: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-test-'));
  });

  afterEach(() => {
    delete process.env.CODEBITE_API_KEY;
    delete process.env.CONTEXT7_API_KEY;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads a valid config file', () => {
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
        maxSteps: 20,
        deepMode: true,
      })
    );
    const config = loadConfig(tempDir);
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.maxSteps).toBe(20);
    expect(config.deepMode).toBe(true);
  });

  it('backward-compat: splits old "openai/gpt-4o" model format', () => {
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({ model: 'openai/gpt-4o', apiKey: 'sk-test' })
    );
    const config = loadConfig(tempDir);
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('throws when config file is missing', () => {
    expect(() => loadConfig(tempDir)).toThrow('No .codebite.json found');
  });

  it('throws on invalid JSON', () => {
    writeFileSync(join(tempDir, '.codebite.json'), 'not json');
    expect(() => loadConfig(tempDir)).toThrow('Invalid JSON');
  });

  it('throws on invalid config shape', () => {
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({ provider: '', model: 'gpt-4o', apiKey: 'sk-test' })
    );
    expect(() => loadConfig(tempDir)).toThrow('Invalid .codebite.json');
  });

  it('reads CONTEXT7_API_KEY from the environment', () => {
    process.env.CONTEXT7_API_KEY = 'ctx7-test';
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
      })
    );

    const config = loadConfig(tempDir);
    expect(config.tools.context7ApiKey).toBe('ctx7-test');
  });

  it('supports backward-compatible top-level tool keys', () => {
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
        tavilyApiKey: 'tvly-test',
        context7ApiKey: 'ctx7-test',
      })
    );

    const config = loadConfig(tempDir);
    expect(config.tools.tavilyApiKey).toBe('tvly-test');
    expect(config.tools.context7ApiKey).toBe('ctx7-test');
  });

  it('deep-merges nested tool config from local overrides', () => {
    writeFileSync(
      join(tempDir, '.codebite.json'),
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
        tools: {
          tavilyApiKey: 'tvly-base',
        },
      })
    );
    writeFileSync(
      join(tempDir, '.codebite.local.json'),
      JSON.stringify({
        tools: {
          context7ApiKey: 'ctx7-local',
        },
      })
    );

    const config = loadConfig(tempDir);
    expect(config.tools.tavilyApiKey).toBe('tvly-base');
    expect(config.tools.context7ApiKey).toBe('ctx7-local');
  });
});

describe('saveConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves config and returns parsed result', () => {
    const config = saveConfig(
      { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-ant-test' },
      tempDir
    );
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-haiku-4-5');
    expect(config.maxSteps).toBe(30);

    const raw = JSON.parse(readFileSync(join(tempDir, '.codebite.json'), 'utf-8'));
    expect(raw.provider).toBe('anthropic');
    expect(raw.model).toBe('claude-haiku-4-5');
    expect(raw.tools).toBeUndefined();
  });

  it('saves vercel provider', () => {
    const config = saveConfig(
      { provider: 'vercel', model: 'gpt-4o-mini', apiKey: 'vck-test' },
      tempDir
    );
    expect(config.provider).toBe('vercel');
    expect(config.model).toBe('gpt-4o-mini');
  });

  it('saves with custom maxSteps', () => {
    const config = saveConfig(
      { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test', maxSteps: 50 },
      tempDir
    );
    expect(config.maxSteps).toBe(50);
  });

  it('saves nested tool config', () => {
    const config = saveConfig(
      {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test',
        tools: {
          tavilyApiKey: 'tvly-test',
          context7ApiKey: 'ctx7-test',
        },
      },
      tempDir
    );

    expect(config.tools.tavilyApiKey).toBe('tvly-test');
    expect(config.tools.context7ApiKey).toBe('ctx7-test');

    const raw = JSON.parse(readFileSync(join(tempDir, '.codebite.json'), 'utf-8'));
    expect(raw.tools.tavilyApiKey).toBe('tvly-test');
    expect(raw.tools.context7ApiKey).toBe('ctx7-test');
  });
});
