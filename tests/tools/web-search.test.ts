import { describe, expect, it } from 'vitest';
import { createWebSearchTool } from '../../src/tools/web-search.js';

describe('web search tool', () => {
  it('returns a clear configuration error when tavily is not configured', async () => {
    const tool = createWebSearchTool();
    const result = await tool.execute!({ query: 'vercel ai sdk docs', maxResults: 3 }, {} as any) as any;

    expect(result.error).toContain('not configured');
    expect(result.error).toContain('tools.tavilyApiKey');
  });
});
