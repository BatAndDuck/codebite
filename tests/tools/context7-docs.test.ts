import { describe, expect, it } from 'vitest';
import { createContext7DocsTool } from '../../src/tools/context7-docs.js';

describe('context7 docs tool', () => {
  it('returns a clear configuration error when context7 is not configured', async () => {
    const tool = createContext7DocsTool();
    const result = await tool.execute!(
      {
        libraryName: 'Vercel AI SDK',
        query: 'How should AI Gateway models be configured?',
      },
      {} as any
    ) as any;

    expect(result.error).toContain('not configured');
    expect(result.error).toContain('tools.context7ApiKey');
  });
});
