import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../../src/prompts/system.js';
import { buildExecutionPrompt } from '../../src/prompts/execution.js';
import type { CodebiteConfig } from '../../src/config.js';

const baseConfig: CodebiteConfig = {
  provider: 'vercel',
  model: 'openai/gpt-4o-mini',
  apiKey: 'test-key',
  maxSteps: 30,
  deepMode: false,
  tools: {},
};

describe('buildSystemPrompt', () => {
  it('includes autonomy and fallback guidance', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Finish the task without bouncing it back');
    expect(prompt).toContain('Do not ask optional follow-ups');
    expect(prompt).toContain('Try a fallback path');
    expect(prompt).toContain('Handle every part of multi-part requests');
  });

  it('includes documentation workflow guidance when context7 is configured', () => {
    const prompt = buildSystemPrompt(
      {
        ...baseConfig,
        tools: {
          context7ApiKey: 'ctx7-test',
        },
      },
      '├── src/\n└── tests/'
    );

    expect(prompt).toContain('Use docs before concluding');
    expect(prompt).toContain('context7_docs');
    expect(prompt).toContain('Compare both sides');
  });
});

describe('buildExecutionPrompt', () => {
  it('wraps the user question with completion requirements', () => {
    const prompt = buildExecutionPrompt('Check SDK usage against docs');

    expect(prompt).toContain('Check SDK usage against docs');
    expect(prompt).toContain("Complete the user's request end-to-end");
    expect(prompt).toContain('Do not ask the user whether to continue');
    expect(prompt).toContain('If one tool fails');
  });
});
