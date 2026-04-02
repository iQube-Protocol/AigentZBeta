#!/usr/bin/env bash
# Write a structured session summary on Stop.
# Posts to QubeTalk if the script is available.

SUMMARY_FILE="/tmp/claude-session-summary-$(date +%s).md"

cat > "$SUMMARY_FILE" <<EOF
# Claude Code Session Summary
Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Branch: $(git -C /home/user/AigentZBeta branch --show-current 2>/dev/null || echo "unknown")

## Changes this session
$(git -C /home/user/AigentZBeta diff --stat HEAD 2>/dev/null | head -20 || echo "No git diff available")

## Unpushed commits
$(git -C /home/user/AigentZBeta log origin/$(git -C /home/user/AigentZBeta branch --show-current 2>/dev/null)..HEAD --oneline 2>/dev/null | head -10 || echo "None")
EOF

# Attempt QubeTalk post (non-fatal if it fails)
if [ -f /home/user/AigentZBeta/scripts/qubetalk-claude.sh ]; then
  bash /home/user/AigentZBeta/scripts/qubetalk-claude.sh send \
    --thread dev-exec \
    --title "Claude Code session complete" \
    --body "$(head -20 "$SUMMARY_FILE")" \
    --severity info 2>/dev/null || true
fi

exit 0
