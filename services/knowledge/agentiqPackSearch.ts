/**
 * AgentiQ Pack Search — shared keyword retrieval over the aigency + agentiq
 * codex packs (architecture, knowledge, operators manual, decisions, updates,
 * commit briefs).
 *
 * Moved out of app/api/codex/chat/aigentiq/route.ts so both the AgentiQ
 * cartridge copilot and the aigent-z Dev Command Center copilot
 * (app/api/codex/chat/route.ts) share one authoritative implementation.
 * File references are formatted as GitHub links so the packs double as a
 * repo navigation tool.
 */

import * as fs from 'fs';
import * as path from 'path';

// Engineering KB (architecture, API reference, commit history)
export const AIGENCY_ROOT = path.join(process.cwd(), 'codexes/packs/aigency');
// Cartridge management pack (items, updates, decisions, backlog)
export const AGENTIQ_ROOT = path.join(process.cwd(), 'codexes/packs/agentiq');

export const GITHUB_BLOB_BASE = 'https://github.com/iQube-Protocol/AigentZBeta/blob/dev';

export type ItemStatus = 'SHIPPED' | 'BACKLOG' | 'PLANNED' | 'REFERENCE';

export interface SearchResult {
  /** Path relative to codexes/packs/ — used to build GitHub link */
  packRelPath: string;
  excerpt: string;
  score: number;
  status: ItemStatus;
  githubUrl: string;
}

// ============================================================================
// Filesystem helpers
// ============================================================================

export function readPackFile(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function listMarkdownFiles(dir: string, root: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listMarkdownFiles(full, root));
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        results.push(path.relative(root, full));
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
}

function classifyStatus(packRelPath: string, content: string): ItemStatus {
  if (packRelPath.includes('/updates/')) {
    if (/backlog/i.test(packRelPath)) return 'BACKLOG';
    if (/plan|handover|handoff/i.test(packRelPath)) return 'PLANNED';
    return 'SHIPPED';
  }
  if (/\|\s*Type\s*\|\s*`deploy`/.test(content)) return 'SHIPPED';
  return 'REFERENCE';
}

function isDeployCommit(content: string): boolean {
  return /\|\s*Type\s*\|\s*`deploy`/.test(content);
}

export function buildGithubUrl(packName: string, relPath: string): string {
  return `${GITHUB_BLOB_BASE}/codexes/packs/${packName}/${relPath}`;
}

/**
 * Collect all markdown files from both packs, tagged with their pack name.
 * Returns entries with packName, relPath, and the absolute path for reading.
 */
function collectAllFiles(): Array<{ packName: string; relPath: string; absPath: string }> {
  const entries: Array<{ packName: string; relPath: string; absPath: string }> = [];

  // aigency: scan items/ and its subdirs (architecture, knowledge, repos, build_, etc.)
  const aigencyItems = path.join(AIGENCY_ROOT, 'items');
  for (const rel of listMarkdownFiles(aigencyItems, AIGENCY_ROOT)) {
    entries.push({ packName: 'aigency', relPath: rel, absPath: path.join(AIGENCY_ROOT, rel) });
  }

  // agentiq: scan items/ and updates/
  for (const subdir of ['items', 'updates']) {
    const dir = path.join(AGENTIQ_ROOT, subdir);
    for (const rel of listMarkdownFiles(dir, AGENTIQ_ROOT)) {
      entries.push({ packName: 'agentiq', relPath: rel, absPath: path.join(AGENTIQ_ROOT, rel) });
    }
  }

  return entries;
}

// Common query words that would otherwise dominate the substring-count score
// ("what are DiDQubes" must rank on "didqubes", not on "what"/"are").
const STOPWORDS = new Set([
  'the', 'and', 'are', 'for', 'with', 'that', 'this', 'what', 'when', 'where',
  'which', 'who', 'how', 'why', 'does', 'can', 'you', 'your', 'about', 'tell',
  'show', 'give', 'list', 'have', 'has', 'was', 'were', 'will', 'their', 'them',
  'they', 'there', 'from', 'into', 'any', 'all', 'our', 'use', 'used', 'using',
]);

