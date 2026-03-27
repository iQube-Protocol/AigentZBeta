#!/usr/bin/env node
/**
 * AgentiQ Codex — Direct Commit Artifact Generator
 *
 * Called by .github/workflows/update-codex-on-push.yml on every direct push to dev.
 * Generates a commit brief and updates index.json / changelog / retrieval-index.
 *
 * Deterministic — no LLM calls required.
 *
 * Env vars:
 *   COMMIT_SHA            — full 40-char SHA
 *   COMMIT_SHORT_SHA      — 7-char short SHA
 *   COMMIT_MESSAGE        — full commit message (subject + body)
 *   COMMIT_AUTHOR         — author name
 *   COMMIT_TIMESTAMP      — ISO 8601 timestamp
 *   COMMIT_FILES_CHANGED  — newline-separated "STATUS\tpath" lines (git diff-tree output)
 *   COMMIT_STAT_SUMMARY   — e.g. "3 files changed, 42 insertions(+), 5 deletions(-)"
 *   GITHUB_REPOSITORY     — e.g. "iQube-Protocol/AigentZBeta"
 */

const fs = require("fs");
const path = require("path");

// --- Config ---
const COMMIT_SHA = process.env.COMMIT_SHA || "";
const COMMIT_SHORT_SHA =
  process.env.COMMIT_SHORT_SHA || COMMIT_SHA.slice(0, 7) || "unknown";
const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE || "(no message)";
const COMMIT_AUTHOR = process.env.COMMIT_AUTHOR || "unknown";
const COMMIT_TIMESTAMP =
  process.env.COMMIT_TIMESTAMP || new Date().toISOString();
const COMMIT_FILES_CHANGED = process.env.COMMIT_FILES_CHANGED || "";
const COMMIT_STAT_SUMMARY = process.env.COMMIT_STAT_SUMMARY || "";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";

const CODEX_ROOT = "codexes/packs/aigency";
const ITEMS = `${CODEX_ROOT}/items`;

const commitUrl = GITHUB_REPOSITORY
  ? `https://github.com/${GITHUB_REPOSITORY}/commit/${COMMIT_SHA}`
  : COMMIT_SHA;

// --- Helpers ---

