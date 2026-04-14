import { describe, expect, it, vi } from 'vitest';
import { createSpawnSubagentsTool } from '../../src/tools/spawn-subagents.js';

describe('spawn_subagents tool', () => {
  it('returns all fulfilled results when every subagent succeeds', async () => {
    const runSubagent = vi.fn(async (task: string) => `findings for ${task}`);
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      {
        tasks: [
          { id: 'a', task: 'analyze auth flow' },
          { id: 'b', task: 'check test coverage' },
        ],
      },
      {} as any
    )) as any;

    expect(result.results).toHaveLength(2);
    expect(runSubagent).toHaveBeenCalledTimes(2);
    expect(runSubagent).toHaveBeenCalledWith('analyze auth flow');
    expect(runSubagent).toHaveBeenCalledWith('check test coverage');
    for (const entry of result.results) {
      expect(entry.status).toBe('fulfilled');
      expect(entry.findings).toContain('findings for');
      expect(entry.error).toBe('');
    }
  });

  it('marks failed subagents as rejected while letting successful ones through', async () => {
    const runSubagent = vi.fn(async (task: string) => {
      if (task === 'bad task') {
        throw new Error('boom');
      }
      return `ok: ${task}`;
    });
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      {
        tasks: [
          { id: 'good', task: 'good task' },
          { id: 'bad', task: 'bad task' },
        ],
      },
      {} as any
    )) as any;

    expect(result.results).toHaveLength(2);
    const good = result.results.find((r: any) => r.id === 'good');
    const bad = result.results.find((r: any) => r.id === 'bad');

    expect(good.status).toBe('fulfilled');
    expect(good.findings).toBe('ok: good task');
    expect(good.error).toBe('');

    expect(bad.status).toBe('rejected');
    expect(bad.findings).toBe('');
    expect(bad.error).toContain('boom');
  });

  it('resolves (not throws) when every subagent fails', async () => {
    const runSubagent = vi.fn(async () => {
      throw new Error('all broken');
    });
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      {
        tasks: [
          { id: 'a', task: 'task a' },
          { id: 'b', task: 'task b' },
        ],
      },
      {} as any
    )) as any;

    expect(result.results).toHaveLength(2);
    for (const entry of result.results) {
      expect(entry.status).toBe('rejected');
      expect(entry.findings).toBe('');
      expect(entry.error).toContain('all broken');
    }
  });

  it('handles non-Error rejections by stringifying the reason', async () => {
    const runSubagent = vi.fn(async () => {
      throw 'plain-string-failure';
    });
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      { tasks: [{ id: 'a', task: 'task a' }] },
      {} as any
    )) as any;

    expect(result.results[0].status).toBe('rejected');
    expect(result.results[0].error).toBe('plain-string-failure');
  });

  it('preserves id and task unchanged in the results', async () => {
    const runSubagent = vi.fn(async (task: string) => `findings for ${task}`);
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      {
        tasks: [
          { id: 'auth-flow', task: 'trace the auth flow end to end' },
          { id: 'db-schema', task: 'document the database schema' },
        ],
      },
      {} as any
    )) as any;

    expect(result.results[0].id).toBe('auth-flow');
    expect(result.results[0].task).toBe('trace the auth flow end to end');
    expect(result.results[1].id).toBe('db-schema');
    expect(result.results[1].task).toBe('document the database schema');
  });

  it('rejects an empty tasks array at the schema level', () => {
    const runSubagent = vi.fn();
    const tool = createSpawnSubagentsTool(runSubagent);

    expect(() => (tool as any).inputSchema.parse({ tasks: [] })).toThrow();
  });

  it('rejects more than 5 tasks at the schema level', () => {
    const runSubagent = vi.fn();
    const tool = createSpawnSubagentsTool(runSubagent);

    const tooMany = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      task: `task ${i}`,
    }));

    expect(() => (tool as any).inputSchema.parse({ tasks: tooMany })).toThrow();
  });

  it('returns an object shaped { results: [...] }', async () => {
    const runSubagent = vi.fn(async () => 'ok');
    const tool = createSpawnSubagentsTool(runSubagent);

    const result = (await tool.execute!(
      { tasks: [{ id: 'a', task: 'task a' }] },
      {} as any
    )) as any;

    expect(Object.keys(result)).toEqual(['results']);
    expect(Array.isArray(result.results)).toBe(true);
  });
});
