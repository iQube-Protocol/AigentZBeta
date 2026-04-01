#!/usr/bin/env bash
# Post-edit checks: warn on common issues after file writes.
FILE="${1:-}"
[ -z "$FILE" ] && exit 0

# Warn if a NEXT_PUBLIC_ key appears to hold a service role key
if grep -qiE 'NEXT_PUBLIC_.*SERVICE_ROLE|NEXT_PUBLIC_.*SECRET' "$FILE" 2>/dev/null; then
  echo "WARNING: $FILE appears to expose a service-role/secret key via NEXT_PUBLIC_. Move to server-side env only." >&2
fi

# Warn if raw hex colors are used in component files (parity rule)
if echo "$FILE" | grep -qE '\.(tsx|jsx)$'; then
  if grep -qE '#[0-9a-fA-F]{3,6}[^0-9a-fA-F]' "$FILE" 2>/dev/null; then
    echo "PARITY: $FILE contains raw hex colors. Use design system tokens instead." >&2
  fi
fi

exit 0
