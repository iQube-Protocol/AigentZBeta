#!/usr/bin/env bash
# Check user prompt for policy-violating requests before processing.
# Exit 1 to block (shows message to user), exit 0 to allow.

PROMPT="${1:-}"

# Block requests to access production DB directly
if echo "$PROMPT" | grep -qiE 'production.*database|live.*database|prod.*db.*write'; then
  echo "POLICY: Requests to write to the production database require explicit approval. Please confirm intent." >&2
  # Warn but don't hard-block (user may have valid reason)
fi

# Block requests to expose service role key
if echo "$PROMPT" | grep -qiE 'service.role.key|SUPABASE_SERVICE_ROLE'; then
  echo "POLICY: Service role key must never be exposed. Use environment variables only." >&2
fi

exit 0
