import { generateText, stepCountIs, type LanguageModel } from 'ai';

export interface FileFunction {
  name: string;
  description: string;
}

export interface FileAnalysis {
  path: string;
  purpose: string;
  exports: string[];
  dependencies: string[];
  services: string[];
  patterns: string[];
  functions: FileFunction[];
  summary: string;
  language: string;
  linesOfCode: number;
}

const ANALYSIS_PROMPT = `Analyze the following source code file and provide a structured JSON response.

File path: {path}
Language: {language}

---
{content}
---

Respond with ONLY a valid JSON object (no markdown fences) with these fields:
- "purpose": A one-sentence description of what this file does
- "exports": Array of exported functions, classes, types, or variables (top-level public API)
- "dependencies": Array of external packages/modules this file imports (not relative imports)
- "services": Array of external services, APIs, or platforms this file integrates with (e.g., "AWS S3", "Azure Notification Hub", "Redis", "Stripe", "SendGrid", "Firebase"). Leave empty if none.
- "patterns": Array of design patterns or architectural patterns used (e.g., "singleton", "middleware", "factory", "observer")
- "functions": Array of objects describing each significant function, method, or class in the file. Each object has "name" (the function/method/class name) and "description" (one sentence describing what it does and its role).
- "summary": A 2-4 sentence detailed summary of the file's functionality, key logic, and how it fits into the project

Be precise and factual. Only describe what is actually in the code.`;

export async function analyzeFile(
  model: LanguageModel,
  filePath: string,
  content: string,
  language: string
): Promise<FileAnalysis> {
  const lines = content.split('\n');
  // Truncate very large files for analysis — first 300 + last 100 lines
  let analysisContent = content;
  if (lines.length > 400) {
    analysisContent =
      lines.slice(0, 300).join('\n') +
      `\n\n... [${lines.length - 400} lines omitted] ...\n\n` +
      lines.slice(-100).join('\n');
  }

  const prompt = ANALYSIS_PROMPT
    .replace('{path}', filePath)
    .replace('{language}', language)
    .replace('{content}', analysisContent);

  const result = await generateText({
    model,
    prompt,
    stopWhen: stepCountIs(1),
  });

  let parsed: any;
  try {
    // Strip markdown fences if present
    let text = result.text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(text);
  } catch {
    // Fallback if LLM returns non-JSON
    parsed = {
      purpose: 'Could not analyze file',
      exports: [],
      dependencies: [],
      services: [],
      patterns: [],
      functions: [],
      summary: result.text.slice(0, 500),
    };
  }

  return {
    path: filePath,
    purpose: parsed.purpose || '',
    exports: parsed.exports || [],
    dependencies: parsed.dependencies || [],
    services: parsed.services || [],
    patterns: parsed.patterns || [],
    functions: Array.isArray(parsed.functions)
      ? parsed.functions.map((f: any) => ({ name: String(f.name ?? ''), description: String(f.description ?? '') }))
      : [],
    summary: parsed.summary || '',
    language,
    linesOfCode: lines.length,
  };
}
