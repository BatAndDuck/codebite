import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const CONFIG_FILENAME = '.codebite.json';

export const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'vercel',
] as const;

export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export const configSchema = z.object({
  provider: z.string().min(1, 'Provider is required (e.g. openai, anthropic, google, mistral, vercel)'),
  model: z.string().min(1, 'Model is required (e.g. gpt-4o, claude-opus-4-5)'),
  apiKey: z.string().min(1, 'API key is required'),
  maxSteps: z.number().int().min(1).max(200).default(30),
  deepMode: z.boolean().default(false),
  tavilyApiKey: z.string().optional(),
});

export type CodebiteConfig = z.infer<typeof configSchema>;

export function getConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, CONFIG_FILENAME);
}

export function loadConfig(cwd: string = process.cwd()): CodebiteConfig {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    throw new Error(`No ${CONFIG_FILENAME} found. Run "codebite init" first.`);
  }

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${CONFIG_FILENAME}`);
  }

  // Backward-compat: if old format has model as "openai/gpt-4o", split it
  if (
    parsed &&
    typeof parsed === 'object' &&
    'model' in parsed &&
    !('provider' in parsed)
  ) {
    const m = (parsed as any).model as string;
    const slash = m.indexOf('/');
    if (slash !== -1) {
      (parsed as any).provider = m.slice(0, slash);
      (parsed as any).model = m.slice(slash + 1);
    }
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n${issues}`);
  }

  return result.data;
}

export function saveConfig(
  config: Partial<CodebiteConfig> & { provider: string; model: string; apiKey: string },
  cwd: string = process.cwd()
): CodebiteConfig {
  const full = configSchema.parse({
    maxSteps: 30,
    deepMode: false,
    ...config,
  });

  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, JSON.stringify(full, null, 2) + '\n', 'utf-8');

  return full;
}
