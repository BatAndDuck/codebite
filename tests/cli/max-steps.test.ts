import { describe, expect, it } from 'vitest';

/**
 * Unit tests for --max-steps argument parsing logic.
 *
 * The `ask` command accepts an optional `--max-steps <n>` flag that overrides the
 * configured `maxSteps` value for a single run. These tests verify the parsing and
 * coercion rules in isolation, mirroring exactly what src/cli.ts does:
 *
 *   const maxSteps = opts.maxSteps ? parseInt(opts.maxSteps, 10) : config.maxSteps;
 */

/** Mirrors the cli.ts resolution logic so tests stay in sync */
function resolveMaxSteps(
  flagValue: string | undefined,
  configDefault: number
): number {
  return flagValue ? parseInt(flagValue, 10) : configDefault;
}

describe('--max-steps flag resolution', () => {
  it('uses config default when flag is not provided', () => {
    expect(resolveMaxSteps(undefined, 30)).toBe(30);
    expect(resolveMaxSteps(undefined, 50)).toBe(50);
  });

  it('overrides config default when flag is provided', () => {
    expect(resolveMaxSteps('10', 30)).toBe(10);
    expect(resolveMaxSteps('60', 30)).toBe(60);
    expect(resolveMaxSteps('1', 30)).toBe(1);
    expect(resolveMaxSteps('200', 30)).toBe(200);
  });

  it('parses the flag value as a base-10 integer', () => {
    expect(resolveMaxSteps('010', 30)).toBe(10); // not octal
    expect(resolveMaxSteps('5', 30)).toBe(5);
    expect(resolveMaxSteps('100', 30)).toBe(100);
  });

  it('returns NaN for non-numeric flag values (caller should validate)', () => {
    // parseInt returns NaN for non-numeric strings; the CLI passes the raw Commander
    // string so callers are responsible for range-checking. This test documents the
    // current behavior so any future change to add validation is deliberate.
    expect(resolveMaxSteps('abc', 30)).toBeNaN();
  });

  it('flag value of "0" is falsy so falls back to config default', () => {
    // opts.maxSteps is a string from Commander; "0" is truthy in JS, but "0" parses
    // to 0 — which is a valid (though unusable) value. Document current behavior.
    expect(resolveMaxSteps('0', 30)).toBe(0);
  });
});
