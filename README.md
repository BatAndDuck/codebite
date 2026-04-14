# codebite

An agentic codebase analysis CLI — explore, understand, and analyze any codebase using LLM agents. Think Claude Code or Cursor, but optimized purely for **reading and understanding** code, not writing it.

All LLM calls go through the [Vercel AI SDK](https://sdk.vercel.ai/docs) regardless of provider, giving you a unified, streaming-capable agent runtime.

## Features

- **Multi-provider LLM support** — OpenAI, Anthropic, Google, Mistral, Vercel AI Gateway
- **Smart agentic loop** — agent takes as many steps as needed, uses tools in parallel
- **Deep indexing** — LLM analyzes each file to build a rich semantic index (not raw embeddings)
- **10 built-in tools** — file reading, glob/grep/regex search, directory tree, dependency analysis, git history, semantic search, web search
- **Deep mode** — exhaustive multi-angle exploration for complex questions
- **Context-optimized** — agent summarizes findings, never floods context with raw file contents
- **Technology agnostic** — works with any language and any project structure

## Installation

```bash
# Global install
npm install -g codebite

# Or run without installing
npx codebite <command>
```

**Requirements:** Node.js ≥ 18

## Quick Start

```bash
# 1. Go to any project
cd /path/to/your-project

# 2. Initialize
codebite init --provider openai --model gpt-4o --apikey sk-...

# 3. Index the codebase (optional but recommended for semantic search)
codebite index

# 4. Ask questions
codebite ask "What does this project do and how is it structured?"
```

## Supported Providers

| Provider | `--provider` | Example model |
|----------|-------------|--------------|
| OpenAI | `openai` | `gpt-4o`, `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-opus-4-5`, `claude-haiku-4-5-20251001` |
| Google | `google` | `gemini-2.0-flash` |
| Mistral | `mistral` | `mistral-large-latest` |
| Vercel AI Gateway | `vercel` | any model available in your gateway |

### Vercel AI Gateway

Route all calls through your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) — just set `provider: vercel` and your Vercel API key:

```bash
codebite init --provider vercel --model gpt-4o-mini --apikey vck_your-vercel-key
```

The gateway URL is constructed from two optional environment variables:

```
VERCEL_TEAM_ID=your-team-slug       # defaults to "default"
VERCEL_GATEWAY_NAME=my-gateway      # defaults to "default"
```

Resulting URL: `https://gateway.ai.vercel.sh/v1/{VERCEL_TEAM_ID}/{VERCEL_GATEWAY_NAME}`

Only the API key lives in `.codebite.json`. The team and gateway name stay in your shell environment.

## Configuration

Settings are stored in `.codebite.json` in your project root:

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "apiKey": "sk-...",
  "maxSteps": 30,
  "deepMode": false,
  "tavilyApiKey": "tvly-..."
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | Yes | — | `openai`, `anthropic`, `google`, `mistral`, `vercel` |
| `model` | Yes | — | Model ID for the chosen provider |
| `apiKey` | Yes | — | API key for the provider |
| `maxSteps` | No | `30` | Max agent steps per query (1–200) |
| `deepMode` | No | `false` | Enable deep mode globally |
| `tavilyApiKey` | No | — | [Tavily](https://tavily.com) key for web search |

## CLI Reference

### `codebite init`

```bash
codebite init \
  --provider openai \       # provider name
  --model gpt-4o \          # model ID
  --apikey sk-... \         # LLM API key
  [--tavily-key tvly-...] \ # optional: enable web search
  [--max-steps 50] \        # optional: override default 30
  [--deep]                  # optional: enable deep mode globally
```

**Shorthand** — you can combine provider and model into one flag:

```bash
codebite init --model openai/gpt-4o --apikey sk-...
#                     ^^^^^^ auto-parsed as provider=openai, model=gpt-4o
```

### `codebite index`

Analyzes every source file with the LLM and builds a semantic index in `.codebite/`.

```bash
codebite index
```

How it works:
1. Scans all files (respects `.gitignore`, skips binaries and files >100 KB)
2. LLM analyzes each file → produces purpose, summary, exports, dependencies
3. Stores analysis JSON in `.codebite/index/`
4. Generates embeddings of purpose + summary → stores in `.codebite/vectors.json`

> Add `.codebite/` to your `.gitignore`.

### `codebite ask`

```bash
codebite ask "your question"
codebite ask --deep "exhaustive analysis question"
codebite ask --max-steps 60 "complex question on large codebase"
```

## Example Questions

```bash
codebite ask "What does this project do and how is it structured?"
codebite ask "Where is authentication implemented?"
codebite ask "Find all API endpoints and explain what each one does"
codebite ask "What are the gaps in test coverage?"
codebite ask "Explain how the database connection is managed"
codebite ask "What external dependencies are used and what are they for?"
codebite ask "Are there any obvious security concerns?"

# Deep mode — exhaustive, cross-referenced analysis
codebite ask --deep "Explain the full request lifecycle from HTTP to database"
codebite ask --deep "Find security vulnerabilities in this codebase"
codebite ask --deep "What design patterns are used and are they applied consistently?"
```

## Running Against Any Project

```bash
# Clone any open-source project
git clone https://github.com/expressjs/express /tmp/express
cd /tmp/express

# Initialize
codebite init --provider openai --model gpt-4o --apikey $OPENAI_API_KEY

# Build semantic index (optional)
codebite index

# Ask away
codebite ask "How does Express handle middleware chains?"
codebite ask "How are route parameters extracted?"
codebite ask --deep "Explain the full request-response cycle"
```

### Large Codebases

The agent handles large projects automatically:
- Uses `glob_search` + `grep_search` to narrow scope before reading files
- Reads files in 500-line chunks with offset/limit navigation
- Uses `semantic_search` to jump to relevant files by concept
- Summarizes findings progressively — never holds entire files in context

For very deep analyses on large repos, increase `--max-steps`:

```bash
codebite ask --max-steps 80 "Explain the entire auth system"
```

## Agent Tools

| Tool | What it does |
|------|-------------|
| `read_file` | Read file contents with line numbers, offset and limit |
| `glob_search` | Find files by pattern (`**/*.ts`, `src/**/*.test.js`) |
| `grep_search` | Search file contents by text or regex with surrounding context |
| `directory_tree` | Show project structure (respects `.gitignore`) |
| `list_directory` | List files and folders in a directory |
| `file_stats` | File size, line count, language detection |
| `get_cwd` | Get project root path |
| `shell_command` | Read-only git commands (`git log`, `git blame`, `git diff`, …) |
| `dependency_analysis` | Parse `package.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, … |
| `semantic_search` | Find files by semantic meaning (requires `codebite index`) |
| `web_search` | Search the web for docs and library info (requires Tavily key) |

The agent calls tools in **parallel when independent** — a native feature of the Vercel AI SDK.

## Development

```bash
npm install
npm run build          # tsc → dist/
npm test               # vitest run (131 tests)
npm run test:watch     # watch mode

# Run without building (dev mode)
npx tsx src/cli.ts ask "What is this project?"
```

## Ignoring Files

Both the agent and indexer respect:
- Your project's `.gitignore`
- Always ignored: `node_modules`, `.git`, `.codebite`, `dist`, `build`, `coverage`, `__pycache__`, `target`, `vendor`

## License

MIT
