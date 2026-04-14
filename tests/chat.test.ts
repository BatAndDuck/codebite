import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendChatTurn,
  createChat,
  getActiveChat,
  listChats,
  restoreChat,
} from '../src/chat.js';

describe('chat persistence', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codebite-chat-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a named chat and marks it active', () => {
    const chat = createChat('Architecture Review', tempDir);

    expect(chat.id).toBe('architecture-review');
    expect(chat.name).toBe('Architecture Review');
    expect(chat.customName).toBe(true);
    expect(getActiveChat(tempDir)?.id).toBe(chat.id);
  });

  it('auto-names an unnamed chat from the first user message', () => {
    const chat = createChat(undefined, tempDir);

    expect(chat.name).toBe('Untitled chat');
    expect(chat.customName).toBe(false);

    const updated = appendChatTurn(
      chat.id,
      'Where is authentication implemented and how does token validation flow across the app?',
      'Auth is in src/auth.ts',
      tempDir
    );

    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[0].role).toBe('user');
    expect(updated.messages[1].role).toBe('assistant');
    expect(updated.name).toBe(
      'Where is authentication implemented and how does token validation flow across the app?'
    );
  });

  it('keeps a user-provided name after appending turns', () => {
    const chat = createChat('debug-session', tempDir);

    const updated = appendChatTurn(chat.id, 'Where is auth?', 'Auth is in src/auth.ts', tempDir);

    expect(updated.name).toBe('debug-session');
    expect(updated.customName).toBe(true);
  });

  it('restores a previous chat by name', () => {
    createChat('first-chat', tempDir);
    const second = createChat('second-chat', tempDir);

    const restored = restoreChat('first-chat', tempDir);

    expect(restored.id).toBe('first-chat');
    expect(getActiveChat(tempDir)?.id).toBe('first-chat');
    expect(second.id).toBe('second-chat');
  });

  it('lists chats with the active marker', () => {
    const first = createChat('first-chat', tempDir);
    createChat('second-chat', tempDir);
    restoreChat(first.id, tempDir);

    const chats = listChats(tempDir);
    const firstSummary = chats.find((chat) => chat.id === first.id);

    expect(chats).toHaveLength(2);
    expect(firstSummary?.active).toBe(true);
  });

  it('truncates an auto-generated name to 100 characters', () => {
    const chat = createChat(undefined, tempDir);
    const question =
      'a'.repeat(120) + ' trailing';

    const updated = appendChatTurn(chat.id, question, 'answer', tempDir);

    expect(updated.name).toHaveLength(100);
    expect(updated.name).toBe('a'.repeat(100));
  });
});
