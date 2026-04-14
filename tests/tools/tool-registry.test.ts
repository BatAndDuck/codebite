import { describe, expect, it } from 'vitest';
import { getAllTools } from '../../src/tools/index.js';
import type { CodebiteConfig } from '../../src/config.js';

const config: CodebiteConfig = {
  provider: 'vercel',
  model: 'openai/gpt-4o-mini',
  apiKey: 'test-key',
  maxSteps: 30,
  deepMode: false,
  tools: {},
};

describe('tool registry', () => {
  it('does not expose docs tools when they are not configured', () => {
    const tools = getAllTools(config);

    expect(tools['context7_docs']).toBeUndefined();
    expect(tools['web_search']).toBeUndefined();
  });

  it('exposes docs tools when they are configured', () => {
    const tools = getAllTools({
      ...config,
      tools: {
        context7ApiKey: 'ctx7-test',
        tavilyApiKey: 'tvly-test',
      },
    });

    expect(tools['context7_docs']).toBeDefined();
    expect(tools['web_search']).toBeDefined();
  });

  it('omits spawn_subagents when no runSubagent is provided (default registry)', () => {
    const tools = getAllTools(config);

    expect(tools['spawn_subagents']).toBeUndefined();
  });

  it('omits spawn_subagents when deepMode is on but no runner is passed', () => {
    const tools = getAllTools({ ...config, deepMode: true });

    expect(tools['spawn_subagents']).toBeUndefined();
  });

  it('exposes spawn_subagents when a runSubagent closure is provided', () => {
    const tools = getAllTools(
      { ...config, deepMode: true },
      undefined,
      async () => 'noop'
    );

    expect(tools['spawn_subagents']).toBeDefined();
  });
});
