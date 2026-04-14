import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dependencyAnalysisTool } from '../../src/tools/dependency-analysis.js';

describe('dependencyAnalysisTool - list-deps', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-deps-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses package.json', async () => {
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { express: '^4.18.0', lodash: '^4.17.0' },
        devDependencies: { typescript: '^5.0.0' },
      })
    );
    const result = await dependencyAnalysisTool.execute!({ action: 'list-deps', path: '.' }, {} as any) as any;
    expect(result['package.json'].dependencies).toContain('express');
    expect(result['package.json'].devDependencies).toContain('typescript');
  });

  it('parses requirements.txt', async () => {
    writeFileSync(join(tempDir, 'requirements.txt'), 'flask==2.3.0\nrequests>=2.28.0\n# comment\n');
    const result = await dependencyAnalysisTool.execute!({ action: 'list-deps', path: '.' }, {} as any) as any;
    expect(result['requirements.txt'].dependencies).toContain('flask==2.3.0');
    expect(result['requirements.txt'].dependencies).not.toContain('# comment');
  });

  it('returns message when no manifests found', async () => {
    const result = await dependencyAnalysisTool.execute!({ action: 'list-deps', path: '.' }, {} as any) as any;
    expect(result.message).toContain('No recognized manifest files found');
  });
});

describe('dependencyAnalysisTool - trace-imports', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-imports-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('extracts ES module imports', async () => {
    writeFileSync(
      join(tempDir, 'app.ts'),
      `import { foo } from 'bar';
import React from 'react';
import { join } from 'node:path';
import './local-file';`
    );
    const result = await dependencyAnalysisTool.execute!({ action: 'trace-imports', path: 'app.ts' }, {} as any) as any;
    expect(result.imports).toContain('bar');
    expect(result.imports).toContain('react');
    expect(result.imports).toContain('node:path');
  });

  it('extracts require() calls', async () => {
    writeFileSync(
      join(tempDir, 'app.js'),
      `const express = require('express');
const path = require('path');`
    );
    const result = await dependencyAnalysisTool.execute!({ action: 'trace-imports', path: 'app.js' }, {} as any) as any;
    expect(result.imports).toContain('express');
    expect(result.imports).toContain('path');
  });

  it('returns error for missing file', async () => {
    const result = await dependencyAnalysisTool.execute!({ action: 'trace-imports', path: 'missing.ts' }, {} as any) as any;
    expect(result.error).toContain('not found');
  });

  it('deduplicates imports', async () => {
    writeFileSync(
      join(tempDir, 'dup.ts'),
      `import { a } from 'lodash';
import { b } from 'lodash';`
    );
    const result = await dependencyAnalysisTool.execute!({ action: 'trace-imports', path: 'dup.ts' }, {} as any) as any;
    const lodashCount = result.imports.filter((i: string) => i === 'lodash').length;
    expect(lodashCount).toBe(1);
  });
});