/** Read file safely, return fallback if missing. */
function readFile(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

/** Parse conventional commit type from the first line of a commit message. */
function parseConventionalType(message) {
  const firstLine = message.split("\n")[0].trim();
  const match = firstLine.match(
    /^(feat|fix|refactor|docs|chore|test|style|perf|ci|build|revert)(\(.+?\))?!?:/i
  );
  if (match) return match[1].toLowerCase();
  // Heuristic fallbacks
  if (/\b(add|implement|wire|create|introduce)\b/i.test(firstLine))
    return "feat";
  if (/\b(fix|resolve|correct|patch|repair)\b/i.test(firstLine)) return "fix";
  if (/\b(refactor|restructure|rename|move|clean)\b/i.test(firstLine))
    return "refactor";
  if (/\b(update|bump|upgrade)\b/i.test(firstLine)) return "chore";
  return "push"; // uncategorized direct push
}

/** Format file changes as a markdown table. */
function formatFilesChanged(rawFiles) {
  if (!rawFiles.trim()) return "_No file data available._";
  const statusMap = {
    A: "Added",
    M: "Modified",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
  };
  const rows = rawFiles
    .trim()
    .split("\n")
    .slice(0, 40) // cap at 40 files in the brief
    .map((line) => {
      const parts = line.split("\t");
      const status = statusMap[parts[0]?.[0]] || parts[0] || "?";
      const file = parts[1] || parts[0];
      return `| ${status} | \`${file}\` |`;
    });
  if (rows.length === 0) return "_No files reported._";
  const header = "| Change | File |\n|--------|------|";
  const truncNote =
    rawFiles.trim().split("\n").length > 40
      ? "\n\n_…and more (truncated at 40 files)._"
      : "";
  return header + "\n" + rows.join("\n") + truncNote;
}

// --- Derive metadata ---
const commitType = parseConventionalType(COMMIT_MESSAGE);
const firstLine = COMMIT_MESSAGE.split("\n")[0].trim();
const commitBody = COMMIT_MESSAGE.split("\n").slice(1).join("\n").trim();

// --- Ensure directories ---
fs.mkdirSync(`${ITEMS}/build_/COMMITS`, { recursive: true });

// --- 1. Commit Brief ---
const briefPath = `${ITEMS}/build_/COMMITS/COMMIT-${COMMIT_SHORT_SHA}.md`;
// Skip if already exists (idempotent)
if (!fs.existsSync(briefPath)) {
  const brief = [
    `# Commit Brief: \`${COMMIT_SHORT_SHA}\` — ${firstLine}`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| SHA | [\`${COMMIT_SHORT_SHA}\`](${commitUrl}) |`,
    `| Author | ${COMMIT_AUTHOR} |`,
    `| Date | ${COMMIT_TIMESTAMP} |`,
    `| Branch | dev (direct push) |`,
    `| Type | \`${commitType}\` |`,
    `| Repo | ${GITHUB_REPOSITORY || "iQube-Protocol/AigentZBeta"} |`,
    ``,
    `## Commit Message`,
    ``,
    "```",
    COMMIT_MESSAGE.trim(),
    "```",
    ``,
    commitBody ? `## Body\n\n${commitBody}\n` : null,
    `## Files Changed`,
    ``,
    formatFilesChanged(COMMIT_FILES_CHANGED),
    ``,
    COMMIT_STAT_SUMMARY ? `## Stats\n\n${COMMIT_STAT_SUMMARY}\n` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
  fs.writeFileSync(briefPath, brief);
  console.log(`✓ Commit brief written: ${briefPath}`);
} else {
  console.log(`⚠ Brief already exists for ${COMMIT_SHORT_SHA} — skipping.`);
}

// --- 2. Append to changelog ---
const changelogPath = `${ITEMS}/build_/changelog.md`;
const existingChangelog = readFile(
  changelogPath,
  "# Changelog\n\nPR-driven and direct-push update history.\n"
);
// Check if this SHA is already in the changelog to keep idempotent
if (!existingChangelog.includes(COMMIT_SHORT_SHA)) {
  const entry = `- [\`${COMMIT_SHORT_SHA}\`](${commitUrl}) [${commitType}] ${firstLine} (${COMMIT_AUTHOR}, ${COMMIT_TIMESTAMP})`;
  const lines = existingChangelog.split("\n");
  lines.splice(1, 0, entry);
  fs.writeFileSync(changelogPath, lines.join("\n"));
  console.log(`✓ Changelog updated`);
}

// --- 3. Append to retrieval index ---
const retrievalIndexPath = `${ITEMS}/memory/retrieval-index.md`;
const existingIndex = readFile(
  retrievalIndexPath,
  "# Memory — Retrieval Index\n\nTop-level retrieval anchors for this pack.\n"
);
if (!existingIndex.includes(COMMIT_SHORT_SHA)) {
  const indexEntry = [
    ``,
    `## Commit \`${COMMIT_SHORT_SHA}\` — ${COMMIT_TIMESTAMP}`,
    `- Type: \`${commitType}\``,
    `- Brief: [COMMIT-${COMMIT_SHORT_SHA}.md](../build_/COMMITS/COMMIT-${COMMIT_SHORT_SHA}.md)`,
    `- Message: ${firstLine}`,
  ].join("\n");
  fs.writeFileSync(retrievalIndexPath, existingIndex + indexEntry + "\n");
  console.log(`✓ Retrieval index updated`);
}

// --- 4. Update index.json ---
const jsonIndexPath = `${CODEX_ROOT}/index.json`;
let jsonIndex = {};
try {
  jsonIndex = JSON.parse(readFile(jsonIndexPath, "{}"));
} catch {
  jsonIndex = {};
}
jsonIndex.last_updated = new Date().toISOString();
jsonIndex.latest_commit = COMMIT_SHA;
jsonIndex.latest_commit_short = COMMIT_SHORT_SHA;
jsonIndex.latest_commit_title = firstLine;
if (!Array.isArray(jsonIndex.commit_history)) jsonIndex.commit_history = [];
// Idempotent: don't duplicate
const alreadyCaptured = jsonIndex.commit_history.some(
  (c) => c.sha === COMMIT_SHORT_SHA
);
if (!alreadyCaptured) {
  jsonIndex.commit_history.unshift({
    sha: COMMIT_SHORT_SHA,
    full_sha: COMMIT_SHA,
    title: firstLine,
    author: COMMIT_AUTHOR,
    timestamp: COMMIT_TIMESTAMP,
    type: commitType,
    brief: `items/build_/COMMITS/COMMIT-${COMMIT_SHORT_SHA}.md`,
  });
  if (jsonIndex.commit_history.length > 100)
    jsonIndex.commit_history = jsonIndex.commit_history.slice(0, 100);
  fs.writeFileSync(jsonIndexPath, JSON.stringify(jsonIndex, null, 2) + "\n");
  console.log(`✓ index.json updated`);
}

console.log(
  `\nAgentiQ Codex commit brief generated for ${COMMIT_SHORT_SHA}: "${firstLine}"`
);
