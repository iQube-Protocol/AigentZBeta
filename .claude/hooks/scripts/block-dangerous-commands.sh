#!/usr/bin/env bash
# Block dangerous bash commands before execution.
# Exit 1 to block, exit 0 to allow.

TOOL_INPUT="${1:-}"

# Block production DB migration without explicit flag
if echo "$TOOL_INPUT" | grep -qiE 'supabase.*push|db push|migrate.*prod'; then
  echo "BLOCKED: Direct production DB migration detected. Use Supabase Studio or explicit prod flag." >&2
  exit 1
fi

# Block git push --force to main/dev
if echo "$TOOL_INPUT" | grep -qiE 'git push.*--force.*main|git push.*--force.*dev|git push -f.*main|git push -f.*dev'; then
  echo "BLOCKED: Force push to main/dev is not allowed." >&2
  exit 1
fi

# Block rm -rf on source directories
if echo "$TOOL_INPUT" | grep -qiE 'rm -rf.*(app|components|services|types|supabase)'; then
  echo "BLOCKED: rm -rf on source directories is not allowed." >&2
  exit 1
fi

# Warn on direct curl to live wallet/payment APIs
if echo "$TOOL_INPUT" | grep -qiE 'curl.*(stripe|coinbase|fio.*mainnet|evm.*mainnet)'; then
  echo "WARNING: Direct call to live payment/wallet API detected. Ensure this is intentional." >&2
fi

exit 0
