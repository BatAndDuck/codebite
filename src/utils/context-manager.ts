/**
 * Context Manager — compresses and prunes accumulated messages between agent steps.
 *
 * Hooks into `generateText({ prepareStep })` to return a trimmed view of the
 * conversation before each LLM call. The SDK retains the full history internally;
 * we only affect what the model sees, so no data is permanently lost.
 *
 * What it does each step:
 *   A. Compress old tool results (read_file → signatures+header, grep → matches only)
 *   C. Deduplicate overlapping file reads (subrange covered by a broader read → replaced)
 *   G. Trim assistant reasoning text from old steps (keep tool-call records + [AGENT_NOTE:] text)
 *   Notes: Inject leave_note scratchpad at the top of the conversation
 *
 * Trigger condition: step >= 4 AND (total tool-result bytes > 30 K OR step % 7 === 0)
 * Recency window: last 2 steps are always kept verbatim.
 */

import type { ModelMessage } from 'ai';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Compress when accumulated tool-result chars exceed this (~7.5 K tokens). */
const CHAR_THRESHOLD = 30_000;
/** Also compress every N steps regardless of size (catches slow growth). */
const COMPRESSION_INTERVAL = 7;
/** Keep the most recent N steps verbatim; only compress older ones. */
const RECENCY_WINDOW = 2;
/** Don't start compressing until at least this many steps have run. */
const MIN_STEPS = 4;
/**
 * Minimum line count for a read_file result to be worth compressing.
 * Raised from 60 → 200: at 60 the threshold fired on most source files,
 * causing the model to re-read the same files in chunks after compression
 * stripped their bodies. 200 keeps medium files intact and only compresses
 * genuinely large ones.
 */
const FILE_COMPRESS_MIN_LINES = 200;

// ─── Public types ────────────────────────────────────────────────────────────

