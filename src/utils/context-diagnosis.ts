import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface StepInputSnapshot {
  stepNumber: number;
  startedAt: string;
  system: unknown;
  messages: unknown[];
  activeTools: string[] | undefined;
  toolChoice: unknown;
}

export interface ContextDiagnosisLogger {
  path: string;
  writeRunStart(payload: Record<string, unknown>): void;
  writeStep(payload: Record<string, unknown>): void;
  writeRunFinish(payload: Record<string, unknown>): void;
}

export function createContextDiagnosisLogger(logPath: string): ContextDiagnosisLogger {
  const resolvedPath = resolve(process.cwd(), logPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  return {
    path: resolvedPath,
    writeRunStart(payload) {
      appendJsonLine(resolvedPath, { type: 'run-start', ...payload });
    },
    writeStep(payload) {
      appendJsonLine(resolvedPath, { type: 'step', ...payload });
    },
    writeRunFinish(payload) {
      appendJsonLine(resolvedPath, { type: 'run-finish', ...payload });
    },
  };
}

function appendJsonLine(filePath: string, payload: Record<string, unknown>): void {
  appendFileSync(filePath, stringifySafe(payload) + '\n', 'utf-8');
}

function stringifySafe(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, current) => {
      if (typeof current === 'bigint') return current.toString();
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
          stack: current.stack,
        };
      }
      if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`;
      return current;
    }
  );
}
