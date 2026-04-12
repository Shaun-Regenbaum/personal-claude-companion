# Claude Companion

A read-only companion dashboard for [Claude Code](https://claude.ai/code). Browse session history, view tool calls, inspect diffs, and review plans — without leaving your terminal workflow.

This is **not** a replacement for Claude Code. It's a browser-based viewer that reads the data Claude Code already writes to `~/.claude/` and presents it visually.

## Features

- **Session browser** — unified list of all CLI and Desktop sessions, active status, search/filter, resume commands
- **Conversation timeline** — dense log-style view of messages, tool calls, and thinking blocks with expandable details
- **Live updates** — SSE file watching pushes changes within 500ms
- **Diff viewer** — browse Edit/Write tool calls with unified diffs *(in progress)*
- **Plan viewer** — rendered markdown for session plans *(in progress)*
- **Config viewer** — MCP servers, skills, hooks, plugins at a glance *(in progress)*

## Stack

- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Icons**: Lucide
- **No database** — reads directly from `~/.claude/` filesystem

## Quick Start

```bash
bun install
bun --watch server/index.ts &
npx vite --port 3847
```

Open `http://localhost:3847` in your browser.

## Production (Daemon)

Build, deploy, and restart the LaunchAgent daemon in one command:

```bash
bun run deploy
```

This runs `bun run compile` (which does `tsc -b && vite build` then `bun build --compile` to produce a standalone `companion` binary), copies it and the `dist/` assets to `~/.claude/companion/`, and restarts the `com.companion.claude` LaunchAgent.

**Important**: After any code change, you must run `bun run deploy` to compile and deploy the new binary. The running daemon serves from `~/.claude/companion/`, not from this source directory. `npm run build` / `vite build` alone is not sufficient — the daemon runs the compiled Bun binary.

To check status or view logs:

```bash
bun run status
bun run logs
```

## Data Sources

All read-only — the companion never writes to any Claude Code data.

| Source | Path |
|---|---|
| Active sessions | `~/.claude/sessions/*.json` |
| Conversations | `~/.claude/projects/*/*.jsonl` |
| Subagents | `~/.claude/projects/*/[id]/subagents/` |
| History | `~/.claude/history.jsonl` |
| Plans | `~/.claude/plans/*.md` |
| Config | `~/.claude/settings.json` |
