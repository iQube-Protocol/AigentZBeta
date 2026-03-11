#!/usr/bin/env bash
set -euo pipefail

BATCH_SIZE=20
MAX_BATCHES=1
UNTIL_COMPLETE=0
ENV_FILE=".env.local"
BASE_URL="http://127.0.0.1:3000"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch-size|-b)
      BATCH_SIZE="${2:-20}"
      shift 2
      ;;
    --max-batches|-m)
      MAX_BATCHES="${2:-1}"
      shift 2
      ;;
    --all|--until-complete)
      UNTIL_COMPLETE=1
      shift
      ;;
    --env-file|-e)
      ENV_FILE="${2:-.env.local}"
      shift 2
      ;;
    --base-url|-u)
      BASE_URL="${2:-http://127.0.0.1:3000}"
      shift 2
      ;;
    *)
      echo "[KB Reembed] unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

CLI_BATCH_SIZE="$BATCH_SIZE"
CLI_MAX_BATCHES="$MAX_BATCHES"
CLI_UNTIL_COMPLETE="$UNTIL_COMPLETE"
CLI_ENV_FILE="$ENV_FILE"
CLI_BASE_URL="$BASE_URL"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[KB Reembed] fatal: env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE" >/dev/null 2>&1 || true
set +a

export BATCH_SIZE="$CLI_BATCH_SIZE"
export MAX_BATCHES="$CLI_MAX_BATCHES"
export UNTIL_COMPLETE="$CLI_UNTIL_COMPLETE"
export ENV_FILE="$CLI_ENV_FILE"
export BASE_URL="$CLI_BASE_URL"

BASE_URL="${BASE_URL%/}"

json_get() {
  local expr="$1"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const value=(function(){ return ${expr}; })(); if (typeof value === 'object') console.log(JSON.stringify(value)); else console.log(String(value ?? ''));" 2>/dev/null
}

fetch_json() {
  curl -sS --max-time "${2:-90}" "$1"
}

post_json() {
  curl -sS --max-time "${3:-300}" -X POST "$1" -H "Content-Type: application/json" --data-binary "$2"
}

STATUS_JSON="$(fetch_json "$BASE_URL/api/codex/kb/embeddings" 90)"

AVAILABLE="$(printf '%s' "$STATUS_JSON" | json_get "data.available")"
PROVIDER="$(printf '%s' "$STATUS_JSON" | json_get "data.provider?.provider")"
MODEL="$(printf '%s' "$STATUS_JSON" | json_get "data.provider?.model")"
DIMENSIONS="$(printf '%s' "$STATUS_JSON" | json_get "data.provider?.dimensions")"
TOTAL="$(printf '%s' "$STATUS_JSON" | json_get "data.stats.totalChunks")"
EMBEDDED="$(printf '%s' "$STATUS_JSON" | json_get "data.stats.embeddedChunks")"
PENDING="$(printf '%s' "$STATUS_JSON" | json_get "data.stats.pendingChunks")"

echo "[KB Reembed] env=$ENV_FILE"
echo "[KB Reembed] baseUrl=$BASE_URL"
echo "[KB Reembed] provider=$PROVIDER model=$MODEL dimensions=$DIMENSIONS"
echo "[KB Reembed] before total=$TOTAL embedded=$EMBEDDED pending=$PENDING"

if [[ "$AVAILABLE" != "true" ]]; then
  echo "[KB Reembed] fatal: no embedding provider configured" >&2
  exit 1
fi

PROCESSED_TOTAL=0
FAILED_TOTAL=0
BATCH_COUNT=0

while true; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  BATCH_JSON="$(post_json "$BASE_URL/api/codex/kb/embeddings" "{\"batchSize\":$BATCH_SIZE}" 300)"

  if printf '%s' "$BATCH_JSON" | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); process.exit(data.error ? 0 : 1);"; then
    ERROR_MSG="$(printf '%s' "$BATCH_JSON" | json_get "data.error")"
    echo "[KB Reembed] fatal: $ERROR_MSG" >&2
    exit 1
  fi

  BATCH_PROCESSED="$(printf '%s' "$BATCH_JSON" | json_get "data.processed")"
  BATCH_FAILED="$(printf '%s' "$BATCH_JSON" | json_get "data.failed")"
  ERROR_COUNT="$(printf '%s' "$BATCH_JSON" | json_get "(data.errors || []).length")"
  TOTAL_AFTER="$(printf '%s' "$BATCH_JSON" | json_get "data.stats.after.totalChunks")"
  EMBEDDED_AFTER="$(printf '%s' "$BATCH_JSON" | json_get "data.stats.after.embeddedChunks")"
  PENDING_AFTER="$(printf '%s' "$BATCH_JSON" | json_get "data.stats.after.pendingChunks")"

  PROCESSED_TOTAL=$((PROCESSED_TOTAL + BATCH_PROCESSED))
  FAILED_TOTAL=$((FAILED_TOTAL + BATCH_FAILED))

  echo "[KB Reembed] batch=$BATCH_COUNT processed=$BATCH_PROCESSED failed=$BATCH_FAILED errors=$ERROR_COUNT"
  echo "[KB Reembed] progress total=$TOTAL_AFTER embedded=$EMBEDDED_AFTER pending=$PENDING_AFTER"

  if [[ "$PENDING_AFTER" -le 0 ]]; then
    break
  fi

  if [[ "$UNTIL_COMPLETE" -eq 0 && "$BATCH_COUNT" -ge "$MAX_BATCHES" ]]; then
    break
  fi

  if [[ "$BATCH_PROCESSED" -eq 0 && "$BATCH_FAILED" -eq 0 ]]; then
    break
  fi
done

FINAL_JSON="$(fetch_json "$BASE_URL/api/codex/kb/embeddings" 90)"
TOTAL_FINAL="$(printf '%s' "$FINAL_JSON" | json_get "data.stats.totalChunks")"
EMBEDDED_FINAL="$(printf '%s' "$FINAL_JSON" | json_get "data.stats.embeddedChunks")"
PENDING_FINAL="$(printf '%s' "$FINAL_JSON" | json_get "data.stats.pendingChunks")"

echo "[KB Reembed] complete batches=$BATCH_COUNT processed=$PROCESSED_TOTAL failed=$FAILED_TOTAL"
echo "[KB Reembed] after total=$TOTAL_FINAL embedded=$EMBEDDED_FINAL pending=$PENDING_FINAL"
