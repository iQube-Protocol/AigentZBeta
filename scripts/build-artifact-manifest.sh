#!/usr/bin/env bash
# build-artifact-manifest.sh — deterministic .next composition + sha256 manifest,
# written for the 2026-09-07 Amplify build-size forensic investigation (operator
# instruction: "capture ... a sorted manifest of relative path | bytes | sha256"
# for two reproduced builds, then diff them, rather than guess at another prune).
#
# IMPORTANT — this is a DIAGNOSTIC tool only. It measures whatever `.next` tree
# already exists in DIR; it does NOT run `next build` and does NOT apply
# amplify.yml's postBuild cleanup (native-binary/source-map/doc pruning). Run it
# once on a freshly-built .next (pre-cleanup) and, separately, after manually
# replaying the postBuild prune steps, if you need the post-cleanup composition —
# do not conflate the two, they answer different questions ("what does the build
# produce" vs "what does the cleanup leave").
#
# Usage: ./scripts/build-artifact-manifest.sh <dir-containing-.next> <output-prefix>
# Produces:
#   <output-prefix>.summary.txt   — subtree totals, biggest packages/files, file count
#   <output-prefix>.manifest.tsv  — every file: path \t bytes \t sha256, sorted by path
#
# Diff two manifests (e.g. a last-passing vs first-failing commit build) with:
#   diff <(cut -f1,2,3 passing.manifest.tsv) <(cut -f1,2,3 failing.manifest.tsv)
# A line only in the second = a NEW file; a path present in both with a
# different sha256/size = an ENLARGED/CHANGED file. See
# codexes/packs/agentiq/updates/2026-09-07_amplify-build-size-forensic-handoff.md
# for the investigation this was built for and its current status.
set -euo pipefail
DIR="$1"
OUT="$2"
cd "$DIR"

echo "=== top-level .next subtree sizes (bytes) ===" > "$OUT.summary.txt"
du -sb .next/* 2>/dev/null | sort -rn >> "$OUT.summary.txt" || true
echo "" >> "$OUT.summary.txt"
echo "=== .next/standalone total ===" >> "$OUT.summary.txt"
du -sb .next/standalone 2>/dev/null >> "$OUT.summary.txt" || echo "absent" >> "$OUT.summary.txt"
echo "=== .next/static total ===" >> "$OUT.summary.txt"
du -sb .next/static 2>/dev/null >> "$OUT.summary.txt" || echo "absent" >> "$OUT.summary.txt"
echo "=== .next/server total (top-level) ===" >> "$OUT.summary.txt"
du -sb .next/server 2>/dev/null >> "$OUT.summary.txt" || echo "absent" >> "$OUT.summary.txt"
echo "" >> "$OUT.summary.txt"
echo "=== whole .next total ===" >> "$OUT.summary.txt"
du -sb .next 2>/dev/null >> "$OUT.summary.txt" || true
echo "" >> "$OUT.summary.txt"
echo "=== file count under .next ===" >> "$OUT.summary.txt"
find .next -type f 2>/dev/null | wc -l >> "$OUT.summary.txt"
echo "" >> "$OUT.summary.txt"
echo "=== biggest .next/standalone/node_modules packages (MB) ===" >> "$OUT.summary.txt"
du -sm .next/standalone/node_modules/* .next/standalone/node_modules/@*/* 2>/dev/null | sort -rn | head -30 >> "$OUT.summary.txt" || true
echo "" >> "$OUT.summary.txt"
echo "=== biggest .next/static subtrees (MB) ===" >> "$OUT.summary.txt"
du -sm .next/static/* 2>/dev/null | sort -rn | head -15 >> "$OUT.summary.txt" || true
echo "" >> "$OUT.summary.txt"
echo "=== 40 biggest individual files anywhere under .next (bytes) ===" >> "$OUT.summary.txt"
find .next -type f -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -40 >> "$OUT.summary.txt" || true

echo "Writing full sha256 manifest (batched sha256sum, this takes a while for a large tree)..."
find .next -type f -printf '%p\t%s\n' 2>/dev/null | sort > "$OUT.sizes.tsv"
# sha256sum's own output format is "<64-hex><SP><mode-char><filename>" -- a
# mandatory delimiter space, then a mode character (' ' for text mode, '*'
# for binary -- so text mode reads as two literal spaces), then the
# filename verbatim (which may itself contain spaces -- those are NOT a
# further delimiter, just part of the filename). It is NEVER tab-separated.
# (An earlier fix attempt in this same pass consumed only ONE of the two
# separator characters, leaving the mode char/second space stuck onto the
# front of every path -- caught by the fixture test's exact-path assertion,
# not just a fuzzy size check.) The previous version of this script ran the
# join with
# `awk -F'\t'` against this output, which has no tabs at all: the whole
# "hash  path" line collapsed into a single field, silently corrupting every
# row (empty path, empty size, the hash+path crammed into one column).
# Fix: convert to a real tab-separated form first (anchored on the fixed
# 64-hex-char + mode-char prefix, which cannot appear inside a valid sha256
# hex digest), THEN join on tab. This is anchored so it is correct
# regardless of how many spaces or other characters appear in the filename
# itself. See tests/build-artifact-manifest-parser.test.ts for the fixture
# proving this against filenames containing spaces.
cut -f1 "$OUT.sizes.tsv" | xargs -d '\n' -P 4 -n 200 sha256sum \
  | sed -E 's/^([0-9a-f]{64}) [ *]/\1\t/' > "$OUT.hashes.tsv"
# join on path: sizes.tsv is "path\tsize", hashes.tsv is now "hash\tpath"
awk -F'\t' 'NR==FNR{size[$1]=$2; next} {print $2"\t"size[$2]"\t"$1}' \
  "$OUT.sizes.tsv" "$OUT.hashes.tsv" | sort -k1,1 > "$OUT.manifest.tsv"
rm -f "$OUT.sizes.tsv" "$OUT.hashes.tsv"
echo "Manifest written: $OUT.manifest.tsv ($(wc -l < "$OUT.manifest.tsv") files)"
