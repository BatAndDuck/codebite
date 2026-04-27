import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { compressMessages } from '../../src/utils/context-manager.js';

const VALID_OUTPUT_TYPES = new Set([
  'text',
  'json',
  'error-text',
  'error-json',
  'content',
  'execution-denied',
  'tool-approval-response',
]);

function assertValidToolOutputShape(messages: ModelMessage[]) {
  for (const msg of messages) {
    if (msg.role !== 'tool') continue;
    const parts = Array.isArray(msg.content) ? (msg.content as any[]) : [];
    for (const part of parts) {
      if (part.type !== 'tool-result') continue;
      const out = part.output;
      expect(out, `tool-result.output must be an object`).toBeTypeOf('object');
      expect(out, `tool-result.output must not be null`).not.toBeNull();
      expect(VALID_OUTPUT_TYPES.has(out.type)).toBe(true);
      // text/error-text require a string value; json/error-json require any
      // value but it must be defined; content requires an array.
      if (out.type === 'text' || out.type === 'error-text') {
        expect(typeof out.value).toBe('string');
      } else if (out.type === 'json' || out.type === 'error-json') {
        expect(out.value).toBeDefined();
      } else if (out.type === 'content') {
        expect(Array.isArray(out.value)).toBe(true);
      }
    }
  }
}

function makeReadFileResult(path: string, totalLines: number, wrapper: 'json' | 'text' | 'error-json' | 'none') {
  const payload = {
    path,
    language: 'TypeScript',
    totalLines,
    showing: { from: 1, to: totalLines },
    content: Array.from({ length: totalLines }, (_, i) => `line ${i + 1}`).join('\n'),
  };
  let output: unknown;
  if (wrapper === 'json') output = { type: 'json', value: payload };
  else if (wrapper === 'text') output = { type: 'text', value: 'plain text result' };
  else if (wrapper === 'error-json') output = { type: 'error-json', value: { error: 'failed' } };
  else output = payload; // unwrapped
  return {
    type: 'tool-result',
    toolCallId: `call-${path}`,
    toolName: 'read_file',
    output,
  };
}

function buildOversizedConversation(wrapper: 'json' | 'text' | 'error-json' | 'none'): ModelMessage[] {
  // Build a conversation with many old tool messages so critical pressure
  // and dedupe both engage. Same path repeated to also trigger dedupe.
  const messages: ModelMessage[] = [
    { role: 'system', content: 'sys' } as ModelMessage,
    { role: 'user', content: 'investigate' } as ModelMessage,
  ];
  for (let i = 0; i < 10; i++) {
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: `call-src/foo.ts`,
          toolName: 'read_file',
          input: { path: 'src/foo.ts' },
        },
      ],
    } as ModelMessage);
    messages.push({
      role: 'tool',
      content: [makeReadFileResult('src/foo.ts', 1000, wrapper)],
    } as unknown as ModelMessage);
  }
  return messages;
}

describe('compressMessages — gateway schema compliance', () => {
  it('critical pressure produces gateway-valid tool outputs (json wrapper)', () => {
    const messages = buildOversizedConversation('json');
    const compressed = compressMessages(messages, {
      stepNumber: 10,
      agentNotes: [],
      pressure: 'critical',
    });
    assertValidToolOutputShape(compressed);
  });

  it('critical pressure produces gateway-valid tool outputs (text wrapper — must not propagate object into text.value)', () => {
    const messages = buildOversizedConversation('text');
    const compressed = compressMessages(messages, {
      stepNumber: 10,
      agentNotes: [],
      pressure: 'critical',
    });
    assertValidToolOutputShape(compressed);
  });

  it('critical pressure produces gateway-valid tool outputs (error-json wrapper — unrecognized by unwrapOutput)', () => {
    const messages = buildOversizedConversation('error-json');
    const compressed = compressMessages(messages, {
      stepNumber: 10,
      agentNotes: [],
      pressure: 'critical',
    });
    assertValidToolOutputShape(compressed);
  });

  it('evicted tool results carry a {type:"json", value:{_evicted:true,...}} payload', () => {
    const messages = buildOversizedConversation('json');
    const compressed = compressMessages(messages, {
      stepNumber: 10,
      agentNotes: [],
      pressure: 'critical',
    });
    let foundEvicted = false;
    for (const msg of compressed) {
      if (msg.role !== 'tool') continue;
      const parts = Array.isArray(msg.content) ? (msg.content as any[]) : [];
      for (const p of parts) {
        if (p.type !== 'tool-result') continue;
        if (p.output?.value?._evicted === true) {
          foundEvicted = true;
          expect(p.output.type).toBe('json');
        }
      }
    }
    expect(foundEvicted).toBe(true);
  });

  it('deduped reads also emit a valid json-wrapped output', () => {
    // Two reads of the same path; dedupe should rewrite the older one.
    const messages: ModelMessage[] = [
      { role: 'system', content: 'sys' } as ModelMessage,
      { role: 'user', content: 'investigate' } as ModelMessage,
    ];
    for (let i = 0; i < 8; i++) {
      messages.push({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: `call-${i}`,
            toolName: 'read_file',
            input: { path: 'src/foo.ts' },
          },
        ],
      } as ModelMessage);
      messages.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: `call-${i}`,
            toolName: 'read_file',
            output: makeReadFileResult('src/foo.ts', 1000, 'json').output,
          },
        ],
      } as unknown as ModelMessage);
    }
    const compressed = compressMessages(messages, {
      stepNumber: 8,
      agentNotes: [],
      pressure: 'tight',
    });
    assertValidToolOutputShape(compressed);
  });
});
