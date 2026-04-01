#!/usr/bin/env node
/**
 * AgentiQ Codex Artifact Generator
 *
 * Called by .github/workflows/update-aigency-codex.yml on every merged PR.
 * Deterministic — no LLM calls required.
 *
 * Reads PR metadata from environment variables, parses AIGENTZ_* sections
 * from the PR body, and writes structured artifacts into the AgentiQ Codex.
 */

const fs = require("fs");
const path = require("path");

// --- Config ---
const PR_NUMBER = process.env.PR_NUMBER || "0";
const PR_TITLE = process.env.PR_TITLE || "(untitled)";
const PR_AUTHOR = process.env.PR_AUTHOR || "unknown";
const PR_MERGED_AT = process.env.PR_MERGED_AT || new Date().toISOString();
const PR_BODY = process.env.PR_BODY || "";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";

const CODEX_ROOT = "codexes/packs/aigency";
const ITEMS = `${CODEX_ROOT}/items`;
const prLink = GITHUB_REPOSITORY
  ? `https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}`
  : `#${PR_NUMBER}`;

// --- Helpers ---

/** Extract content of a ## HEADING block from a markdown body. */
function parseSection(body, heading) {
  const lines = body.split("\n");
  const result = [];
  let inSection = false;
  for (const line of lines) {
    if (line.trim() === `## ${heading}`) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (inSection) result.push(line);
  }
  return result.join("\n").trim();
}

/** Slugify a string for use in filenames. */
function makeSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Return true if a parsed section has meaningful content (not just N/A etc). */
function hasContent(section) {
  if (!section) return false;
  const stripped = section
    .replace(/^[-*\s]+/gm, "")
    .trim()
    .toLowerCase();
  return (
    stripped !== "" &&
    stripped !== "n/a" &&
    stripped !== "none" &&
    stripped !== "none encountered" &&
    stripped !== "no decisions" &&
    stripped !== "no problems"
  );
}