export interface CompressionOptions {
  /** Current step number (1-based, from prepareStep's stepNumber param). */
  stepNumber: number;
  /** Notes accumulated via the leave_note tool during this run. */
  agentNotes: string[];
  charThreshold?: number;
  compressionInterval?: number;
  recencyWindow?: number;
  /**
   * Token-budget pressure from the capabilities layer.
   * 'tight'    → lower MIN_STEPS threshold so compression starts sooner.
   * 'critical' → also hard-truncate oldest steps beyond the recency window.
   */
  pressure?: 'ok' | 'tight' | 'critical';
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Returns a compressed copy of `messages` to pass to the LLM for this step.
 * Called from `generateText({ prepareStep })` so the SDK's internal state
 * remains untouched; only the model's view is trimmed.
 */
export function compressMessages(
  messages: ModelMessage[],
  options: CompressionOptions,
): ModelMessage[] {
  const {
    stepNumber,
    agentNotes,
    charThreshold = CHAR_THRESHOLD,
    compressionInterval = COMPRESSION_INTERVAL,
    recencyWindow = RECENCY_WINDOW,
    pressure = 'ok',
  } = options;

  // Under tight/critical pressure compress from step 1 instead of waiting for MIN_STEPS.
  const effectiveMinSteps = pressure === 'ok' ? MIN_STEPS : 1;

  const toolChars = countToolResultChars(messages);
  const shouldCompress =
    stepNumber >= effectiveMinSteps &&
    (toolChars > charThreshold || stepNumber % compressionInterval === 0 || pressure !== 'ok');

  let result: ModelMessage[] = [...messages];

  if (shouldCompress) {
    const compressBeforeStep = stepNumber - recencyWindow; // exclusive upper bound
    const annotated = assignStepIndices(result);

    result = annotated.map(({ msg, stepIndex }) => {
      // Never touch system messages or recent messages
      if (stepIndex === -1 || stepIndex >= compressBeforeStep) return msg;

      if (msg.role === 'tool') return compressToolMessage(msg);
      if (msg.role === 'assistant') return trimAssistantReasoning(msg);
      return msg;
    });

    // C: Remove redundant file reads after compression
    result = dedupeFileReads(result);

    // Under critical pressure, gut old tool-result payloads entirely.
    // We keep the message shells (required by the SDK) but replace content with stubs.
    if (pressure === 'critical') {
      result = criticalCompressOldToolMessages(result, compressBeforeStep);
    }
  }

  // Always inject notes so the model never loses them
  if (agentNotes.length > 0) {
    result = injectAgentNotes(result, agentNotes);
  }

  // Behavioural nudge: if the model has been drip-feeding (3+ consecutive single-tool
  // assistant turns), inject a one-shot reminder so it batches the next round.
  // Fix 5d: skip the nudge on final synthesis steps (no tool calls this turn) and
  // when a spawn_subagents result is still being synthesised — those steps are
  // answer-writing and don't need batching or note reminders.
  if (!needsSynthesis(messages)) {
    const drip = countTrailingSingleToolSteps(messages);
    if (drip >= 3) {
      const stepsSinceNote = countStepsSinceLastNote(messages);
      result = injectBatchingReminder(result, drip, stepsSinceNote);
    }

    // Nudge: solo leave_note step. The system prompt forbids leave_note as a solo
    // step, but countTrailingSingleToolSteps skips lone leave_note turns (Fix 2c) so
    // they never trigger the batching reminder. Fire a separate, targeted nudge instead.
    const lastToolCalls = getLastAssistantToolCalls(messages);
    if (lastToolCalls.length === 1 && lastToolCalls[0].toolName === 'leave_note') {
      result = injectSoloNoteNudge(result);
    }
  }

  // Fix 3a (revised): inject a hard synthesis-lock message whenever spawn_subagents
  // has returned and the model has not yet produced a substantive text answer.
  // This re-fires on every step until synthesis actually happens, preventing the
  // model from escaping the lock by making another tool call.
  if (needsSynthesis(messages)) {
    result = injectSynthesisLock(result);
  }

  return result;
}

/**
 * Returns true if spawn_subagents has been called in this run AND the model has
 * not yet produced a substantive text response since then. "Substantive" = text
 * content with >50 characters (not a tool-use preamble). The lock persists until
 * actual synthesis is written, rather than firing only once immediately after
 * spawn_subagents returns.
 */
function needsSynthesis(messages: ModelMessage[]): boolean {
  let spawnSeen = false;
  for (const m of messages) {
    if (m.role === 'tool' && Array.isArray(m.content)) {
      const parts = m.content as any[];
      if (parts.some((p) => p?.type === 'tool-result' && p?.toolName === 'spawn_subagents')) {
        spawnSeen = true;
      }
    }
    if (spawnSeen && m.role === 'assistant') {
      const parts = Array.isArray(m.content) ? (m.content as any[]) : [];
      const textParts = parts.filter((p) => p.type === 'text');
      const totalText = textParts.reduce((s: number, p: any) => s + (p.text?.length ?? 0), 0);
      if (totalText > 50) {
        spawnSeen = false; // model has synthesised — lock no longer needed
      }
    }
  }
  return spawnSeen;
}

function injectSynthesisLock(messages: ModelMessage[]): ModelMessage[] {
  const text =
    `[SYNTHESIS MODE — subagents have returned their findings above. ` +
    `Your ONLY remaining task is to synthesize those results into one unified answer. ` +
    `Do NOT call any more tools. Do NOT re-investigate what subagents already covered. ` +
    `If their findings are insufficient, note the gap in your answer and explain what ` +
    `additional investigation would require a separate --deep run. ` +
    `Write the final answer now.]`;

  // Insert just before the last user message — same recency-window position as
  // the batching reminder (Fix 2a) so the lock lands in the model's attention.
  let insertPos = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      insertPos = i;
      break;
    }
  }

  const turn: ModelMessage[] = [
    { role: 'user', content: text } as ModelMessage,
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Understood. Synthesizing subagent findings now.' }],
    } as ModelMessage,
  ];
  return [...messages.slice(0, insertPos), ...turn, ...messages.slice(insertPos)];
}