/** Keyword search across both packs. */
export function searchCodex(query: string, limit = 6): SearchResult[] {
  const rawTerms = query
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  // Fold trailing plural 's' so "didqubes" also matches "didqube".
  const terms = rawTerms.map((t) =>
    t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t,
  );

  if (terms.length === 0) return [];

  const allFiles = collectAllFiles();

  // Priority: architecture/knowledge/repos/decisions docs before commit briefs and updates
  const priorityPrefixes = ['items/architecture', 'items/knowledge', 'items/repos', 'items/build_'];
  const sorted = [
    ...allFiles.filter((f) => priorityPrefixes.some((p) => f.relPath.startsWith(p)) && !f.relPath.includes('/COMMITS/')),
    ...allFiles.filter((f) => f.relPath.startsWith('items/') && !priorityPrefixes.some((p) => f.relPath.startsWith(p))),
    ...allFiles.filter((f) => f.relPath.startsWith('updates/')),
    ...allFiles.filter((f) => f.relPath.includes('/COMMITS/')),
  ];

  const results: SearchResult[] = [];

  for (const f of sorted) {
    const content = readPackFile(f.absPath);
    if (!content) continue;
    if (f.relPath.includes('/COMMITS/') && isDeployCommit(content)) continue;

    const lower = content.toLowerCase();
    // Weight occurrences by term length so distinctive terms ("didqube")
    // outrank short generic ones that survive the stopword filter.
    const score = terms.reduce((acc, t) => acc + (lower.split(t).length - 1) * t.length, 0);
    if (score === 0) continue;

    const lines = content.split('\n');
    const excerptLine = lines.find((l) => terms.some((t) => l.toLowerCase().includes(t)));
    const packRelPath = `${f.packName}/${f.relPath}`;
    results.push({
      packRelPath,
      excerpt: (excerptLine || lines[0] || '').slice(0, 400).trim(),
      score,
      status: classifyStatus(f.relPath, content),
      githubUrl: buildGithubUrl(f.packName, f.relPath),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Pull the most recent substantive commits from aigency index.json. */
export function getRecentCommits(limit = 10): Array<Record<string, string>> {
  try {
    const raw = readPackFile(path.join(AIGENCY_ROOT, 'index.json'));
    if (!raw) return [];
    const idx = JSON.parse(raw);
    const history: Array<Record<string, string>> = idx.commit_history || [];
    return history
      .filter((c) => c.type !== 'deploy')
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Format search results as a markdown context block for an LLM system prompt.
 * Structured docs (architecture / knowledge / repos / decisions / changelog)
 * get expanded to up to `structuredCharLimit` chars; everything else keeps
 * its single-line excerpt.
 */
export function buildCodexExcerptsBlock(
  searchResults: SearchResult[],
  structuredCharLimit = 1200,
): string {
  if (searchResults.length === 0) return '';

  const block = searchResults
    .map((r) => {
      const isStructured =
        r.packRelPath.includes('/architecture/') ||
        r.packRelPath.includes('/knowledge/') ||
        r.packRelPath.includes('/repos/') ||
        r.packRelPath.includes('/build_/decisions') ||
        r.packRelPath.includes('/build_/changelog');

      // For structured docs, include full content up to the char limit
      let body = r.excerpt;
      if (isStructured) {
        const [packName, ...rest] = r.packRelPath.split('/');
        const packRoot = packName === 'agentiq' ? AGENTIQ_ROOT : AIGENCY_ROOT;
        const full = readPackFile(path.join(packRoot, rest.join('/')));
        body = full
          ? full.slice(0, structuredCharLimit) + (full.length > structuredCharLimit ? '\n...[truncated]' : '')
          : r.excerpt;
      }

      return `### [${r.packRelPath}](${r.githubUrl}) \`[${r.status}]\`\n${body}`;
    })
    .join('\n\n');

  return `## Relevant Codex Excerpts\n\n${block}`;
}

/** Format recent commits as a markdown context block. */
export function buildRecentCommitsBlock(recentCommits: Array<Record<string, string>>): string {
  if (recentCommits.length === 0) return '';
  const rows = recentCommits
    .map((c) => `- \`${c.sha}\` ${c.timestamp?.slice(0, 10)} [${c.type}] ${c.title} (${c.author})`)
    .join('\n');
  return `## Recent Dev Commits (last ${recentCommits.length}, excluding deploy triggers)\n\n${rows}`;
}
