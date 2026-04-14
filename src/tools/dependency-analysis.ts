import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export const dependencyAnalysisTool = tool({
  description:
    'Analyze project dependencies. "list-deps" parses manifest files (package.json, requirements.txt, go.mod, Cargo.toml, etc.). "trace-imports" extracts import/require statements from a source file.',
  inputSchema: z.object({
    action: z.enum(['list-deps', 'trace-imports']).describe(
      'list-deps: parse project manifest files. trace-imports: find imports in a source file.'
    ),
    path: z
      .string()
      .optional()
      .default('.')
      .describe('File path (for trace-imports) or project root (for list-deps)'),
  }),
  execute: async ({ action, path: targetPath }) => {
    const cwd = process.cwd();

    if (action === 'list-deps') {
      return listDependencies(resolve(cwd, targetPath));
    } else {
      return traceImports(resolve(cwd, targetPath), cwd);
    }
  },
});

function listDependencies(root: string): Record<string, any> {
  const results: Record<string, any> = {};

  // package.json (Node.js)
  const pkgPath = resolve(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      results['package.json'] = {
        name: pkg.name,
        version: pkg.version,
        dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
        devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
      };
    } catch { /* ignore */ }
  }

  // requirements.txt (Python)
  const reqPath = resolve(root, 'requirements.txt');
  if (existsSync(reqPath)) {
    try {
      const content = readFileSync(reqPath, 'utf-8');
      const deps = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      results['requirements.txt'] = { dependencies: deps };
    } catch { /* ignore */ }
  }

  // go.mod (Go)
  const goModPath = resolve(root, 'go.mod');
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, 'utf-8');
      const moduleMatch = content.match(/^module\s+(.+)$/m);
      const requireMatches = [...content.matchAll(/^\s+(\S+)\s+(\S+)/gm)];
      results['go.mod'] = {
        module: moduleMatch?.[1],
        dependencies: requireMatches.map((m) => `${m[1]}@${m[2]}`),
      };
    } catch { /* ignore */ }
  }

  // Cargo.toml (Rust)
  const cargoPath = resolve(root, 'Cargo.toml');
  if (existsSync(cargoPath)) {
    try {
      const content = readFileSync(cargoPath, 'utf-8');
      const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depsSection) {
        const deps = depsSection[1]
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#') && l.includes('='));
        results['Cargo.toml'] = { dependencies: deps };
      }
    } catch { /* ignore */ }
  }

  // pyproject.toml (Python)
  const pyprojectPath = resolve(root, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    try {
      const content = readFileSync(pyprojectPath, 'utf-8');
      results['pyproject.toml'] = { raw: content.slice(0, 2000) };
    } catch { /* ignore */ }
  }

  if (Object.keys(results).length === 0) {
    return { message: 'No recognized manifest files found.' };
  }

  return results;
}

function traceImports(filePath: string, cwd: string): Record<string, any> {
  const rel = relative(cwd, filePath);

  if (!existsSync(filePath)) {
    return { error: `File not found: ${rel}` };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports: string[] = [];

    // ES imports: import ... from '...'
    const esImports = content.matchAll(
      /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g
    );
    for (const m of esImports) imports.push(m[1]);

    // require: require('...')
    const requires = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const m of requires) imports.push(m[1]);

    // Python: import ... / from ... import
    const pyImports = content.matchAll(
      /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm
    );
    for (const m of pyImports) imports.push(m[1] || m[2]);

    // Go: import "..." or import (...)
    const goImports = content.matchAll(/["']([^"']+)["']/g);
    // Only collect Go imports if the file looks like Go
    if (filePath.endsWith('.go')) {
      for (const m of goImports) {
        if (m[1].includes('/')) imports.push(m[1]);
      }
    }

    // Rust: use ...;
    const rustUse = content.matchAll(/^use\s+([^;]+);/gm);
    for (const m of rustUse) imports.push(m[1].trim());

    const unique = [...new Set(imports)];

    return {
      path: rel,
      imports: unique,
      count: unique.length,
    };
  } catch (err: any) {
    return { error: `Failed to trace imports: ${err.message}` };
  }
}
