#!/usr/bin/env bash
set -euo pipefail

CHANNEL_ID="metame-runtime-thinclient"
THREAD=""
TITLE=""
CONTENT=""
CONTENT_FILE=""
FROM_AGENT_ID="${QUBETALK_FROM_AGENT_ID:-windsurf}"
FROM_AGENT_NAME="${QUBETALK_FROM_AGENT_NAME:-Windsurf}"
SEVERITY="${QUBETALK_SEVERITY:-info}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/qubetalk-post-runtime-memory.sh \
    --thread <spec|api-wiring|ui-shell|dev-exec|ops> \
    --title "<message title>" \
    [--content "<text>"] \
    [--content-file <path>] \
    [--channel <channel_id>] \
    [--severity <info|warn|blocker>] \
    [--from-id <agent_id>] \
    [--from-name <agent_name>]

Notes:
  - Default channel is metame-runtime-thinclient.
  - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
  - If missing, SUPABASE values are read from .env.local (key lookup only).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --thread)
      THREAD="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --content)
      CONTENT="$2"
      shift 2
      ;;
    --content-file)
      CONTENT_FILE="$2"
      shift 2
      ;;
    --channel)
      CHANNEL_ID="$2"
      shift 2
      ;;
    --severity)
      SEVERITY="$2"
      shift 2
      ;;
    --from-id)
      FROM_AGENT_ID="$2"
      shift 2
      ;;
    --from-name)
      FROM_AGENT_NAME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  if [[ -f .env.local ]]; then
    if [[ -z "${SUPABASE_URL:-}" ]]; then
      SUPABASE_URL="$(grep '^SUPABASE_URL=' .env.local | head -n 1 | sed 's/^SUPABASE_URL=//')"
    fi
    if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
      NEXT_PUBLIC_SUPABASE_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -n 1 | sed 's/^NEXT_PUBLIC_SUPABASE_URL=//')"
    fi
    if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
      SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -n 1 | sed 's/^SUPABASE_SERVICE_ROLE_KEY=//')"
    fi
  fi
fi

case "$THREAD" in
  spec|api-wiring|ui-shell|dev-exec|ops) ;;
  *)
    echo "Invalid or missing --thread. Must be one of: spec, api-wiring, ui-shell, dev-exec, ops"
    exit 1
    ;;
esac

if [[ -z "$TITLE" ]]; then
  echo "Missing required --title"
  exit 1
fi

if [[ -n "$CONTENT_FILE" ]]; then
  if [[ ! -f "$CONTENT_FILE" ]]; then
    echo "content file not found: $CONTENT_FILE"
    exit 1
  fi
fi

if [[ -z "$CONTENT" && -z "$CONTENT_FILE" ]]; then
  echo "Provide --content or --content-file"
  exit 1
fi

SUPABASE_URL_VALUE="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SUPABASE_KEY_VALUE="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_URL_VALUE" ]]; then
  echo "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)"
  exit 1
fi

if [[ -z "$SUPABASE_KEY_VALUE" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

SUPABASE_HOST="$(echo "$SUPABASE_URL_VALUE" | sed -E 's#https?://([^/]+)/?.*#\1#')"

resolve_supabase_ip() {
  local host="$1"
  local ip=""
  local attempt=1

  while [[ $attempt -le 5 ]]; do
    ip="$(getent hosts "$host" 2>/dev/null | awk '{print $1}' | head -n 1 || true)"
    if [[ -z "$ip" ]]; then
      ip="$(
        nslookup "$host" 2>/dev/null \
          | awk '/Address:/{print $2} /^Address /{print $2}' \
          | sed 's/#.*$//' \
          | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
          | head -n 1 || true
      )"
    fi
    if [[ -z "$ip" ]]; then
      ip="$(
        /bin/zsh -lc "nslookup '$host' 2>/dev/null \
          | awk '/Address:/{print \$2} /^Address /{print \$2}' \
          | sed 's/#.*$//' \
          | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' \
          | head -n 1" 2>/dev/null || true
      )"
    fi
    if [[ -z "$ip" && "$host" == "bsjhfvctmduxhohtllly.supabase.co" ]]; then
      for candidate in 104.18.38.10 172.64.149.246; do
        if curl -sS --connect-timeout 4 --resolve "${host}:443:${candidate}" "https://${host}/rest/v1/" >/dev/null 2>&1; then
          ip="$candidate"
          break
        fi
      done
    fi
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  return 1
}

