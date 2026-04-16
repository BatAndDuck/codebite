import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const CODEBITE_DIR = '.codebite';
const CHATS_DIR = 'chats';
const CHAT_STATE_FILE = 'chat-state.json';
const UNTITLED_CHAT_NAME = 'Untitled chat';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
});

const rawChatSessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(chatMessageSchema),
  customName: z.boolean().optional(),
});

const chatStateSchema = z.object({
  activeChatId: z.string().nullable(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof rawChatSessionSchema> & {
  customName: boolean;
};

export interface ChatSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  active: boolean;
}

function ensureCodebiteDir(cwd: string): string {
  const dir = join(cwd, CODEBITE_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureChatsDir(cwd: string): string {
  const dir = join(ensureCodebiteDir(cwd), CHATS_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatStatePath(cwd: string): string {
  return join(ensureCodebiteDir(cwd), CHAT_STATE_FILE);
}

function getChatPath(cwd: string, id: string): string {
  return join(ensureChatsDir(cwd), `${id}.json`);
}

function loadJson<T>(filePath: string, schema: z.ZodType<T>, label: string): T {
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return schema.parse(JSON.parse(raw));
  } catch (err: any) {
    throw new Error(`Invalid ${label}: ${err.message}`);
  }
}

function saveJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function slugifyChatName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function createTimestampId(): string {
  return `chat-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')}`;
}

function loadChatState(cwd: string): z.infer<typeof chatStateSchema> {
  const statePath = getChatStatePath(cwd);
  if (!existsSync(statePath)) {
    return { activeChatId: null };
  }
  const parsed = loadJson(
    statePath,
    chatStateSchema.partial().transform((state) => ({
      activeChatId: state.activeChatId ?? null,
    })),
    CHAT_STATE_FILE
  );
  return chatStateSchema.parse(parsed);
}

function saveChatState(cwd: string, activeChatId: string | null): void {
  saveJson(getChatStatePath(cwd), { activeChatId });
}

function loadChatById(cwd: string, id: string): ChatSession | null {
  const chatPath = getChatPath(cwd, id);
  if (!existsSync(chatPath)) return null;
  const rawChat = loadJson(chatPath, rawChatSessionSchema, `${CHATS_DIR}/${id}.json`);
  return normalizeChatSession(rawChat);
}

function saveChat(cwd: string, chat: ChatSession): void {
  saveJson(
    getChatPath(cwd, chat.id),
    rawChatSessionSchema.parse({
      ...chat,
      customName: chat.customName,
    })
  );
}

function findChat(cwd: string, identifier: string): ChatSession | null {
  const exactById = loadChatById(cwd, identifier);
  if (exactById) return exactById;

  const normalized = identifier.trim().toLowerCase();
  const slug = slugifyChatName(identifier);

  for (const summary of listChats(cwd)) {
    if (summary.id === slug || summary.name.toLowerCase() === normalized) {
      return loadChatById(cwd, summary.id);
    }
  }

  return null;
}

export function createChat(name?: string, cwd: string = process.cwd()): ChatSession {
  const now = new Date().toISOString();
  const normalizedName = name?.trim();
  const id = normalizedName ? slugifyChatName(normalizedName) : createTimestampId();

  if (!id) {
    throw new Error('Chat name must contain at least one letter or number.');
  }

  if (loadChatById(cwd, id)) {
    throw new Error(`Chat "${normalizedName ?? id}" already exists. Use "codebite restore" instead.`);
  }

  const chat: ChatSession = {
    id,
    name: normalizedName ?? UNTITLED_CHAT_NAME,
    createdAt: now,
    updatedAt: now,
    messages: [],
    customName: Boolean(normalizedName),
  };

  saveChat(cwd, chat);
  saveChatState(cwd, chat.id);
  return chat;
}

export function restoreChat(identifier: string, cwd: string = process.cwd()): ChatSession {
  const chat = findChat(cwd, identifier);
  if (!chat) {
    throw new Error(`Chat "${identifier}" not found.`);
  }

  saveChatState(cwd, chat.id);
  return chat;
}

export function listChats(cwd: string = process.cwd()): ChatSummary[] {
  const chatsDir = ensureChatsDir(cwd);
  const state = loadChatState(cwd);

  return readdirSync(chatsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => {
      const rawChat = loadJson(join(chatsDir, entry), rawChatSessionSchema, `${CHATS_DIR}/${entry}`);
      const chat = normalizeChatSession(rawChat);

      return {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
        active: state.activeChatId === chat.id,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveChat(cwd: string = process.cwd()): ChatSession | null {
  const state = loadChatState(cwd);
  if (!state.activeChatId) return null;
  return loadChatById(cwd, state.activeChatId);
}

export function appendChatTurn(
  chatId: string,
  userContent: string,
  assistantContent: string,
  cwd: string = process.cwd()
): ChatSession {
  const chat = loadChatById(cwd, chatId);
  if (!chat) {
    throw new Error(`Active chat "${chatId}" not found.`);
  }

  const now = new Date().toISOString();
  chat.messages.push(
    { role: 'user', content: userContent, timestamp: now },
    { role: 'assistant', content: assistantContent, timestamp: now }
  );
  chat.updatedAt = now;

  if (!chat.customName) {
    chat.name = deriveChatNameFromMessage(firstUserMessage(chat.messages) ?? userContent);
  }

  saveChat(cwd, chat);
  return chat;
}

export function getChatMessages(cwd: string = process.cwd()): ChatMessage[] {
  return getActiveChat(cwd)?.messages ?? [];
}

/**
 * D: Build a history array suitable for the agent prompt.
 *
 * When the chat has more than `maxVerbatimTurns` user-assistant pairs, the
 * oldest ones are replaced by a single compact summary turn so the model still
 * understands the conversation arc without paying for every raw message.
 *
 * The last `maxVerbatimTurns - 1` exchanges are always kept verbatim.
 */
export function buildHistoryForPrompt(
  messages: ChatMessage[],
  maxVerbatimTurns = 8,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (messages.length === 0) return [];

  // Group into user+assistant pairs
  const pairs: Array<{ user: ChatMessage; assistant: ChatMessage }> = [];
  for (let i = 0; i + 1 < messages.length; i += 2) {
    if (messages[i].role === 'user' && messages[i + 1]?.role === 'assistant') {
      pairs.push({ user: messages[i], assistant: messages[i + 1] });
    }
  }

  if (pairs.length <= maxVerbatimTurns) {
    // All turns fit — return them verbatim
    return pairs.flatMap(({ user, assistant }) => [
      { role: 'user' as const, content: user.content },
      { role: 'assistant' as const, content: assistant.content },
    ]);
  }

  // Summarise older turns; keep last (maxVerbatimTurns - 1) verbatim
  const tailCount = maxVerbatimTurns - 1;
  const headPairs = pairs.slice(0, pairs.length - tailCount);
  const tailPairs = pairs.slice(pairs.length - tailCount);

  const topics = headPairs
    .map(({ user }) => user.content.slice(0, 80).replace(/\n/g, ' ').trim())
    .join('; ');

  const summaryContent =
    `[Earlier conversation — ${headPairs.length} exchange(s) omitted to save context. ` +
    `Topics covered: ${topics}]`;

  return [
    { role: 'user' as const, content: summaryContent },
    {
      role: 'assistant' as const,
      content:
        'Understood. I have the context of those earlier exchanges and will continue from where we left off.',
    },
    ...tailPairs.flatMap(({ user, assistant }) => [
      { role: 'user' as const, content: user.content },
      { role: 'assistant' as const, content: assistant.content },
    ]),
  ];
}

function normalizeChatSession(
  chat: z.infer<typeof rawChatSessionSchema>
): ChatSession {
  const customName = chat.customName ?? inferCustomName(chat.id, chat.name);
  const inferredFirstMessage = firstUserMessage(chat.messages);

  return {
    ...chat,
    name: customName
      ? chat.name
      : inferredFirstMessage
        ? deriveChatNameFromMessage(inferredFirstMessage)
        : UNTITLED_CHAT_NAME,
    customName,
  };
}

function inferCustomName(id: string, name: string): boolean {
  if (name === UNTITLED_CHAT_NAME) return false;
  if (name === id && id.startsWith('chat-')) return false;
  return true;
}

function firstUserMessage(messages: ChatMessage[]): string | undefined {
  return messages.find((message) => message.role === 'user')?.content;
}

function deriveChatNameFromMessage(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) return UNTITLED_CHAT_NAME;
  return normalized.length > 100 ? normalized.slice(0, 100).trimEnd() : normalized;
}
