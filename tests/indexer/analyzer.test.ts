import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'ai' before importing the module under test
vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(() => ({})),
}));

import { analyzeFile } from '../../src/indexer/analyzer.js';
import { generateText } from 'ai';
import type { LanguageModel } from 'ai';

const mockModel = {} as LanguageModel;

describe('analyzeFile', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it('parses a valid JSON response from LLM', async () => {
    const mockAnalysis = {
      purpose: 'Authentication middleware for Express',
      exports: ['authMiddleware', 'validateToken'],
      dependencies: ['jsonwebtoken', 'express'],
      services: ['Auth0'],
      patterns: ['middleware pattern'],
      functions: [{ name: 'authMiddleware', description: 'Validates JWT tokens on incoming requests.' }],
      summary: 'Handles JWT authentication and token validation.',
    };
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(mockAnalysis) } as any);

    const result = await analyzeFile(mockModel, 'src/auth.ts', 'export function authMiddleware() {}', 'TypeScript');
    expect(result.path).toBe('src/auth.ts');
    expect(result.purpose).toBe('Authentication middleware for Express');
    expect(result.exports).toContain('authMiddleware');
    expect(result.services).toContain('Auth0');
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe('authMiddleware');
    expect(result.language).toBe('TypeScript');
    expect(result.linesOfCode).toBe(1);
  });

  it('handles LLM returning markdown-fenced JSON', async () => {
    const analysis = { purpose: 'test', exports: [], dependencies: [], services: [], patterns: [], functions: [], summary: 'test summary' };
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n' + JSON.stringify(analysis) + '\n```',
    } as any);

    const result = await analyzeFile(mockModel, 'test.ts', 'const x = 1;', 'TypeScript');
    expect(result.purpose).toBe('test');
    expect(result.summary).toBe('test summary');
  });

  it('falls back gracefully on invalid JSON', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'This file does authentication stuff.',
    } as any);

    const result = await analyzeFile(mockModel, 'auth.ts', 'const x = 1;', 'TypeScript');
    expect(result.purpose).toBe('Could not analyze file');
    expect(result.summary).toContain('authentication');
    expect(result.services).toEqual([]);
    expect(result.functions).toEqual([]);
  });

  it('truncates very large files before sending to LLM', async () => {
    let capturedPrompt = '';
    vi.mocked(generateText).mockImplementation(async (opts: any) => {
      capturedPrompt = opts.prompt;
      return { text: '{"purpose":"test","exports":[],"dependencies":[],"services":[],"patterns":[],"functions":[],"summary":"test"}' } as any;
    });

    const largeContent = Array.from({ length: 500 }, (_, i) => `const x${i} = ${i};`).join('\n');
    await analyzeFile(mockModel, 'large.ts', largeContent, 'TypeScript');
    expect(capturedPrompt).toContain('omitted');
  });

  it('sets linesOfCode correctly', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"purpose":"p","exports":[],"dependencies":[],"services":[],"patterns":[],"functions":[],"summary":"s"}',
    } as any);

    const content = 'line1\nline2\nline3';
    const result = await analyzeFile(mockModel, 'x.ts', content, 'TypeScript');
    expect(result.linesOfCode).toBe(3);
  });
});
