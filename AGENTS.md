# AGENTS.md

codebite is a **generic codebase analysis tool** run against any repo — Node.js, Python, Go, Rust, Java, anything. It is almost never run against its own source in production. Every change must work for that entire user population, not just for the codebite repo used during development.

## Core rule

Before every fix or improvement, ask:
> *"Does this work against a repo that has nothing to do with codebite, TypeScript, or Node.js?"*

If no — the implementation is wrong, even if it works in the current test environment.

## What this means in practice

**System prompt / agent instructions**
- Rules must be stated as general reasoning steps, not references to codebite-internal paths (`src/tools/index.ts`, `src/provider.ts`). Those paths don't exist in user repos.
- Use ecosystem-agnostic examples: `package.json`, `go.mod`, `Cargo.toml`, `requirements.txt` — not just one.
- When a bug is found by running codebite against itself, identify the *general principle* and fix at that level. Don't patch the specific observed symptom.

**Tool implementations**
- No hardcoded extensions — `.ts`/`.js`-only globs silently miss Python, Go, Rust, etc.
- No assumed project layout — `src/`, `lib/`, `app/`, `pkg/` all vary by ecosystem.
- Return `{ error: "..." }` instead of throwing so the agent can adapt and continue.

**Tests**
- Use synthetic fixture data (temp dirs, in-memory strings), not implicit reliance on the codebite source tree.
- Don't write assertions that only pass because `package.json` or `tsconfig.json` exists at the repo root.

## Before submitting

- [ ] No codebite-internal paths in prompt text or tool logic
- [ ] No ecosystem-specific assumptions (or they are explicitly opt-in)
- [ ] New prompt rules are grounded in general reasoning, not a specific one-off fix
- [ ] `npm test` passes (200 tests, zero failures)
- [ ] `npm run build` passes (zero TypeScript errors)