function countTrailingSingleToolSteps(messages: ModelMessage[]): number {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const parts = Array.isArray(m.content) ? (m.content as any[]) : [];
    const toolCalls = parts.filter((p) => p?.type === 'tool-call');
    // Fix 2c: lone leave_note steps are bookkeeping, not exploration drip-feed.
    // Skip them so note-taking is not penalised by the batching reminder.
    if (toolCalls.length === 1 && (toolCalls[0] as any).toolName === 'leave_note') continue;
    if (toolCalls.length === 1) count++;
    else break;
  }
  return count;
}

/**
 * Fix 5c: Number of assistant steps since the most recent leave_note tool result.
 * Returns the total assistant-step count when no leave_note has been called yet.
 * Used to append a note-taking nudge to the batching reminder on long no-note runs.
 */
function countStepsSinceLastNote(messages: ModelMessage[]): number {
  let steps = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') steps++;
    if (m.role === 'tool' && Array.isArray(m.content)) {
      const parts = m.content as any[];
      if (parts.some((p) => p?.type === 'tool-result' && p?.toolName === 'leave_note')) {
        return steps;
      }
    }
  }
  return steps;
}

function injectBatchingReminder(
  messages: ModelMessage[],
  drip: number,
  stepsSinceNote: number,
): ModelMessage[] {
  // Fix 2b: escalate reminder text based on drip length so the model feels
  // increasing urgency across repeat firings rather than identical copy.
  const severity =
    drip >= 6 ? '⛔ HARD STOP — you are drip-feeding' :
    drip >= 3 ? '⚠ BATCHING REQUIRED' :
                'Reminder';
  const tokenEstimate = drip > 5 ? '30k+' : '10–30k';

  let text =
    `[${severity} — ${drip} consecutive single-tool steps. ` +
    `Every extra round-trip re-sends ${tokenEstimate} tokens. ` +
    `Your NEXT step MUST list every tool call you can predict needing now ` +
    `(independent reads, parallel greps, etc.) and emit them ALL in one assistant turn ` +
    `as parallel tool_calls. Only fall back to one call if the next action genuinely ` +
    `depends on what you're about to see.]`;

  // Fix 5c: piggy-back a note-taking nudge onto the batching reminder when
  // the run has been exploring without saving notes. Bundled here (rather than
  // injected separately) to avoid reminder fatigue.
  if (stepsSinceNote >= 5) {
    text +=
      `\n\n[Also: you have not called leave_note in ${stepsSinceNote}+ steps. ` +
      `If you found any file paths, bug locations, or architectural facts, save them now — ` +
      `batch leave_note with your next tool call.]`;
  }

  // Fix 2a: inject just before the most recent user message so the reminder
  // lands in the model's recency window. The previous implementation inserted
  // at firstNonSystem (near the beginning), which got buried once the
  // conversation grew past ~20 messages.
  let insertPos = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      insertPos = i;
      break;
    }
  }

  const reminderTurn: ModelMessage[] = [
    { role: 'user', content: text } as ModelMessage,
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Acknowledged — batching independent calls in the next step.' }],
    } as ModelMessage,
  ];
  return [...messages.slice(0, insertPos), ...reminderTurn, ...messages.slice(insertPos)];
}

/**
 * Returns the tool-call parts from the most recent assistant message, or [] if
 * there is no assistant message or it contains no tool calls.
 */
function getLastAssistantToolCalls(messages: ModelMessage[]): Array<{ toolName: string }> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const parts = Array.isArray(m.content) ? (m.content as any[]) : [];
    return parts.filter((p) => p?.type === 'tool-call');
  }
  return [];
}

function injectSoloNoteNudge(messages: ModelMessage[]): ModelMessage[] {
  const text =
    `[Note: you just used leave_note as a solo step. ` +
    `Always batch leave_note with your next tool call — ` +
    `e.g. leave_note + read_file in one step.]`;

  let insertPos = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      insertPos = i;
      break;
    }
  }

  const nudgeTurn: ModelMessage[] = [
    { role: 'user', content: text } as ModelMessage,
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Understood — batching leave_note with the next tool call.' }],
    } as ModelMessage,
  ];
  return [...messages.slice(0, insertPos), ...nudgeTurn, ...messages.slice(insertPos)];
}

