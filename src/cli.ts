import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { saveConfig, loadConfig } from './config.js';
import { resolveModel } from './provider.js';
import { runAgent, type AgentStepInfo } from './agent.js';
import { buildIndex } from './indexer/index.js';
import {
  appendChatTurn,
  buildHistoryForPrompt,
  createChat,
  getActiveChat,
  listChats,
  restoreChat,
} from './chat.js';
import { join } from 'node:path';
import { readIndexMeta } from './indexer/index.js';

const program = new Command();

program
  .name('codebite')
  .description('Agentic codebase analysis CLI')
  .version('0.1.0');

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
program
  .command('init')
  .description('Initialize codebite configuration for this project')
  .option('--provider <provider>', 'LLM provider (openai, anthropic, google, mistral, vercel, groq, xai, cohere, deepseek, bedrock, azure, togetherai, fireworks, litellm)')
  .option(
    '--model <model>',
    'Model ID — either "gpt-4o" (with --provider) or "openai/gpt-4o" shorthand'
  )
  .requiredOption('--apikey <key>', 'API key for the LLM provider')
  .option('--base-url <url>', 'Custom base URL (required for litellm; optional for azure and openai-compatible endpoints)')
  .option('--tavily-key <key>', 'Tavily API key for web search')
  .option('--context7-key <key>', 'Context7 API key for documentation lookup via MCP')
  .option('--max-steps <n>', 'Maximum agent steps', '30')
  .option('--deep', 'Enable deep mode by default', false)
  .option('--no-subagents', 'Disable subagent spawning in deep mode', false)
  .action(async (opts) => {
    try {
      // Resolve provider + model from flags.
      // Accepts both:
      //   --provider openai --model gpt-4o
      //   --model openai/gpt-4o         (shorthand, auto-splits)
      let provider: string = opts.provider ?? '';
      let model: string = opts.model ?? '';

      if (!provider && !model) {
        console.error(chalk.red('Error:') + ' Provide --provider and --model, or --model as "provider/model-id"');
        process.exit(1);
      }

      if (!provider && model.includes('/')) {
        const slash = model.indexOf('/');
        provider = model.slice(0, slash);
        model = model.slice(slash + 1);
      }

      if (!provider) {
        console.error(chalk.red('Error:') + ' --provider is required (or use --model provider/model-id)');
        process.exit(1);
      }
      if (!model) {
        console.error(chalk.red('Error:') + ' --model is required');
        process.exit(1);
      }

      const config = saveConfig({
        provider,
        model,
        apiKey: opts.apikey,
        ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
        maxSteps: parseInt(opts.maxSteps, 10),
        deepMode: opts.deep,
        disableSubagents: opts.noSubagents ?? false,
        tools: {
          tavilyApiKey: opts.tavilyKey,
          context7ApiKey: opts.context7Key,
        },
      });

      console.log(chalk.green('✓') + ' Configuration saved to .codebite.json');
      console.log(chalk.dim(`  Provider: ${config.provider}`));
      console.log(chalk.dim(`  Model:    ${config.model}`));
      console.log(chalk.dim(`  Steps:    ${config.maxSteps}`));
      console.log(chalk.dim(`  Deep:     ${config.deepMode}`));
      if (config.tools.tavilyApiKey) console.log(chalk.dim('  Search:   enabled'));
      if (config.tools.context7ApiKey) console.log(chalk.dim('  Context7: enabled'));
      console.log(chalk.dim('\nRun "codebite index" to analyze and index your codebase.'));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------
program
  .command('index')
  .description('Analyze codebase files with LLM and build vector index')
  .action(async () => {
    try {
      const config = loadConfig();
      const model = resolveModel(config);
      const spinner = ora('Scanning codebase...').start();

      const stats = await buildIndex(config, model, (status) => {
        spinner.text = status;
      });

      spinner.succeed(
        `Indexed ${stats.filesAnalyzed} files (${stats.chunksStored} chunks) in ${stats.durationMs}ms`
      );
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Step output printer
// ---------------------------------------------------------------------------
function printStep(step: AgentStepInfo): void {
  const stepLabel = chalk.bold.cyan(`[Step ${step.stepNumber}]`);
  const total = step.usage.inputTokens + step.usage.outputTokens;
  const tokenInfo = chalk.dim(
    `tokens: ${step.usage.inputTokens}↑ ${step.usage.outputTokens}↓ (total ${total})`
  );

  if (step.toolCalls.length === 0) {
    console.log(`${stepLabel} ${chalk.dim('(no tool calls — generating response)')} ${tokenInfo}`);
    return;
  }

  console.log(`${stepLabel} ${chalk.yellow(`${step.toolCalls.length} tool call(s)`)} ${tokenInfo}`);

  for (const tc of step.toolCalls) {
    const argSummary = summarizeArgs(tc.toolName, tc.args);
    const resultSummary = summarizeResult(tc.toolName, tc.result);
    console.log(
      `  ${chalk.green('→')} ${chalk.bold(tc.toolName)}${argSummary ? chalk.dim(` (${argSummary})`) : ''}`
    );
    if (resultSummary) {
      console.log(`  ${chalk.dim('←')} ${chalk.dim(resultSummary)}`);
    }
  }
}

function summarizeArgs(toolName: string, args: Record<string, unknown>): string {
  // Show the most meaningful argument for each tool
  const primary: Record<string, string> = {
    read_file: 'path',
    glob_search: 'pattern',
    grep_search: 'pattern',
    directory_tree: 'path',
    list_directory: 'path',
    file_stats: 'path',
    shell_command: 'command',
    dependency_analysis: 'path',
    semantic_search: 'query',
    web_search: 'query',
    context7_docs: 'query',
    read_file_chunk: 'path',
    folder_children: 'path',
  };
  const key = primary[toolName];
  if (key && args[key] !== undefined) {
    const val = String(args[key]);
    return val.length > 60 ? val.slice(0, 57) + '...' : val;
  }
  // Fallback: show first arg
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  const [k, v] = entries[0];
  const val = `${k}=${JSON.stringify(v)}`;
  return val.length > 60 ? val.slice(0, 57) + '...' : val;
}

function summarizeResult(toolName: string, result: unknown): string {
  if (result === undefined || result === null) return '';
  if (typeof result === 'string') {
    const lines = result.split('\n');
    const preview = lines[0].trim();
    const more = lines.length > 1 ? ` (+${lines.length - 1} lines)` : '';
    const truncated = preview.length > 80 ? preview.slice(0, 77) + '...' : preview;
    return truncated + more;
  }
  if (typeof result === 'object') {
    // Arrays: show length
    if (Array.isArray(result)) return `[${result.length} items]`;
    // Objects with common result fields
    const r = result as Record<string, unknown>;
    if (typeof r['matches'] === 'number') return `${r['matches']} matches`;
    if (typeof r['files'] === 'number') return `${r['files']} files`;
    if (typeof r['error'] === 'string') return chalk.red(`error: ${r['error']}`);
    return JSON.stringify(result).slice(0, 80);
  }
  return String(result).slice(0, 80);
}

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------
program
  .command('ask')
  .description('Ask a question about the codebase')
  .argument('<question>', 'Your question about the codebase')
  .option('--deep', 'Enable deep analysis mode')
  .option('--max-steps <n>', 'Override max steps for this query')
  .option(
    '--diagnostics [path]',
    'Write full diagnostics log (context, LLM responses, tool calls, errors) to a JSONL file (default under .codebite/diagnostics/)'
  )
  .action(async (question, opts) => {
    try {
      const config = loadConfig();
      const model = resolveModel(config);
      const maxSteps = opts.maxSteps ? parseInt(opts.maxSteps, 10) : config.maxSteps;
      const deepMode = opts.deep ?? config.deepMode;
      const activeChat = getActiveChat();
      const diagPath = resolveDiagnosticsPath(opts.diagnostics, activeChat?.id);

      warnIfIndexStale();

      console.log(chalk.bold.cyan('codebite') + ' — ' + chalk.dim(question));
      console.log(chalk.dim(`Provider: ${config.provider}  Model: ${config.model}  Max steps: ${maxSteps}${deepMode ? '  [deep mode]' : ''}`));
      if (activeChat) {
        console.log(chalk.dim(`Chat: ${activeChat.name} (${activeChat.messages.length} saved messages)`));
      }
      if (diagPath) {
        console.log(chalk.dim(`Diagnostics: ${diagPath}`));
      }
      console.log(chalk.dim('─'.repeat(60)));

      const answer = await runAgent({
        model,
        question,
        // D: Sliding-window chat history — keeps the last 8 turns verbatim
        // and replaces older turns with a compact summary to bound context growth.
        history: activeChat ? buildHistoryForPrompt(activeChat.messages) : undefined,
        config: { ...config, maxSteps, deepMode },
        activeChatId: activeChat?.id ?? null,
        diagnosticsPath: diagPath,
        onStep: printStep,
      });

      if (activeChat) {
        appendChatTurn(activeChat.id, question, answer);
      }

      console.log(chalk.dim('─'.repeat(60)));
      console.log('\n' + answer);
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// chat management
// ---------------------------------------------------------------------------
program
  .command('new')
  .description('Create a new chat and make it the active conversation')
  .argument('[name]', 'Optional chat name')
  .action((name) => {
    try {
      const chat = createChat(name);
      console.log(chalk.green('✓') + ` Active chat: ${chat.name}`);
      console.log(chalk.dim(`  id: ${chat.id}`));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

program
  .command('restore')
  .alias('resture')
  .description('Restore an existing chat and make it active')
  .argument('<name>', 'Chat name or chat id')
  .action((name) => {
    try {
      const chat = restoreChat(name);
      console.log(chalk.green('✓') + ` Active chat: ${chat.name}`);
      console.log(chalk.dim(`  id: ${chat.id}`));
      console.log(chalk.dim(`  saved messages: ${chat.messages.length}`));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List saved chats for this project')
  .action(() => {
    try {
      const chats = listChats();
      if (chats.length === 0) {
        console.log(chalk.dim('No saved chats.'));
        return;
      }

      for (const chat of chats) {
        const marker = chat.active ? chalk.green('●') : chalk.dim('○');
        const label = chat.active ? chalk.bold(chat.name) : chat.name;
        console.log(
          `${marker} ${label} ${chalk.dim(`(${chat.id})  messages: ${chat.messageCount}  updated: ${chat.updatedAt}`)}`
        );
      }
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

function warnIfIndexStale(): void {
  const meta = readIndexMeta();
  if (!meta) return;

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const age = Date.now() - new Date(meta.createdAt).getTime();
  if (age > TWO_WEEKS_MS) {
    const days = Math.floor(age / (24 * 60 * 60 * 1000));
    console.warn(
      chalk.yellow(`⚠ Warning: Codebase index is ${days} days old. Run "codebite index" to refresh it.`)
    );
  }
}

function resolveDiagnosticsPath(
  option: string | boolean | undefined,
  activeChatId?: string
): string | undefined {
  if (!option) return undefined;
  if (typeof option === 'string') return option;

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .replace('Z', '');
  const fileName = `${activeChatId ?? 'adhoc'}-${timestamp}.jsonl`;
  return join('.codebite', 'diagnostics', fileName);
}

program.parse();