curl_supabase() {
  local url="$1"
  shift
  local -a candidates=()
  local ip=""

  if [[ -n "${SUPABASE_RESOLVE_IPS:-}" ]]; then
    IFS=',' read -r -a candidates <<<"${SUPABASE_RESOLVE_IPS}"
  elif [[ "$SUPABASE_HOST" == "bsjhfvctmduxhohtllly.supabase.co" ]]; then
    candidates=(104.18.38.10 172.64.149.246)
  else
    if ip="$(resolve_supabase_ip "$SUPABASE_HOST" 2>/dev/null)"; then
      candidates=("$ip")
    fi
  fi

  for ip in "${candidates[@]}"; do
    if [[ "${QUBETALK_DEBUG:-0}" == "1" ]]; then
      echo "Trying --resolve ${SUPABASE_HOST}:443:${ip}" >&2
    fi
    if curl -sS --resolve "${SUPABASE_HOST}:443:${ip}" "$@" "$url" >/tmp/qubetalk_curl_ok.txt 2>/tmp/qubetalk_curl_err.txt; then
      cat /tmp/qubetalk_curl_ok.txt
      return 0
    fi
    if [[ "${QUBETALK_DEBUG:-0}" == "1" && -s /tmp/qubetalk_curl_err.txt ]]; then
      echo "Candidate ${ip} error: $(cat /tmp/qubetalk_curl_err.txt)" >&2
    fi
  done

  if [[ "${QUBETALK_DEBUG:-0}" == "1" ]]; then
    echo "Trying direct curl without --resolve" >&2
  fi
  if curl -sS "$@" "$url" >/tmp/qubetalk_curl_ok.txt 2>/tmp/qubetalk_curl_err.txt; then
    cat /tmp/qubetalk_curl_ok.txt
    return 0
  fi

  echo "QubeTalk REST call failed for ${url}" >&2
  if [[ -s /tmp/qubetalk_curl_err.txt ]]; then
    cat /tmp/qubetalk_curl_err.txt >&2
  fi
  return 1
}

CHANNEL_QUERY_URL="https://${SUPABASE_HOST}/rest/v1/qubetalk_channels?channel_id=eq.${CHANNEL_ID}&select=channel_id,tenant_id,participants&limit=1"
CHANNEL_JSON="$(curl_supabase "$CHANNEL_QUERY_URL" \
  -H "apikey: ${SUPABASE_KEY_VALUE}" \
  -H "Authorization: Bearer ${SUPABASE_KEY_VALUE}")"

CHANNEL_EXISTS="$(printf '%s' "$CHANNEL_JSON" | node -e '
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(input);
    const ok = Array.isArray(parsed) && parsed.length > 0 && parsed[0].channel_id;
    process.stdout.write(ok ? "yes" : "");
  } catch {
    process.stdout.write("");
  }
});
')"

if [[ -z "$CHANNEL_EXISTS" ]]; then
  echo "Channel not found: ${CHANNEL_ID}"
  echo "Raw response: ${CHANNEL_JSON}"
  exit 1
fi

MESSAGE_ID="msg_${THREAD//[^a-zA-Z0-9]/_}_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM"

PAYLOAD_JSON="$(
  MESSAGE_ID="$MESSAGE_ID" \
  CHANNEL_ID="$CHANNEL_ID" \
  FROM_AGENT_ID="$FROM_AGENT_ID" \
  FROM_AGENT_NAME="$FROM_AGENT_NAME" \
  THREAD="$THREAD" \
  SEVERITY="$SEVERITY" \
  TITLE="$TITLE" \
  CONTENT="$CONTENT" \
  CONTENT_FILE="$CONTENT_FILE" \
  node -e '
const fs = require("node:fs");
const id = process.env.MESSAGE_ID || "";
const channel = process.env.CHANNEL_ID || "";
const fromId = process.env.FROM_AGENT_ID || "windsurf";
const fromName = process.env.FROM_AGENT_NAME || "Windsurf";
const thread = process.env.THREAD || "";
const severity = process.env.SEVERITY || "info";
const title = process.env.TITLE || "";
const contentFile = process.env.CONTENT_FILE || "";
let content = process.env.CONTENT || "";
if (contentFile) {
  content = fs.readFileSync(contentFile, "utf8");
}
if (!content) {
  throw new Error("No content provided");
}
const payload = {
  message_id: id,
  channel_id: channel,
  from_agent: {
    id: fromId,
    role: "executor",
    name: fromName
  },
  type: "text",
  content,
  metadata: {
    thread,
    severity,
    title
  }
};
process.stdout.write(JSON.stringify(payload));
'
)"

MESSAGE_INSERT_URL="https://${SUPABASE_HOST}/rest/v1/qubetalk_messages"
INSERT_RESPONSE="$(curl_supabase "$MESSAGE_INSERT_URL" \
  -H "apikey: ${SUPABASE_KEY_VALUE}" \
  -H "Authorization: Bearer ${SUPABASE_KEY_VALUE}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$PAYLOAD_JSON")"

echo "$INSERT_RESPONSE" | node -e '
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(input);
    const row = Array.isArray(parsed) ? parsed[0] : parsed;
    if (row && row.message_id) {
      console.log(JSON.stringify({
        ok: true,
        channel_id: row.channel_id,
        message_id: row.message_id,
        created_at: row.created_at,
        metadata: row.metadata || {}
      }, null, 2));
      return;
    }
  } catch {}
  console.log(JSON.stringify({ ok: false, raw: input }, null, 2));
  process.exitCode = 1;
});
'
