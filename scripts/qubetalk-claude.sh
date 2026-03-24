#!/usr/bin/env bash
# QubeTalk CLI for Claude Code agents
#
# Primary: direct Supabase REST API with service role key (same as the
#          existing qubetalk-post-runtime-memory.sh — most reliable).
# Fallback: send-qubetalk Edge Function with anon key.
#
# Usage:
#   send:    bash scripts/qubetalk-claude.sh send --thread dev-exec --title "Title" --body "Body"
#   history: bash scripts/qubetalk-claude.sh history [--limit 20]
set -euo pipefail

CHANNEL_ID="metame-runtime-thinclient"
SUPABASE_HOST="bsjhfvctmduxhohtllly.supabase.co"
EDGE_ENDPOINT="https://${SUPABASE_HOST}/functions/v1/send-qubetalk"
FROM_AGENT_ID="${QUBETALK_FROM_AGENT_ID:-claude-code}"
FROM_AGENT_LABEL="${QUBETALK_FROM_AGENT_LABEL:-Claude Code Agent}"

# ── load keys ─────────────────────────────────────────────────────────────────
# Prefer env vars; fall back to .env.local in repo root.
_load_env() {
  local envfile
  for envfile in .env.local .env.local.temp; do
    [[ -f "$envfile" ]] || continue
    if [[ -z "${ANON_KEY:-}" ]]; then
      ANON_KEY="$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$envfile" | head -1 | sed 's/^[^=]*=//')" || true
    fi
    if [[ -z "${SERVICE_KEY:-}" ]]; then
      SERVICE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$envfile" | head -1 | sed 's/^[^=]*=//')" || true
    fi
  done
}

ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
_load_env

usage() {
  cat <<'EOF'
QubeTalk CLI — Claude Code agent interface

Commands:
  send      Post a status message to the channel
  history   Retrieve recent messages

send options:
  --thread    <spec|api-wiring|ui-shell|dev-exec|ops>  (required)
  --title     <short title>                             (required)
  --body      <detailed message body>
  --severity  <info|warn|blocker>                       (default: info)
  --content   <plain-text content override>

history options:
  --limit     <number>                                  (default: 20)

Environment overrides:
  NEXT_PUBLIC_SUPABASE_ANON_KEY   public anon JWT
  SUPABASE_SERVICE_ROLE_KEY       service role JWT (fallback)
  QUBETALK_FROM_AGENT_ID          agent id     (default: claude-code)
  QUBETALK_FROM_AGENT_LABEL       agent label  (default: Claude Code Agent)

Examples:
  bash scripts/qubetalk-claude.sh send \
    --thread dev-exec --title "Session started" \
    --body "Claude Code agent active on branch feat/xyz"

  bash scripts/qubetalk-claude.sh history --limit 10
EOF
}

# ── curl helpers ──────────────────────────────────────────────────────────────
# Try hardcoded CDN IPs first to avoid DNS issues in restricted envs.
_IPS=(104.18.38.10 172.64.149.246)

_curl() {
  local url="$1"; shift
  local ip
  for ip in "${_IPS[@]}"; do
    if curl -sS --connect-timeout 8 \
         --resolve "${SUPABASE_HOST}:443:${ip}" \
         "$@" "$url" >/tmp/qt_out.txt 2>/tmp/qt_err.txt; then
      cat /tmp/qt_out.txt; return 0
    fi
  done
  # direct attempt
  if curl -sS --connect-timeout 10 "$@" "$url" >/tmp/qt_out.txt 2>/tmp/qt_err.txt; then
    cat /tmp/qt_out.txt; return 0
  fi
  return 1
}

_auth_headers() {
  local key="$1"
  echo "-H" "apikey: ${key}" "-H" "Authorization: Bearer ${key}"
}

# ── ID generator ──────────────────────────────────────────────────────────────
_gen_id() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    printf '%08x-%04x-4%03x-%04x-%012x' \
      $((RANDOM*RANDOM)) $((RANDOM&0xFFFF)) $((RANDOM&0xFFF)) \
      $((RANDOM&0x3FFF|0x8000)) $((RANDOM*RANDOM*RANDOM))
  fi
}

# ── send via Edge Function ────────────────────────────────────────────────────
_send_edge() {
  local payload="$1"
  [[ -z "${ANON_KEY:-}" ]] && return 1
  # shellcheck disable=SC2046
  _curl "$EDGE_ENDPOINT" \
    -X POST \
    -H "Content-Type: application/json" \
    $(_auth_headers "$ANON_KEY") \
    -d "$payload"
}

# ── send via direct REST (service role fallback) ──────────────────────────────
_send_rest() {
  local payload="$1"
  [[ -z "${SERVICE_KEY:-}" ]] && return 1
  local url="https://${SUPABASE_HOST}/rest/v1/qubetalk_messages"
  # shellcheck disable=SC2046
  _curl "$url" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    $(_auth_headers "$SERVICE_KEY") \
    -d "$payload"
}

