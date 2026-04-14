import { describe, it, expect } from 'vitest';
import { runAgent } from '../../src/agent.js';
import { resolveModel } from '../../src/provider.js';
import type { CodebiteConfig } from '../../src/config.js';

const apiKey = process.env.VERCEL_API_KEY;

describe.skipIf(!apiKey)('e2e: codebite ask', () => {
  it('answers "what is this repo?" with a relevant description', async () => {
    const config: CodebiteConfig = {
      provider: 'vercel',
      model: 'openai/gpt-4o-mini',
      apiKey: apiKey!,
      maxSteps: 10,
      deepMode: false,
      tools: {},
    };

    const model = resolveModel(config);
    const answer = await runAgent({
      model,
      question: 'What is this repo?',
      config,
    });

    console.log('\n=== codebite answer ===\n', answer, '\n=======================\n');

    expect(answer).toBeTruthy();
    expect(answer.length).toBeGreaterThan(50);

    // The answer should reference core concepts of the codebite tool
    const lower = answer.toLowerCase();
    const isRelevant =
      lower.includes('codebase') ||
      lower.includes('codebite') ||
      lower.includes('analysis') ||
      lower.includes('cli') ||
      lower.includes('agent') ||
      lower.includes('llm');

    expect(
      isRelevant,
      `Expected the answer to mention codebase analysis concepts, but got:\n${answer}`
    ).toBe(true);
  });
});
