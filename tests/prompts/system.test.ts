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
    expect(prompt).toContain('Full Repository Structure');
  });

  it('does not embed the user question in the system prompt (no duplication)', () => {
    const question = 'Inspect the repo and explain auth flow';
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).not.toContain(question);
    expect(prompt).not.toContain('Initial User Request');
  });

  it('includes documentation workflow guidance when context7 is configured', () => {
    const prompt = buildSystemPrompt(
      {
        ...baseConfig,
        tools: {
          context7ApiKey: 'ctx7-test',
        },
      },
      '├── src/\n└── tests/',
    );

    expect(prompt).toContain('Use docs before concluding');
    expect(prompt).toContain('context7_docs');
    expect(prompt).toContain('Compare both sides');
  });

  it('mentions spawn_subagents guidance when deep mode is active', () => {
    const prompt = buildSystemPrompt(
      { ...baseConfig, deepMode: true },
      '├── src/\n└── tests/',
    );

    expect(prompt).toContain('spawn_subagents');
  });

  it('includes search efficiency and completeness rules', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Merge overlapping searches');
    expect(prompt).toContain('Never stop at the first match for enumeration questions');
    expect(prompt).toContain('Final verification pass for enumeration answers');
    expect(prompt).toContain('Use dependency_analysis early for integration questions');
  });

  it('requires semantic_search alongside grep for integration and concept questions', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Mandatory semantic_search for integration and concept questions');
    expect(prompt).toContain('semantic_search MUST run in step 1 alongside grep_search');
  });

  it('instructs to trace indirect consumers via import patterns', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Trace indirect consumers via imports');
    expect(prompt).toContain('indirect consumer');
    expect(prompt).toContain('trace-imports');
  });

  it('requires batching independent tool calls in a single step', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Batch independent tool calls');
    expect(prompt).toContain('never drip-feed');
    expect(prompt).toContain('Single-tool step is ONLY justified when');
    expect(prompt).toContain('batch them with whatever you\'d do next');
    expect(prompt).toContain('Cost reminder');
  });

  it('instructs to cross-reference dependency_analysis as a completeness check', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    expect(prompt).toContain('Cross-reference dependencies as a completeness check');
    expect(prompt).toContain('every declared dependency relevant to the topic');
    expect(prompt).toContain('investigate why');
  });

  it('does not contain codebite-specific example file paths', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/');

    // The worked example must use generic paths, not codebite's own internal files
    expect(prompt).not.toContain('explain the ask command');
    expect(prompt).not.toContain('src/cli.ts');
    expect(prompt).not.toContain('src/agent.ts');
    expect(prompt).not.toContain('src/tools/index.ts');
    expect(prompt).not.toContain('src/prompts/system.ts');
  });

  it('small tier prompt is substantially shorter than large tier', () => {
    const small = buildSystemPrompt(baseConfig, '├── src/\n└── tests/', 'small');
    const large = buildSystemPrompt(baseConfig, '├── src/\n└── tests/', 'large');

    expect(small.length).toBeLessThan(large.length / 2);
  });

  it('small tier prompt omits project structure', () => {
    const prompt = buildSystemPrompt(baseConfig, '├── src/\n└── tests/', 'small');

    expect(prompt).not.toContain('Full Repository Structure');
    // The structure content itself should not appear
    expect(prompt).not.toContain('├── src/');
  });

  it('small tier still contains core instructions', () => {
    const prompt = buildSystemPrompt(baseConfig, undefined, 'small');

    expect(prompt).toContain('leave_note');
    expect(prompt).toContain('Batch tool calls');
    expect(prompt).toContain('Finish');
  });

  it('includes enumeration completeness reminder in execution prompt', () => {
    const prompt = buildExecutionPrompt('Which files handle authentication?');

    expect(prompt).toContain('Which files handle authentication?');
    expect(prompt).toContain('make sure the list is complete');
    expect(prompt).toContain('cross-reference grep_search');
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

  it('includes enumeration completeness reminder for list-type questions', () => {
    const prompt = buildExecutionPrompt('Find all files that use Redis');

    expect(prompt).toContain('Find all files that use Redis');
    expect(prompt).toContain('make sure the list is complete');
    expect(prompt).toContain('dependency_analysis');
  });
});
