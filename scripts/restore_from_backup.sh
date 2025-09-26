#!/usr/bin/env bash
set -euo pipefail

# restore_from_backup.sh
# Restores the latest tarball from backups/ into a new restore directory,
# optionally installs deps and starts the dev server.
#
# Usage:
#   ./scripts/restore_from_backup.sh [--backup <YYYYmmdd_HHMMSS>] [--dir <path>] [--install] [--start] [--port <PORT>]
#
# Defaults:
#   --backup  latest timestamp directory under backups/
#   --dir     ./restore/<timestamp>
#   --port    3001
#
# Notes:
# - This does NOT overwrite your current working tree. It extracts to a new directory.
# - The tarball includes .next/ and node_modules/ from the time of backup for fast startup, but
#   it is still recommended to run npm install to ensure native modules are correct for your system.

BACKUP_TS=""
RESTORE_DIR=""
DO_INSTALL=false
DO_START=false
PORT=3001

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup)
      BACKUP_TS="${2:-}"
      shift 2
      ;;
    --dir)
      RESTORE_DIR="${2:-}"
      shift 2
      ;;
    --install)
      DO_INSTALL=true
      shift 1
      ;;
    --start)
      DO_START=true
      shift 1
      ;;
    --port)
      PORT="${2:-3001}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "$BACKUP_TS" ]]; then
  if [[ ! -d backups ]]; then
    echo "No backups/ directory found. Exiting." >&2
    exit 1
  fi
  BACKUP_TS="$(ls -1 backups | sort | tail -n1)"
fi

TARBALL="backups/${BACKUP_TS}/AigentZBeta_full.tar.gz"
if [[ ! -f "$TARBALL" ]]; then
  echo "Backup tarball not found: $TARBALL" >&2
  exit 1
fi

if [[ -z "$RESTORE_DIR" ]]; then
  RESTORE_DIR="${ROOT_DIR}/restore/${BACKUP_TS}"
fi

mkdir -p "$RESTORE_DIR"

echo "== Restoring from $TARBALL to $RESTORE_DIR =="
# Extract into restore dir's parent to keep original project folder name inside archive
PARENT_DIR="$(dirname "$RESTORE_DIR")"
mkdir -p "$PARENT_DIR"

tar -xzf "$TARBALL" -C "$PARENT_DIR"

# The archive contains the project directory (e.g., AigentZBeta). Move/rename to requested restore dir if needed.
# Detect extracted top-level dir by checking the newest dir in parent
EXTRACTED_DIR="$(find "$PARENT_DIR" -maxdepth 1 -type d -not -path "$PARENT_DIR" -print0 | xargs -0 ls -td | head -n1)"

# If the extracted dir equals RESTORE_DIR, fine; otherwise move
if [[ "$EXTRACTED_DIR" != "$RESTORE_DIR" ]]; then
  # If RESTORE_DIR exists and is empty, remove it to allow move
  if [[ -d "$RESTORE_DIR" ]] && [[ -z "$(ls -A "$RESTORE_DIR" 2>/dev/null || true)" ]]; then
    rmdir "$RESTORE_DIR"
  fi
  mv "$EXTRACTED_DIR" "$RESTORE_DIR"
fi

cd "$RESTORE_DIR"

echo "\n== Restore complete =="
pwd
ls -la | head -n 50

if $DO_INSTALL; then
  echo "\n== Installing dependencies =="
  npm install
fi

if $DO_START; then
  echo "\n== Starting dev server on PORT=$PORT =="
  PORT=$PORT npm run dev
else
  echo "\nTo start the app manually:"
  echo "  cd \"$RESTORE_DIR\""
  echo "  npm install   # recommended"
  echo "  PORT=$PORT npm run dev"
fi