# ── history via Edge Function ─────────────────────────────────────────────────
_history_edge() {
  local limit="$1"
  [[ -z "${ANON_KEY:-}" ]] && return 1
  local payload="{\"action\":\"history\",\"channel_id\":\"${CHANNEL_ID}\",\"limit\":${limit}}"
  # shellcheck disable=SC2046
  _curl "$EDGE_ENDPOINT" \
    -X POST \
    -H "Content-Type: application/json" \
    $(_auth_headers "$ANON_KEY") \
    -d "$payload"
}

# ── history via direct REST ───────────────────────────────────────────────────
_history_rest() {
  local limit="$1"
  [[ -z "${SERVICE_KEY:-}" ]] && return 1
  local url="https://${SUPABASE_HOST}/rest/v1/qubetalk_messages?channel_id=eq.${CHANNEL_ID}&order=created_at.desc&limit=${limit}&select=*"
  # shellcheck disable=SC2046
  _curl "$url" \
    $(_auth_headers "$SERVICE_KEY")
}

# ── subcommands ───────────────────────────────────────────────────────────────

cmd_send() {
  local thread="" title="" body="" severity="info" content=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --thread)   thread="$2";   shift 2 ;;
      --title)    title="$2";    shift 2 ;;
      --body)     body="$2";     shift 2 ;;
      --severity) severity="$2"; shift 2 ;;
      --content)  content="$2";  shift 2 ;;
      -h|--help)  usage; exit 0 ;;
      *) echo "Unknown flag: $1"; usage; exit 1 ;;
    esac
  done

  case "$thread" in
    spec|api-wiring|ui-shell|dev-exec|ops) ;;
    *) echo "Invalid --thread. Must be: spec, api-wiring, ui-shell, dev-exec, ops"; exit 1 ;;
  esac
  [[ -z "$title" ]] && { echo "Missing --title"; exit 1; }
  [[ -z "$content" ]] && content="${body:-$title}"

  local msg_id
  msg_id="$(_gen_id)"

  # Build the full Edge-Function payload shape
  local payload
  payload="$(
    MSG_ID="$msg_id" CHANNEL_ID="$CHANNEL_ID" \
    FROM_ID="$FROM_AGENT_ID" FROM_LABEL="$FROM_AGENT_LABEL" \
    THREAD="$thread" SEVERITY="$severity" TITLE="$title" \
    BODY="${body:-$content}" CONTENT="$content" \
    node -e '
const id = process.env.MSG_ID;
process.stdout.write(JSON.stringify({
  message_id: id,
  channel_id: process.env.CHANNEL_ID,
  content: process.env.CONTENT,
  from_agent: { id: process.env.FROM_ID, label: process.env.FROM_LABEL },
  type: "text",
  metadata: {
    type: "status",
    thread: process.env.THREAD,
    severity: process.env.SEVERITY,
    title: process.env.TITLE,
    body: process.env.BODY,
    acceptance: [],
    refs: { repo: "", paths: [], endpoints: [], env: [] },
    control: { id, supersedes_id: null, depends_on: [], assignee: null, status: "open" },
    attestations: {
      authority: process.env.FROM_ID,
      signature: process.env.FROM_ID + ":" + id
    }
  }
}));
'
  )"

  local result
  if result="$(_send_rest "$payload" 2>/dev/null)"; then
    echo "$result"
  elif result="$(_send_edge "$payload" 2>/dev/null)"; then
    echo "$result"
  else
    echo "QubeTalk: failed to send (edge + rest both failed)" >&2
    [[ -f /tmp/qt_err.txt ]] && cat /tmp/qt_err.txt >&2
    return 1
  fi
}

cmd_history() {
  local limit=20

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit) limit="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown flag: $1"; usage; exit 1 ;;
    esac
  done

  local result
  if result="$(_history_rest "$limit" 2>/dev/null)"; then
    true
  elif result="$(_history_edge "$limit" 2>/dev/null)"; then
    true
  else
    echo "QubeTalk: failed to fetch history" >&2
    [[ -f /tmp/qt_err.txt ]] && cat /tmp/qt_err.txt >&2
    return 1
  fi

  echo "$result" | node -e '
let d = ""; process.stdin.on("data",c=>d+=c);
process.stdin.on("end",()=>{
  try {
    const r = JSON.parse(d);
    const msgs = (r.messages || r);
    const arr = Array.isArray(msgs) ? msgs.slice().reverse() : [];
    arr.forEach(m => {
      const meta = m.metadata || {};
      const ts = m.created_at
        ? new Date(m.created_at).toISOString().replace("T"," ").slice(0,19)
        : "?";
      const agent = (m.from_agent && (m.from_agent.label || m.from_agent.id)) || "unknown";
      const thread = meta.thread ? "["+meta.thread+"] " : "";
      const sev = meta.severity && meta.severity !== "info" ? "("+meta.severity+") " : "";
      const title = meta.title || m.content || "";
      console.log(ts+" "+thread+sev+agent+": "+title);
    });
  } catch { console.log(d); }
});
'
}

# ── dispatch ──────────────────────────────────────────────────────────────────

CMD="${1:-}"
shift || true

case "$CMD" in
  send)    cmd_send "$@" ;;
  history) cmd_history "$@" ;;
  -h|--help|"") usage; exit 0 ;;
  *) echo "Unknown command: $CMD"; usage; exit 1 ;;
esac
