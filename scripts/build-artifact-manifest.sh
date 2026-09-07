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
cut -f1 "$OUT.sizes.tsv" | xargs -d '\n' -P 4 -n 200 sha256sum > "$OUT.hashes.tmp"
# join on path: sizes.tsv is "path\tsize", hashes.tmp is "hash  path"
awk -F'\t' 'NR==FNR{size[$1]=$2; next} {hash=$1; $1=""; path=$0; sub(/^  */,"",path); print path"\t"size[path]"\t"hash}' \
  "$OUT.sizes.tsv" "$OUT.hashes.tmp" | sort -k1 > "$OUT.manifest.tsv"
rm -f "$OUT.sizes.tsv" "$OUT.hashes.tmp"
echo "Manifest written: $OUT.manifest.tsv ($(wc -l < "$OUT.manifest.tsv") files)"
