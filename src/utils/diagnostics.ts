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

export interface DiagnosticsLogger {
  path: string;
  writeRunStart(payload: Record<string, unknown>): void;
  writeStepStart(payload: Record<string, unknown>): void;
  writeStepFinish(payload: Record<string, unknown>): void;
  writeError(payload: Record<string, unknown>): void;
  writeRunFinish(payload: Record<string, unknown>): void;
}

export function createDiagnosticsLogger(logPath: string): DiagnosticsLogger {
  const resolvedPath = resolve(process.cwd(), logPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  return {
    path: resolvedPath,
    writeRunStart(payload) {
      appendJsonLine(resolvedPath, { type: 'run-start', ...payload });
    },
    writeStepStart(payload) {
      appendJsonLine(resolvedPath, { type: 'step-start', ...payload });
    },
    writeStepFinish(payload) {
      appendJsonLine(resolvedPath, { type: 'step-finish', ...payload });
    },
    writeError(payload) {
      appendJsonLine(resolvedPath, { type: 'error', ...payload });
    },
    writeRunFinish(payload) {
      appendJsonLine(resolvedPath, { type: 'run-finish', ...payload });
    },
  };
}

function appendJsonLine(filePath: string, payload: Record<string, unknown>): void {
  try {
    appendFileSync(filePath, stringifySafe(payload) + '\n', 'utf-8');
  } catch {
    // Diagnostics write failure must never crash the agent — silently swallow.
    // Errors here could be a full disk, a permissions issue, or a bad path.
  }
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
