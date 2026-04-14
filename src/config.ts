import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const CONFIG_FILENAME = '.codebite.json';
const LOCAL_CONFIG_FILENAME = '.codebite.local.json';

export const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'vercel',
] as const;

export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

const toolsConfigSchema = z.object({
  tavilyApiKey: z.string().optional(),
  context7ApiKey: z.string().optional(),
});

export const configSchema = z.object({
  provider: z.string().min(1, 'Provider is required (e.g. openai, anthropic, google, mistral, vercel)'),
  model: z.string().min(1, 'Model is required (e.g. gpt-4o, claude-opus-4-5)'),
  apiKey: z.string().min(1, 'API key is required. Set it in .codebite.local.json or CODEBITE_API_KEY env var'),
  maxSteps: z.number().int().min(1).max(200).default(30),
  deepMode: z.boolean().default(false),
  tools: toolsConfigSchema.default({}),
});

export type CodebiteConfig = z.infer<typeof configSchema>;

export function getConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, CONFIG_FILENAME);
}

function parseJsonFile(filePath: string, filename: string): unknown {
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${filename}`);
  }
}

function applyBackwardCompat(parsed: unknown): unknown {
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

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const tools =
      obj['tools'] && typeof obj['tools'] === 'object' && !Array.isArray(obj['tools'])
        ? { ...(obj['tools'] as Record<string, unknown>) }
        : {};

    if (obj['tavilyApiKey'] !== undefined && tools['tavilyApiKey'] === undefined) {
      tools['tavilyApiKey'] = obj['tavilyApiKey'];
    }

    if (obj['context7ApiKey'] !== undefined && tools['context7ApiKey'] === undefined) {
      tools['context7ApiKey'] = obj['context7ApiKey'];
    }

    if (Object.keys(tools).length > 0) {
      obj['tools'] = tools;
    }
  }

  return parsed;
}

function mergeConfigObjects(base: unknown, local: unknown): Record<string, unknown> {
  const baseObj = base && typeof base === 'object' ? (base as Record<string, unknown>) : {};
  const localObj = local && typeof local === 'object' ? (local as Record<string, unknown>) : {};

  const baseTools =
    baseObj['tools'] && typeof baseObj['tools'] === 'object' && !Array.isArray(baseObj['tools'])
      ? (baseObj['tools'] as Record<string, unknown>)
      : {};
  const localTools =
    localObj['tools'] && typeof localObj['tools'] === 'object' && !Array.isArray(localObj['tools'])
      ? (localObj['tools'] as Record<string, unknown>)
      : {};

  return {
    ...baseObj,
    ...localObj,
    tools: {
      ...baseTools,
      ...localTools,
    },
  };
}

export function loadConfig(cwd: string = process.cwd()): CodebiteConfig {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    throw new Error(`No ${CONFIG_FILENAME} found. Run "codebite init" first.`);
  }

  const base = applyBackwardCompat(parseJsonFile(configPath, CONFIG_FILENAME));

  // Merge local override (.codebite.local.json) on top of base config
  const localConfigPath = join(cwd, LOCAL_CONFIG_FILENAME);
  const local = existsSync(localConfigPath)
    ? applyBackwardCompat(parseJsonFile(localConfigPath, LOCAL_CONFIG_FILENAME))
    : {};

  const merged = mergeConfigObjects(base, local);

  // Fall back to CODEBITE_API_KEY environment variable if apiKey is missing
  if (!merged['apiKey'] && process.env.CODEBITE_API_KEY) {
    merged['apiKey'] = process.env.CODEBITE_API_KEY;
  }

  const tools =
    merged['tools'] && typeof merged['tools'] === 'object' && !Array.isArray(merged['tools'])
      ? { ...(merged['tools'] as Record<string, unknown>) }
      : {};

  if (!tools['context7ApiKey'] && process.env.CONTEXT7_API_KEY) {
    tools['context7ApiKey'] = process.env.CONTEXT7_API_KEY;
  }

  merged['tools'] = tools;

  const result = configSchema.safeParse(merged);
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
  const cleanedTools = Object.fromEntries(
    Object.entries(full.tools).filter(([, value]) => value !== undefined)
  );
  const serialized = {
    provider: full.provider,
    model: full.model,
    apiKey: full.apiKey,
    maxSteps: full.maxSteps,
    deepMode: full.deepMode,
    ...(Object.keys(cleanedTools).length > 0 ? { tools: cleanedTools } : {}),
  };
  writeFileSync(configPath, JSON.stringify(serialized, null, 2) + '\n', 'utf-8');

  return full;
}
