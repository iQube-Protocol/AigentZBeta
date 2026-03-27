#!/usr/bin/env node
/**
 * AgentiQ Codex — Dev Branch Commit Backfill
 *
 * Fetches all commits from the dev branch via GitHub REST API,
 * excludes merge commits and commits already captured in index.json,
 * then generates a commit brief for each uncaptured commit.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=iQube-Protocol/AigentZBeta node scripts/backfill-dev-commits.js
 *
 * Optional env vars:
 *   BRANCH             — branch to backfill (default: dev)
 *   MAX_COMMITS        — stop after this many API pages (default: unlimited)
 *   DRY_RUN=1          — print what would be written, don't write anything
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// --- Config ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPOSITORY =
  process.env.GITHUB_REPOSITORY || "iQube-Protocol/AigentZBeta";
const BRANCH = process.env.BRANCH || "dev";
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_PAGES = parseInt(process.env.MAX_COMMITS || "0", 10) || Infinity;

const CODEX_ROOT = "codexes/packs/aigency";
const ITEMS = `${CODEX_ROOT}/items`;

if (!GITHUB_TOKEN) {
  console.error(
    "ERROR: GITHUB_TOKEN is required.\n" +
      "  Usage: GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo node scripts/backfill-dev-commits.js"
  );
  process.exit(1);
}

// --- GitHub API helper ---
function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: urlPath,
      method: "GET",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "AgentiQ-Codex-Backfill/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          try {
            resolve({ data: JSON.parse(body), headers: res.headers });
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** Sleep ms for rate limiting. */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Codex helpers (same as generate-commit-artifacts.js) ---
function readFile(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function parseConventionalType(message) {
  const firstLine = message.split("\n")[0].trim();
  const match = firstLine.match(
    /^(feat|fix|refactor|docs|chore|test|style|perf|ci|build|revert)(\(.+?\))?!?:/i
  );
  if (match) return match[1].toLowerCase();
  if (/\b(add|implement|wire|create|introduce)\b/i.test(firstLine))
    return "feat";
  if (/\b(fix|resolve|correct|patch|repair)\b/i.test(firstLine)) return "fix";
  if (/\b(refactor|restructure|rename|move|clean)\b/i.test(firstLine))
    return "refactor";
  if (/\b(update|bump|upgrade)\b/i.test(firstLine)) return "chore";
  return "push";
}

function formatFilesChanged(files) {
  // files: array of { filename, status, additions, deletions }
  if (!files || files.length === 0) return "_No file data available._";
  const statusMap = {
    added: "Added",
    modified: "Modified",
    removed: "Deleted",
    renamed: "Renamed",
    copied: "Copied",
    changed: "Modified",
  };
  const rows = files.slice(0, 40).map((f) => {
    const status = statusMap[f.status] || f.status;
    const stats =
      f.additions !== undefined ? `+${f.additions}/-${f.deletions}` : "";
    return `| ${status} | \`${f.filename}\` | ${stats} |`;
  });
  const header = "| Change | File | +/- |\n|--------|------|-----|";
  const truncNote =
    files.length > 40 ? `\n\n_…and ${files.length - 40} more files._` : "";
  return header + "\n" + rows.join("\n") + truncNote;
}

function writeCommitBrief(commit, filesData) {
  const sha = commit.sha;
  const shortSha = sha.slice(0, 7);
  const message =
    commit.commit.message || "(no message)";
  const firstLine = message.split("\n")[0].trim();
  const author =
    commit.commit.author?.name || commit.author?.login || "unknown";
  const timestamp = commit.commit.author?.date || new Date().toISOString();
  const commitType = parseConventionalType(message);
  const commitUrl = `https://github.com/${GITHUB_REPOSITORY}/commit/${sha}`;

  const statsLine = filesData
    ? `${filesData.stats.total} files changed, ` +
      `${filesData.stats.additions} insertions(+), ` +
      `${filesData.stats.deletions} deletions(-)`
    : "";

  const briefPath = `${ITEMS}/build_/COMMITS/COMMIT-${shortSha}.md`;
  if (fs.existsSync(briefPath)) {
    console.log(`  ⚠ Already exists: ${shortSha} — skipping`);
    return false;
  }

  const brief = [
    `# Commit Brief: \`${shortSha}\` — ${firstLine}`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| SHA | [\`${shortSha}\`](${commitUrl}) |`,
    `| Author | ${author} |`,
    `| Date | ${timestamp} |`,
    `| Branch | ${BRANCH} |`,
    `| Type | \`${commitType}\` |`,
    `| Repo | ${GITHUB_REPOSITORY} |`,
    ``,
    `## Commit Message`,
    ``,
    "```",
    message.trim(),
    "```",
    ``,
    `## Files Changed`,
    ``,
    filesData ? formatFilesChanged(filesData.files) : "_File data not fetched._",
    ``,
    statsLine ? `## Stats\n\n${statsLine}\n` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  if (!DRY_RUN) {
    fs.writeFileSync(briefPath, brief);
  }
  return { sha, shortSha, firstLine, author, timestamp, commitType };
}

function updateChangelogAndIndex(captured) {
  if (captured.length === 0) return;

  // Update changelog
  const changelogPath = `${ITEMS}/build_/changelog.md`;
  let changelog = readFile(
    changelogPath,
    "# Changelog\n\nPR-driven and direct-push update history.\n"
  );
  const commitUrl = (sha) =>
    `https://github.com/${GITHUB_REPOSITORY}/commit/${sha}`;
  for (const c of captured) {
    if (!changelog.includes(c.shortSha)) {
      const entry = `- [\`${c.shortSha}\`](${commitUrl(c.sha)}) [${c.commitType}] ${c.firstLine} (${c.author}, ${c.timestamp})`;
      const lines = changelog.split("\n");
      lines.splice(1, 0, entry);
      changelog = lines.join("\n");
    }
  }
  if (!DRY_RUN) fs.writeFileSync(changelogPath, changelog);

  // Update retrieval index
  const indexPath = `${ITEMS}/memory/retrieval-index.md`;
  let idx = readFile(
    indexPath,
    "# Memory — Retrieval Index\n\nTop-level retrieval anchors for this pack.\n"
  );
  for (const c of captured) {
    if (!idx.includes(c.shortSha)) {
      idx +=
        `\n## Commit \`${c.shortSha}\` — ${c.timestamp}\n` +
        `- Type: \`${c.commitType}\`\n` +
        `- Brief: [COMMIT-${c.shortSha}.md](../build_/COMMITS/COMMIT-${c.shortSha}.md)\n` +
        `- Message: ${c.firstLine}\n`;
    }
  }
  if (!DRY_RUN) fs.writeFileSync(indexPath, idx);

  // Update index.json
  const jsonPath = `${CODEX_ROOT}/index.json`;
  let jsonIndex = {};
  try {
    jsonIndex = JSON.parse(readFile(jsonPath, "{}"));
  } catch {
    jsonIndex = {};
  }
  if (!Array.isArray(jsonIndex.commit_history)) jsonIndex.commit_history = [];
  const existingShas = new Set(jsonIndex.commit_history.map((c) => c.sha));
  let added = 0;
  for (const c of captured) {
    if (!existingShas.has(c.shortSha)) {
      jsonIndex.commit_history.push({
        sha: c.shortSha,
        full_sha: c.sha,
        title: c.firstLine,
        author: c.author,
        timestamp: c.timestamp,
        type: c.commitType,
        brief: `items/build_/COMMITS/COMMIT-${c.shortSha}.md`,
      });
      added++;
    }
  }
  // Sort by timestamp descending, cap at 100
  jsonIndex.commit_history.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  if (jsonIndex.commit_history.length > 100)
    jsonIndex.commit_history = jsonIndex.commit_history.slice(0, 100);
  jsonIndex.last_updated = new Date().toISOString();
  if (jsonIndex.commit_history.length > 0) {
    const latest = jsonIndex.commit_history[0];
    jsonIndex.latest_commit = latest.full_sha;
    jsonIndex.latest_commit_short = latest.sha;
    jsonIndex.latest_commit_title = latest.title;
  }
  if (!DRY_RUN) {
    fs.writeFileSync(jsonPath, JSON.stringify(jsonIndex, null, 2) + "\n");
  }
  console.log(
    `✓ index.json updated (${added} new commits added to commit_history)`
  );
}

// --- Main ---
async function main() {
  console.log(
    `AgentiQ Codex Dev Branch Backfill\n` +
      `  Repo: ${GITHUB_REPOSITORY}\n` +
      `  Branch: ${BRANCH}\n` +
      `  Dry run: ${DRY_RUN}\n`
  );

  // Load existing captured SHAs from index.json
  let jsonIndex = {};
  try {
    jsonIndex = JSON.parse(
      readFile(`${CODEX_ROOT}/index.json`, "{}")
    );
  } catch {}
  const existingCommitShas = new Set(
    (jsonIndex.commit_history || []).map((c) => c.full_sha || c.sha)
  );
  // Also check existing brief files
  const existingBriefs = new Set();
  try {
    const commitsDir = `${ITEMS}/build_/COMMITS`;
    if (fs.existsSync(commitsDir)) {
      fs.readdirSync(commitsDir).forEach((f) => {
        const m = f.match(/^COMMIT-([a-f0-9]+)\.md$/);
        if (m) existingBriefs.add(m[1]);
      });
    }
  } catch {}

  console.log(
    `Existing captures: ${existingCommitShas.size} in index.json, ${existingBriefs.size} brief files`
  );

  // Paginate through commits on BRANCH
  let page = 1;
  let totalFetched = 0;
  let allCommits = [];

  while (page <= MAX_PAGES) {
    console.log(`Fetching commits page ${page}…`);
    let result;
    try {
      result = await apiGet(
        `/repos/${GITHUB_REPOSITORY}/commits?sha=${BRANCH}&per_page=100&page=${page}`
      );
    } catch (e) {
      console.error(`API error on page ${page}: ${e.message}`);
      break;
    }

    const commits = result.data;
    if (!Array.isArray(commits) || commits.length === 0) {
      console.log(`No more commits at page ${page}.`);
      break;
    }

    totalFetched += commits.length;
    allCommits.push(...commits);
    console.log(`  Got ${commits.length} commits (total: ${totalFetched})`);

    // Check Link header for next page
    const linkHeader = result.headers.link || "";
    if (!linkHeader.includes('rel="next"')) break;

    page++;
    await sleep(300); // rate limit courtesy
  }

  console.log(`\nTotal commits fetched: ${totalFetched}`);

  // Filter: exclude merge commits and already-captured commits
  const mergePattern = /^Merge (branch|pull request|remote)/i;
  const toProcess = allCommits.filter((c) => {
    const msg = c.commit?.message || "";
    if (mergePattern.test(msg)) return false; // skip merges
    const shortSha = c.sha.slice(0, 7);
    if (existingBriefs.has(shortSha)) return false; // already has brief file
    if (existingCommitShas.has(c.sha)) return false; // already in index.json
    return true;
  });

  console.log(
    `Commits to capture: ${toProcess.length} (skipped ${totalFetched - toProcess.length} merges/already-captured)\n`
  );

  if (toProcess.length === 0) {
    console.log("Nothing to backfill — codex is up to date.");
    return;
  }

  // Ensure output directory exists
  if (!DRY_RUN) {
    fs.mkdirSync(`${ITEMS}/build_/COMMITS`, { recursive: true });
  }

  // Process each commit
  const captured = [];
  let fetchErrors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const c = toProcess[i];
    const shortSha = c.sha.slice(0, 7);
    const firstLine = (c.commit?.message || "").split("\n")[0].trim();
    console.log(
      `[${i + 1}/${toProcess.length}] ${shortSha} — ${firstLine.slice(0, 60)}`
    );

    // Fetch full commit data for file details
    let filesData = null;
    try {
      const detail = await apiGet(
        `/repos/${GITHUB_REPOSITORY}/commits/${c.sha}`
      );
      filesData = {
        files: detail.data.files || [],
        stats: detail.data.stats || {
          total: 0,
          additions: 0,
          deletions: 0,
        },
      };
      await sleep(150); // GitHub API rate limit: 60 req/min unauthenticated, 5000/hr authenticated
    } catch (e) {
      console.warn(`  ⚠ Could not fetch file details: ${e.message}`);
      fetchErrors++;
    }

    const result = writeCommitBrief(c, filesData);
    if (result) {
      captured.push({ ...result, sha: c.sha });
    }
  }

  console.log(`\nWritten ${captured.length} commit briefs.`);
  if (fetchErrors > 0)
    console.warn(`  ${fetchErrors} commits had file-detail fetch errors.`);

  // Batch-update changelog, retrieval-index, index.json
  updateChangelogAndIndex(captured);

  console.log(
    `\n✓ Backfill complete. ${captured.length} commits captured into AgentiQ Codex.`
  );
  if (DRY_RUN) console.log("  (DRY RUN — nothing was written to disk)");
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
