# Claude Companion

## Build & Deploy

This project runs as a macOS LaunchAgent daemon. The build pipeline is:

1. `bun run build` — TypeScript compile + Vite frontend build
2. `bun run compile` — runs build, then `bun build --compile` to produce a standalone `companion` binary
3. `bun run deploy` — runs compile, copies binary + `dist/` to `~/.claude/companion/`, restarts the LaunchAgent

**After any code change, run `bun run deploy`** to see it take effect. The daemon serves from `~/.claude/companion/`, not this source directory.

## Key Paths

- Installed binary: `~/.claude/companion/companion`
- Frontend assets: `~/.claude/companion/dist/`
- LaunchAgent plist: `~/Library/LaunchAgents/com.companion.claude.plist`
- Logs: `~/.claude/companion-logs/{stdout,stderr}.log`

## Architecture

- **Backend**: Hono server in `server/` — read-only access to `~/.claude/` data
- **Frontend**: React SPA in `src/` — built by Vite into `dist/`
- **Runtime**: Bun (compiled to standalone binary for production)
- The companion never writes to Claude Code data