/** Read file safely, return fallback if missing. */
function readFile(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

// --- Parse PR body ---
const slug = makeSlug(PR_TITLE);
const decisions = parseSection(PR_BODY, "AIGENTZ_DECISIONS");
const problems = parseSection(PR_BODY, "AIGENTZ_PROBLEMS");
const impact = parseSection(PR_BODY, "AIGENTZ_IMPACT");

// --- Ensure directories ---
[
  `${ITEMS}/build_/PR`,
  `${ITEMS}/build_/DECISIONS`,
  `${ITEMS}/build_/PROBLEMS`,
].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// --- 1. PR Brief ---
const prBriefPath = `${ITEMS}/build_/PR/PR-${PR_NUMBER}.md`;
const prBrief = [
  `# PR Brief — #${PR_NUMBER}: ${PR_TITLE}`,
  ``,
  `| Field | Value |`,
  `|-------|-------|`,
  `| PR | [#${PR_NUMBER}](${prLink}) |`,
  `| Author | @${PR_AUTHOR} |`,
  `| Merged | ${PR_MERGED_AT} |`,
  `| Repo | ${GITHUB_REPOSITORY || "iQube-Protocol/AigentZBeta"} |`,
  ``,
  `## Decisions`,
  ``,
  hasContent(decisions) ? decisions : "_None captured._",
  ``,
  `## Problems`,
  ``,
  hasContent(problems) ? problems : "_None encountered._",
  ``,
  `## Impact`,
  ``,
  hasContent(impact) ? impact : "_No impact noted._",
  ``,
].join("\n");
fs.writeFileSync(prBriefPath, prBrief);
console.log(`✓ PR brief written: ${prBriefPath}`);

// --- 2. Decision Note (only if real content) ---
if (hasContent(decisions)) {
  const decisionPath = `${ITEMS}/build_/DECISIONS/PR-${PR_NUMBER}-${slug}.md`;
  const decisionNote = [
    `# Decision Note — PR #${PR_NUMBER}: ${PR_TITLE}`,
    ``,
    `**Source:** [PR #${PR_NUMBER}](${prLink})`,
    `**Author:** @${PR_AUTHOR}`,
    `**Date:** ${PR_MERGED_AT}`,
    ``,
    decisions,
    ``,
  ].join("\n");
  fs.writeFileSync(decisionPath, decisionNote);
  console.log(`✓ Decision note written: ${decisionPath}`);
}

// --- 3. Problem Log (only if real content) ---
if (hasContent(problems)) {
  const problemPath = `${ITEMS}/build_/PROBLEMS/PR-${PR_NUMBER}-${slug}.md`;
  const problemLog = [
    `# Problem Log — PR #${PR_NUMBER}: ${PR_TITLE}`,
    ``,
    `**Source:** [PR #${PR_NUMBER}](${prLink})`,
    `**Author:** @${PR_AUTHOR}`,
    `**Date:** ${PR_MERGED_AT}`,
    ``,
    problems,
    ``,
  ].join("\n");
  fs.writeFileSync(problemPath, problemLog);
  console.log(`✓ Problem log written: ${problemPath}`);
}

// --- 4. Append to changelog ---
const changelogPath = `${ITEMS}/build_/changelog.md`;
const existingChangelog = readFile(
  changelogPath,
  "# Changelog\n\nPR-driven update history.\n"
);
const changelogEntry = `- [PR #${PR_NUMBER}](${prLink}) — ${PR_TITLE} (@${PR_AUTHOR}, ${PR_MERGED_AT})`;
const changelogLines = existingChangelog.split("\n");
// Insert after the heading line
changelogLines.splice(1, 0, changelogEntry);
fs.writeFileSync(changelogPath, changelogLines.join("\n"));
console.log(`✓ Changelog updated`);

// --- 5. Append to retrieval index ---
const retrievalIndexPath = `${ITEMS}/memory/retrieval-index.md`;
const existingIndex = readFile(
  retrievalIndexPath,
  "# Memory — Retrieval Index\n\nTop-level retrieval anchors for this pack.\n"
);
const indexEntry = [
  ``,
  `## PR #${PR_NUMBER} — ${PR_MERGED_AT}`,
  `- Brief: [PR-${PR_NUMBER}.md](../build_/PR/PR-${PR_NUMBER}.md)`,
  hasContent(decisions)
    ? `- Decisions: [PR-${PR_NUMBER}-${slug}.md](../build_/DECISIONS/PR-${PR_NUMBER}-${slug}.md)`
    : null,
  hasContent(problems)
    ? `- Problems: [PR-${PR_NUMBER}-${slug}.md](../build_/PROBLEMS/PR-${PR_NUMBER}-${slug}.md)`
    : null,
]
  .filter(Boolean)
  .join("\n");
fs.writeFileSync(retrievalIndexPath, existingIndex + indexEntry + "\n");
console.log(`✓ Retrieval index updated`);

// --- 6. Update index.json ---
const jsonIndexPath = `${CODEX_ROOT}/index.json`;
let jsonIndex = {};
try {
  jsonIndex = JSON.parse(readFile(jsonIndexPath, "{}"));
} catch {
  jsonIndex = {};
}
jsonIndex.last_updated = new Date().toISOString();
jsonIndex.latest_pr = parseInt(PR_NUMBER, 10);
jsonIndex.latest_pr_title = PR_TITLE;
if (!Array.isArray(jsonIndex.pr_history)) jsonIndex.pr_history = [];
jsonIndex.pr_history.unshift({
  number: parseInt(PR_NUMBER, 10),
  title: PR_TITLE,
  author: PR_AUTHOR,
  merged_at: PR_MERGED_AT,
  brief: `items/build_/PR/PR-${PR_NUMBER}.md`,
  has_decisions: hasContent(decisions),
  has_problems: hasContent(problems),
});
if (jsonIndex.pr_history.length > 50)
  jsonIndex.pr_history = jsonIndex.pr_history.slice(0, 50);
fs.writeFileSync(jsonIndexPath, JSON.stringify(jsonIndex, null, 2) + "\n");
console.log(`✓ index.json updated`);

console.log(
  `\nAgentiQ Codex artifacts generated for PR #${PR_NUMBER}: "${PR_TITLE}"`
);
