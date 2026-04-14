# codebite

An agentic codebase analysis CLI — explore, understand, and analyze any codebase using LLM agents. Think Claude Code or Cursor, but optimized purely for **reading and understanding** code, not writing it.

All LLM calls go through the [Vercel AI SDK](https://sdk.vercel.ai/docs) regardless of provider, giving you a unified, streaming-capable agent runtime.

## Features

- **Multi-provider LLM support** — OpenAI, Anthropic, Google, Mistral, Vercel AI Gateway
- **Smart agentic loop** — agent takes as many steps as needed, uses tools in parallel
- **Deep indexing** — LLM analyzes each file to extract purpose, per-function summaries, external service integrations, and dependencies — stored in a vector DB for semantic search
- **Built-in analysis tools** — chunked file reads, child-folder inspection, dependency analysis, git history, semantic search, web search, and Context7 docs lookup
- **Persistent chats** — create, restore, and list project-local conversations under `.codebite/`
- **Deep mode** — exhaustive multi-angle exploration for complex questions
- **Parallel subagents** — in deep mode the main agent can spawn up to 5 focused subagents in parallel, each independently investigating a sub-question, and then synthesize their findings
- **Context-optimized** — agent starts with the top-level tree, reads file chunks when needed, and can emit per-step context diagnosis logs
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
codebite init --provider vercel --model openai/gpt-4o-mini --apikey vck_your-key-here

# 3. Or move the API key into local config after init (never committed)
echo '{ "apiKey": "vck_your-key-here" }' > .codebite.local.json

# 4. Index the codebase (optional, but required for semantic search)
codebite index

# 5. Commit the index so your whole team benefits from it
git add .codebite-index/
git commit -m "Add codebase vector index"

# 6. Ask questions
codebite ask "What does this project do and how is it structured?"
codebite ask "Which files integrate with Stripe?"
```

## API Key Management

API keys are **never stored in `.codebite.json`**. Instead, use one of these approaches:

### Local development — `.codebite.local.json`

Create `.codebite.local.json` in your project root (it is gitignored automatically):

```json
{
  "apiKey": "vck_your-api-key-here"
}
```

This file overrides any field in `.codebite.json`, so you can also use it to override other settings locally (e.g. switch models without touching the committed config). It is used by all commands that load config, including `codebite index` and `codebite ask`.

### Environment variable — `CODEBITE_API_KEY`

```bash
CODEBITE_API_KEY=vck_your-key codebite ask "What is this project?"
```

### Priority order

Config is resolved in this order (later values win):

1. `.codebite.json` (committed, no secrets)
2. `.codebite.local.json` (gitignored, local overrides)
3. `CODEBITE_API_KEY` environment variable

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
codebite init --provider vercel --model openai/gpt-4o-mini
echo '{ "apiKey": "vck_your-vercel-key" }' > .codebite.local.json
```

The gateway URL is constructed from two optional environment variables:

```
VERCEL_TEAM_ID=your-team-slug       # defaults to "default"
VERCEL_GATEWAY_NAME=my-gateway      # defaults to "default"
```

Resulting URL: `https://gateway.ai.vercel.sh/v1/{VERCEL_TEAM_ID}/{VERCEL_GATEWAY_NAME}`

## Configuration

Base settings are stored in `.codebite.json` in your project root (commit this, but **omit `apiKey`**):

```json
{
  "provider": "vercel",
  "model": "openai/gpt-4o-mini",
  "maxSteps": 30,
  "deepMode": false
}
```

Local overrides go in `.codebite.local.json` (gitignored):

```json
{
  "apiKey": "vck_your-api-key-here",
  "tools": {
    "tavilyApiKey": "tvly-your-tavily-key",
    "context7ApiKey": "ctx7-your-key"
  }
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | Yes | — | `openai`, `anthropic`, `google`, `mistral`, `vercel` |
| `model` | Yes | — | Model ID for the chosen provider |
| `apiKey` | Yes* | — | API key — use `.codebite.local.json` or `CODEBITE_API_KEY` |
| `maxSteps` | No | `30` | Max agent steps per query (1–200) |
| `deepMode` | No | `false` | Enable deep mode globally |
| `disableSubagents` | No | `false` | Disable subagent spawning in deep mode |
| `tools.tavilyApiKey` | No | — | [Tavily](https://tavily.com) key for web search |
| `tools.context7ApiKey` | No | — | Context7 key for MCP-backed documentation lookup |

*`apiKey` must be provided via `.codebite.local.json` or `CODEBITE_API_KEY` env var. `tools.context7ApiKey` can also come from `CONTEXT7_API_KEY`.

## CLI Reference

### `codebite init`

```bash
codebite init \
  --provider openai \       # provider name
  --model gpt-4o \          # model ID
  [--apikey sk-...] \       # LLM API key (prefer .codebite.local.json instead)
  [--tavily-key tvly-...] \ # optional: enable web search
  [--context7-key ctx7-...] \ # optional: enable Context7 MCP docs lookup
  [--max-steps 50] \        # optional: override default 30
  [--deep]                  # optional: enable deep mode globally
```

**Shorthand** — you can combine provider and model into one flag:

```bash
codebite init --model openai/gpt-4o
#                     ^^^^^^ auto-parsed as provider=openai, model=gpt-4o
```

### `codebite index`

Analyzes every source file with the LLM and builds a vector index at `.codebite-index/`.

```bash
codebite index
```

`codebite index` reads config the same way as `ask`, so putting `apiKey` in `.codebite.local.json` is supported.

**How it works:**

1. Scans all files (respects `.gitignore`, skips binaries and files > 100 KB)
2. LLM analyzes each file and produces a structured analysis:
   - `purpose` — one-sentence description of the file
   - `summary` — 2–4 sentence overview of the file's role in the project
   - `functions` — per-function/method/class descriptions (name + what it does)
   - `services` — external services/APIs integrated (e.g. "AWS S3", "Azure Notification Hub", "Redis", "Stripe")
   - `exports` — top-level public API surface
   - `dependencies` — external packages imported
   - `patterns` — architectural/design patterns used
3. Generates embeddings from the combined analysis text (purpose + summary + services + function descriptions)
4. Stores everything in a [vectra](https://github.com/Stevenic/vectra) `LocalIndex` at `.codebite-index/` alongside a `meta.json` with creation timestamp

**Git storage — commit the index to your repo:**

```bash
git add .codebite-index/
git commit -m "Add codebase vector index"
```

Committing `.codebite-index/` lets your whole team run semantic search without re-indexing. The index is plain JSON, diffs cleanly, and only needs rebuilding when the codebase changes significantly.

**Staleness warning:**

`codebite ask` automatically checks how old the index is. If it is older than **2 weeks**, a warning is printed before each query:

```
⚠ Warning: Codebase index is 18 days old. Run "codebite index" to refresh it.
```

> `.codebite/` (chats, local config) stays gitignored. Only `.codebite-index/` (the vector DB) should be committed.

### `codebite ask`

```bash
codebite ask "your question"
codebite ask --deep "exhaustive analysis question"
codebite ask --max-steps 60 "complex question on large codebase"
codebite ask --context-diagnosis "trace this investigation"
```

If an active chat exists, `ask` continues that conversation automatically and persists the new turn.

Typical flow after creating or restoring a chat:

```bash
# Start or restore a chat first
codebite new "auth-review"
# or: codebite restore "auth-review"

# Normal follow-up turns
codebite ask "Where is authentication implemented?"
codebite ask "Now explain the token validation path"

# Deep-mode follow-up turn in the same chat
codebite ask --deep "Give me an exhaustive auth flow analysis"

# Back to normal mode in the same chat
codebite ask "Summarize the auth risks in 5 bullets"
```

Each `ask` command appends to the currently active chat, so the agent keeps the earlier conversation context. `--deep` changes only that one turn unless deep mode is enabled globally in config.

### `codebite new`

Create a new persistent chat and make it active:

```bash
codebite new
codebite new "auth-review"
```

If you omit the name, the chat starts as `Untitled chat` and is automatically renamed from the first user message, capped at 100 characters. After `codebite new`, start talking with that chat by using `codebite ask ...`. You do not need a separate chat command for each reply.

### `codebite restore`

Restore an existing chat by name or id:

```bash
codebite restore "auth-review"
codebite resture "auth-review"   # typo-compatible alias
```

### `codebite list`

List saved chats for the current project:

```bash
codebite list
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

# Semantic search shines for service/integration queries (requires codebite index)
codebite ask "Which files integrate with Azure Notification Hub?"
codebite ask "Where is Stripe used and what does each integration do?"
codebite ask "Show me everything that touches Redis"
codebite ask "Which modules send emails?"

# Deep mode — exhaustive, cross-referenced analysis
codebite ask --deep "Explain the full request lifecycle from HTTP to database"
codebite ask --deep "Find security vulnerabilities in this codebase"
codebite ask --deep "What design patterns are used and are they applied consistently?"

# Deep mode can delegate independent sub-investigations to parallel subagents
codebite ask --deep "Analyze this codebase from three angles: auth flow, test coverage, and external integrations"
# ^ the main agent may spawn parallel subagents for each angle and synthesize the results
```

## Running Against Any Project

```bash
# Clone any open-source project
git clone https://github.com/expressjs/express /tmp/express
cd /tmp/express

# Initialize (no API key in config)
codebite init --provider vercel --model openai/gpt-4o-mini

# Add your API key locally
echo '{ "apiKey": "vck_your-key" }' > .codebite.local.json

# Build semantic index (optional but recommended)
codebite index

# Commit the index for team-wide semantic search
git add .codebite-index/
git commit -m "Add codebase vector index"

# Ask away
codebite ask "How does Express handle middleware chains?"
codebite ask "How are route parameters extracted?"
codebite ask --deep "Explain the full request-response cycle"
```

### Large Codebases

The agent handles large projects automatically:
- Uses `glob_search` + `grep_search` to narrow scope before reading files
- Starts with the root tree up to 2 levels deep already in context
- Reads files in focused chunks with `read_file_chunk` or `read_file` offset/limit navigation
- Uses `folder_children` for one-level folder inspection without recursive noise
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
| `read_file_chunk` | Read a smaller targeted slice of a file for tighter context control |
| `glob_search` | Find files by pattern (`**/*.ts`, `src/**/*.test.js`) |
| `grep_search` | Search file contents by text or regex with surrounding context |
| `directory_tree` | Show project structure (respects `.gitignore`) |
| `list_directory` | List direct child files and folders in a directory |
| `folder_children` | Alias focused on one-level folder structure only |
| `file_stats` | File size, line count, language detection |
| `get_cwd` | Get project root path |
| `shell_command` | Read-only git commands (`git log`, `git blame`, `git diff`, …) |
| `dependency_analysis` | Parse `package.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, … |
| `semantic_search` | Find files by semantic meaning — matches on purpose, functions, and service integrations (requires `codebite index`) |
| `web_search` | Search the web for docs and library info (requires Tavily key) |
| `context7_docs` | Query up-to-date docs via Context7 MCP (requires Context7 key) |
| `spawn_subagents` | Spawn 1–5 parallel subagents for independent investigations (deep mode only) |

The agent calls tools in **parallel when independent** — a native feature of the Vercel AI SDK.

## Development

```bash
npm install
npm run build          # tsc → dist/
npm test               # vitest run (unit tests only)
npm run test:e2e       # integration tests (requires VERCEL_API_KEY)
npm run test:watch     # watch mode
npm link               # optional: point the global `codebite` command at this checkout

# Run without building (dev mode)
npx tsx src/cli.ts ask "What is this project?"
```

### Local API key for development

Create `.codebite.local.json` in the project root (it is gitignored):

```json
{
  "apiKey": "vck_your-local-key"
}
```

This file is merged on top of `.codebite.json` at runtime. You can also override any other config field here.

### Troubleshooting local config

If `codebite` says `apiKey` is missing even though `.codebite.local.json` exists:

- Confirm you are running the expected binary with `Get-Command codebite` in PowerShell.
- A stale global install can point to an older package version that does not match your local checkout.
- From this repo, `npm link` will repoint the global `codebite` command at the current source tree.
- As a fallback during development, run `node .\\dist\\cli.js <command>` or `npx tsx src/cli.ts <command>` from the repo root.

## CI / CD

### PR checks

Every pull request targeting `main` runs two jobs automatically via GitHub Actions:

- **Unit Tests** — `npm test` (fast, no API key needed)
- **E2E Tests** — `npm run test:e2e` (calls the live LLM; requires `VERCEL_API_KEY` secret)

The E2E test asks `"What is this repo?"` against the actual codebase and asserts the answer contains relevant keywords (`codebase`, `codebite`, `cli`, `agent`, `llm`, or `analysis`).

### Publishing to npm

Push a version tag to trigger automatic publishing:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

The `publish` workflow runs unit tests, builds, then publishes to npm using the `NPM_TOKEN` secret.

### Required GitHub Secrets

| Secret | Used by | Description |
|--------|---------|-------------|
| `NPM_TOKEN` | publish workflow | npm automation token with publish rights |
| `VERCEL_API_KEY` | CI e2e workflow | Vercel AI Gateway key for live LLM calls |

## Ignoring Files

Both the agent and indexer respect:
- Your project's `.gitignore`
- Always ignored (never scanned or shown in directory trees): `node_modules`, `.git`, `.codebite`, `.codebite-index`, `dist`, `build`, `coverage`, `__pycache__`, `target`, `vendor`

`.codebite-index/` is excluded from scanning even though it is committed to git — it is a database artifact, not source code.

## License

MIT
