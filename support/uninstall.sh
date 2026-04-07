#!/bin/bash

PLIST_DST="$HOME/Library/LaunchAgents/com.companion.claude.plist"
INSTALL_DIR="$HOME/.claude/companion"

echo "==> Stopping Claude Companion..."
launchctl unload "$PLIST_DST" 2>/dev/null || true

echo "==> Removing LaunchAgent..."
rm -f "$PLIST_DST"

echo "==> Removing installation..."
rm -rf "$INSTALL_DIR"

echo ""
echo "Claude Companion uninstalled."
echo "Logs and data remain at ~/.claude/companion-{logs,summaries}"
echo "To remove those too: rm -rf ~/.claude/companion-{logs,summaries,activity.jsonl,names.json}"
