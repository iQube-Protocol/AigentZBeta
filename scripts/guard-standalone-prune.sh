#!/usr/bin/env bash
# guard-standalone-prune.sh — safety check for any script that replays
# amplify.yml's postBuild prune (rm -rf / find -delete) against a LOCAL
# reproduction of a `next build` (output: "standalone") artifact.
#
# WHY THIS EXISTS. Twice in the 2026-09-07 Amplify build-size forensic
# investigation (independently, in two different agent sessions), a
# reproduction worktree's `node_modules` was symlinked back to a shared
# install to save an `npm ci` run. Next's standalone file tracer detects a
# symlinked `node_modules` (its pnpm-compatibility path) and, instead of
# copying a pruned subset into `.next/standalone/node_modules`, symlinks
# that ENTIRE directory wholesale to the real target. A prune script's
# `rm -rf`/`find -delete` commands then execute THROUGH that symlink and
# delete real files from the actual shared `node_modules` -- which is what
# happened both times (see
# codexes/packs/agentiq/updates/2026-09-07_amplify-build-size-forensic-handoff.md,
# "Reproduction bug #2" / "symlinked node_modules got pruned").
#
# This guard does NOT know or care what the prune commands themselves are
# (so it never drifts when amplify.yml's postBuild sequence changes) --
# it only asserts the physical precondition that makes those commands SAFE
# to run at all: `.next/standalone/node_modules` must be a real directory,
# and everything it resolves to must live inside `.next/standalone` itself,
# never outside it.
#
# Usage: ./scripts/guard-standalone-prune.sh <dir-containing-.next>
# Exit 0 = safe to prune. Exit 1 (with a loud message, nothing deleted) =
# STOP, do not run any destructive command against this tree.
set -euo pipefail
DIR="${1:?usage: guard-standalone-prune.sh <dir-containing-.next>}"
TARGET="$DIR/.next/standalone/node_modules"
STANDALONE_REAL="$(cd "$DIR/.next/standalone" 2>/dev/null && pwd -P)" || {
  echo "GUARD FAIL: $DIR/.next/standalone does not exist -- nothing to prune, stopping." >&2
  exit 1
}

if [ -L "$TARGET" ]; then
  echo "GUARD FAIL: $TARGET is a SYMLINK (-> $(readlink "$TARGET")). This is exactly the" >&2
  echo "  incident documented in 2026-09-07_amplify-build-size-forensic-handoff.md --" >&2
  echo "  pruning through it would delete real files from whatever it points at." >&2
  echo "  Fix: give this worktree its OWN independent 'npm ci' / 'npm install' instead" >&2
  echo "  of symlinking node_modules from another install. REFUSING to prune." >&2
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "GUARD FAIL: $TARGET does not exist or is not a directory -- the build likely" >&2
  echo "  never produced output: \"standalone\" (check AWS_BRANCH/AMPLIFY_APP_ID were set" >&2
  echo "  before 'next build' ran). REFUSING to prune a tree with no standalone output." >&2
  exit 1
fi

TARGET_REAL="$(cd "$TARGET" && pwd -P)"
case "$TARGET_REAL" in
  "$STANDALONE_REAL"/*|"$STANDALONE_REAL")
    ;;
  *)
    echo "GUARD FAIL: $TARGET resolves to '$TARGET_REAL', which is OUTSIDE" >&2
    echo "  '$STANDALONE_REAL'. A prune command run against it would touch files" >&2
    echo "  outside the disposable build artifact. REFUSING to prune." >&2
    exit 1
    ;;
esac

# Recurse: any directory symlink NESTED inside standalone/node_modules that
# escapes .next/standalone is the same hazard one level down (e.g. a package
# that itself got installed as a symlink, common with npm/yarn workspaces).
while IFS= read -r -d '' link; do
  linkReal="$(cd "$(dirname "$link")" && cd "$(readlink "$link")" 2>/dev/null && pwd -P)" || continue
  case "$linkReal" in
    "$STANDALONE_REAL"/*|"$STANDALONE_REAL") ;;
    *)
      echo "GUARD FAIL: nested symlink '$link' resolves to '$linkReal', OUTSIDE" >&2
      echo "  '$STANDALONE_REAL'. REFUSING to prune." >&2
      exit 1
      ;;
  esac
done < <(find "$TARGET" -maxdepth 3 -type l -print0 2>/dev/null)

echo "GUARD OK: $TARGET is a real directory, fully contained under $STANDALONE_REAL. Safe to prune."
