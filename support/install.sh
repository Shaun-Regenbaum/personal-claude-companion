#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$HOME/.claude/companion"
LOG_DIR="$HOME/.claude/companion-logs"
PLIST_SRC="$SCRIPT_DIR/com.companion.claude.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.companion.claude.plist"

echo "==> Building Claude Companion..."
cd "$PROJECT_DIR"
bun run compile

echo "==> Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp "$PROJECT_DIR/companion" "$INSTALL_DIR/companion"
chmod +x "$INSTALL_DIR/companion"
# Copy built frontend assets (served from filesystem)
rm -rf "$INSTALL_DIR/dist"
cp -r "$PROJECT_DIR/dist" "$INSTALL_DIR/dist"

echo "==> Setting up log directory..."
mkdir -p "$LOG_DIR"

echo "==> Installing LaunchAgent..."
# Unload existing agent if present
launchctl unload "$PLIST_DST" 2>/dev/null || true

# Generate plist with resolved paths
sed -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    "$PLIST_SRC" > "$PLIST_DST"

# Load the agent
launchctl load "$PLIST_DST"

echo ""
echo "Claude Companion installed and running on http://localhost:${COMPANION_PORT:-3848}"
echo ""
echo "  Status:    launchctl list com.companion.claude"
echo "  Logs:      tail -f ~/.claude/companion-logs/stdout.log"
echo "  Stop:      launchctl unload $PLIST_DST"
echo "  Uninstall: $SCRIPT_DIR/uninstall.sh"
