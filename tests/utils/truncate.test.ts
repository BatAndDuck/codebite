import { describe, it, expect } from 'vitest';
import { truncateText, truncateLines } from '../../src/utils/truncate.js';

describe('truncateText', () => {
  it('returns text unchanged when under limit', () => {
    expect(truncateText('hello', 100)).toBe('hello');
  });

  it('truncates long text with indicator', () => {
    const long = 'x'.repeat(200);
    const result = truncateText(long, 100);
    expect(result.length).toBeLessThan(200);
    expect(result).toContain('truncated');
  });

  it('preserves start and end of text', () => {
    const text = 'START' + 'x'.repeat(200) + 'END';
    const result = truncateText(text, 100);
    expect(result.startsWith('START')).toBe(true);
    expect(result.endsWith('END')).toBe(true);
  });

  it('uses default maxChars of 10000', () => {
    const text = 'x'.repeat(9999);
    expect(truncateText(text)).toBe(text);
  });
});

describe('truncateLines', () => {
  const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');

  it('returns all lines when under limit', () => {
    const result = truncateLines(content, 50);
    expect(result.totalLines).toBe(20);
    expect(result.truncated).toBe(false);
  });

  it('truncates at specified limit', () => {
    const result = truncateLines(content, 5);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain('line 1');
    expect(result.text).toContain('line 5');
    expect(result.text).not.toContain('   6 | line 6');
  });

  it('applies offset correctly', () => {
    const result = truncateLines(content, 5, 10);
    expect(result.text).toContain('line 11');
    expect(result.text).not.toContain('   1 | line 1');
  });

  it('adds continuation message when truncated', () => {
    const result = truncateLines(content, 5, 0);
    expect(result.text).toContain('more lines');
    expect(result.text).toContain('offset=5');
  });

  it('prepends line numbers', () => {
    const result = truncateLines('hello\nworld', 10);
    expect(result.text).toContain('   1 | hello');
    expect(result.text).toContain('   2 | world');
  });

  it('reports total lines correctly', () => {
    const result = truncateLines(content, 3);
    expect(result.totalLines).toBe(20);
  });
});