// ─── Step-index assignment ───────────────────────────────────────────────────

interface MsgWithStep {
  msg: ModelMessage;
  /**
   * Which step produced this message:
   *  -1  = system (never compress)
   *   0  = before step 1 (initial user message / history)
   *   1  = step 1 output and its tool results
   *   2  = step 2 …
   */
  stepIndex: number;
}

function assignStepIndices(messages: ModelMessage[]): MsgWithStep[] {
  let step = 0;
  return messages.map((msg) => {
    if (msg.role === 'system') return { msg, stepIndex: -1 };
    const current = step;
    if (msg.role === 'assistant') step++;
    return { msg, stepIndex: current };
  });
}

// ─── Emergency compression for critical budget pressure ──────────────────────

/**
 * When budget pressure is 'critical', replace tool-result payloads from steps
 * older than the recency window with a tiny placeholder.
 * Dropping tool messages entirely would break the SDK's conversation structure
 * (it requires a result for every assistant tool-call). We keep the message
 * shell but gut the content to shed as many tokens as possible.
 */
function criticalCompressOldToolMessages(
  messages: ModelMessage[],
  compressBeforeStep: number,
): ModelMessage[] {
  const annotated = assignStepIndices(messages);
  return annotated.map(({ msg, stepIndex }) => {
    if (msg.role !== 'tool' || stepIndex === -1 || stepIndex >= compressBeforeStep) return msg;

    // Replace each tool-result part with a minimal stub
    const newContent = (msg.content as any[]).map((part) => {
      if (part.type !== 'tool-result') return part;
      const stub = {
        _evicted: true,
        note: `[Result evicted under critical budget pressure. Re-run the tool if needed.]`,
      };
      const { wrapper } = unwrapOutput(part.output);
      return {
        ...part,
        output: wrapper ? { ...wrapper, value: stub } : stub,
      };
    });

    return { ...msg, content: newContent };
  });
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function countToolResultChars(messages: ModelMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.role !== 'tool') continue;
    const parts = Array.isArray(msg.content) ? (msg.content as any[]) : [];
    for (const p of parts) {
      if (p.type === 'tool-result') total += JSON.stringify(p.output ?? '').length;
    }
  }
  return total;
}

// ─── A: Tool-result compression ──────────────────────────────────────────────

function compressToolMessage(msg: ModelMessage): ModelMessage {
  if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;

  const newContent = (msg.content as any[]).map((part) => {
    if (part.type !== 'tool-result') return part;

    // The Vercel AI SDK wraps tool outputs in { type: 'json', value: <actual> }
    // (or { type: 'text', value: string }). Unwrap before compressing, then re-wrap.
    const { rawOutput, wrapper } = unwrapOutput(part.output);

    let compressed = rawOutput;
    if (part.toolName === 'read_file') compressed = compressReadFileOutput(rawOutput);
    else if (part.toolName === 'grep_search') compressed = compressGrepOutput(rawOutput);
    // file_stats, semantic_search, dependency_analysis are already compact — keep as-is

    return { ...part, output: wrapper ? { ...wrapper, value: compressed } : compressed };
  });

  return { ...msg, content: newContent };
}

/**
 * The Vercel AI SDK serialises tool outputs as { type: 'json', value: <payload> }
 * or { type: 'text', value: string }. Unwrap the payload so we can inspect it;
 * return the wrapper shell separately so we can re-wrap after compression.
 */
function unwrapOutput(output: unknown): { rawOutput: unknown; wrapper: Record<string, unknown> | null } {
  if (
    output &&
    typeof output === 'object' &&
    'type' in (output as object) &&
    'value' in (output as object)
  ) {
    const o = output as Record<string, unknown>;
    if (o['type'] === 'json' || o['type'] === 'text') {
      return { rawOutput: o['value'], wrapper: o };
    }
  }
  return { rawOutput: output, wrapper: null };
}

function compressReadFileOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  const o = output as Record<string, unknown>;
  if (o['error'] || !o['content']) return output;

  const rawContent = o['content'] as string;
  const lines = rawContent.split('\n');
  if (lines.length <= FILE_COMPRESS_MIN_LINES) return output; // small enough, keep

  const kept = new Set<number>();

  // Header: first 25 lines (imports, module docstring, top-level consts)
  for (let i = 0; i < Math.min(25, lines.length); i++) kept.add(i);

  // Footer: last 8 lines
  for (let i = Math.max(0, lines.length - 8); i < lines.length; i++) kept.add(i);

  // Signatures: declaration lines across major languages
  const SIG_PATTERNS = [
    // JS/TS
    /^(export\s+)?(default\s+)?(async\s+)?(function|class|abstract\s+class|interface|type|enum)\s+\w/,
    /^(export\s+)?(const|let|var)\s+\w+\s*[=:]/,
    /^\s{0,6}(public|private|protected|static|readonly|override|async)(\s+(public|private|protected|static|readonly|override|async))*\s+\w+\s*[\(<]/,
    // Python
    /^(async\s+)?def\s+\w+\s*[\(:]/, /^class\s+\w+/,
    // Go
    /^func\s+/, /^type\s+\w+\s+struct/, /^type\s+\w+\s+interface/,
    // Rust
    /^(pub\s+)?(async\s+)?fn\s+\w+/, /^(pub\s+)?struct\s+\w+/, /^(pub\s+)?impl\b/,
    // Java / C#
    /^(public|private|protected|internal|static|abstract|override|virtual)(\s+\w+){1,4}\s*[\({]/,
    // Ruby
    /^\s*def\s+\w+/, /^\s*class\s+\w+/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart();
    if (SIG_PATTERNS.some((p) => p.test(t))) kept.add(i);
  }

  // Build output with gap markers
  const sorted = [...kept].sort((a, b) => a - b);
  const out: string[] = [];
  let prev = -1;

  for (const idx of sorted) {
    if (prev !== -1 && idx > prev + 1) {
      out.push(`// ... [${idx - prev - 1} lines omitted] ...`);
    }
    out.push(lines[idx]);
    prev = idx;
  }

  if (prev < lines.length - 1) {
    const tail = lines.length - 1 - prev;
    if (tail > 0) out.push(`// ... [${tail} lines omitted] ...`);
  }

  return {
    ...o,
    content: out.join('\n'),
    _compressed: `Showing ${sorted.length}/${lines.length} lines (signatures + header/footer). Use read_file with offset/limit for a full section.`,
  };
}

function compressGrepOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  const o = output as Record<string, unknown>;
  if (o['error'] || !Array.isArray(o['matches'])) return output;

  // Strip the `context` array (surrounding lines) — keep the matched line itself.
  // Field names in grep_search output are: { file, line (number), content (matched text), context (array) }
  const compressed = (o['matches'] as any[]).map((m) => ({
    file: m.file,
    line: m.line,
    content: m.content,
  }));

  return {
    ...o,
    matches: compressed,
    _compressed: 'Context lines stripped. Use read_file with offset/limit for surrounding code.',
  };
}

// ─── C: Deduplicate overlapping file reads ────────────────────────────────────

function dedupeFileReads(messages: ModelMessage[]): ModelMessage[] {
  interface ReadRecord {
    msgIdx: number;
    partIdx: number;
    fromLine: number; // 0-based inclusive
    toLine: number;   // 0-based exclusive
  }

  // Pass 1: catalogue every read_file result
  const byPath = new Map<string, ReadRecord[]>();

  messages.forEach((msg, mi) => {
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return;
    (msg.content as any[]).forEach((part, pi) => {
      if (part.type !== 'tool-result' || part.toolName !== 'read_file') return;
      // Unwrap SDK envelope if present
      const { rawOutput: o } = unwrapOutput(part.output);
      if (!o || typeof o !== 'object') return;
      const oo = o as Record<string, unknown>;
      if (oo['error'] || oo['_deduped']) return;

      const path: string = ((oo['path'] as string) ?? '').replace(/\\/g, '/');
      const showing = oo['showing'] as Record<string, number> | undefined;
      const from: number = (showing?.['from'] ?? 1) - 1; // convert 1-based → 0-based
      const to: number = showing?.['to'] ?? (oo['totalLines'] as number) ?? from;
      if (!byPath.has(path)) byPath.set(path, []);
      byPath.get(path)!.push({ msgIdx: mi, partIdx: pi, fromLine: from, toLine: to });
    });
  });

  // Pass 2: find redundant reads (covered by a later, broader read)
  const redundant = new Set<string>(); // "msgIdx:partIdx"

  for (const reads of byPath.values()) {
    if (reads.length < 2) continue;
    for (const ri of reads) {
      for (const rj of reads) {
        if (ri === rj) continue;
        // rj is newer and covers ri entirely → ri is redundant
        if (
          rj.msgIdx > ri.msgIdx &&
          rj.fromLine <= ri.fromLine &&
          rj.toLine >= ri.toLine
        ) {
          redundant.add(`${ri.msgIdx}:${ri.partIdx}`);
        }
      }
    }
  }

  if (redundant.size === 0) return messages;

  // Pass 3: replace redundant parts with a slim placeholder
  return messages.map((msg, mi) => {
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;

    const newContent = (msg.content as any[]).map((part, pi) => {
      if (!redundant.has(`${mi}:${pi}`)) return part;
      const { rawOutput, wrapper } = unwrapOutput(part.output);
      const oo = rawOutput && typeof rawOutput === 'object' ? rawOutput as Record<string, unknown> : {};
      const dedupedPayload = {
        _deduped: true,
        path: oo['path'],
        note: `[DEDUPED] ${oo['path']} is fully covered by a later read_file call — removed to save context.`,
      };
      return {
        ...part,
        output: wrapper ? { ...wrapper, value: dedupedPayload } : dedupedPayload,
      };
    });

    return { ...msg, content: newContent };
  });
}

// ─── G: Trim assistant reasoning ─────────────────────────────────────────────

function trimAssistantReasoning(msg: ModelMessage): ModelMessage {
  if (msg.role !== 'assistant') return msg;
  const parts = Array.isArray(msg.content) ? (msg.content as any[]) : null;
  if (!parts) return msg; // string content — leave alone

  const kept = parts.filter((part) => {
    if (part.type === 'tool-call') return true; // always keep (needed for tool-result correlation)
    if (part.type === 'text') {
      // Keep only text that contains an explicit agent note — discard chain-of-thought
      return typeof part.text === 'string' && part.text.includes('[AGENT_NOTE:');
    }
    return true; // reasoning, redacted-reasoning, file parts — keep
  });

  if (kept.length === 0) {
    return { ...msg, content: [{ type: 'text', text: '[reasoning trimmed]' }] };
  }

  return { ...msg, content: kept };
}

// ─── Notes injection ──────────────────────────────────────────────────────────

function injectAgentNotes(messages: ModelMessage[], notes: string[]): ModelMessage[] {
  const text =
    `[AGENT SCRATCHPAD — notes saved via leave_note in earlier steps]\n` +
    notes.map((n, i) => `${i + 1}. ${n}`).join('\n\n');

  // Insert right after any system message(s), before the rest
  const firstNonSystem = messages.findIndex((m) => m.role !== 'system');
  const pos = firstNonSystem === -1 ? messages.length : firstNonSystem;

  const notesTurn: ModelMessage[] = [
    { role: 'user', content: text } as ModelMessage,
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Scratchpad noted. I will reference these facts as needed.' }],
    } as ModelMessage,
  ];

  return [...messages.slice(0, pos), ...notesTurn, ...messages.slice(pos)];
}
