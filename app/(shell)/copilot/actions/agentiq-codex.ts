/**
 * AgentiQ Codex Actions
 *
 * Provides Aigent Z access to the engineering knowledge base at
 * codexes/packs/aigency/ — the platform's canonical source of truth
 * for architecture, decisions, PR history, and problem logs.
 *
 * Distinct from codex.ts which serves content/story universes (metaKnyts,
 * Qriptopian) via Supabase embeddings. These actions read the flat markdown
 * files that make up the AgentiQ Codex directly from the filesystem.
 */

import { Action } from "@copilotkit/shared";
import * as path from "path";
import {
  ensureCorpusHydrated,
  corpusReadFile,
  corpusListMarkdown,
} from "@/services/knowledge/packCorpusStore";

const CODEX_ROOT = path.join(process.cwd(), "codexes/packs/aigency");
const ITEMS_ROOT = path.join(CODEX_ROOT, "items");

/** Read a codex file via the pack-corpus seam (local FS in dev; remote in the
 *  SSR Lambda). Each action handler awaits ensureCorpusHydrated() first. */
function readCodexFile(relPath: string): string | null {
  const abs = path.join(CODEX_ROOT, relPath);
  if (!abs.startsWith(CODEX_ROOT)) return null; // traversal guard
  return corpusReadFile(abs);
}

/** List all .md files recursively under a directory, relative to `base`. */
function listMarkdownFiles(dir: string, base = CODEX_ROOT): string[] {
  return corpusListMarkdown(dir, base);
}

/** Simple keyword search across all codex markdown files. */
function keywordSearch(
  query: string,
  limit: number
): Array<{ path: string; excerpt: string; score: number }> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const files = listMarkdownFiles(ITEMS_ROOT);
  const results: Array<{ path: string; excerpt: string; score: number }> = [];

  for (const relPath of files) {
    const content = readCodexFile(`items/${relPath.replace(/^items\//, "")}`);
    if (!content) continue;
    const lower = content.toLowerCase();
    const score = terms.reduce(
      (acc, t) => acc + (lower.split(t).length - 1),
      0
    );
    if (score === 0) continue;

    // Find the first matching line as excerpt
    const lines = content.split("\n");
    const excerptLine = lines.find((l) =>
      terms.some((t) => l.toLowerCase().includes(t))
    );
    results.push({
      path: `items/${relPath}`,
      excerpt: (excerptLine || lines[0] || "").slice(0, 200).trim(),
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Return true if a commit brief file is a deploy-trigger (no meaningful content). */
function isDeployCommit(content: string): boolean {
  return /\|\s*Type\s*\|\s*`deploy`/.test(content);
}

/**
 * Search the AgentiQ Codex (engineering KB) by keyword.
 */
const agentiq_codex_search: Action<any> = {
  name: "agentiq_codex_search",
  description:
    "Search the AgentiQ Codex — Aigent Z's engineering knowledge base — for architecture, decisions, PR history, problem logs, system map, and platform documentation. Use this for questions about how the platform works, what changed recently, or why the system is shaped the way it is.",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Natural language search query",
      required: true,
    },
    {
      name: "section",
      type: "string",
      description:
        "Optional: narrow search to a section. One of: architecture, build, knowledge, repos, memory, tutorials",
      required: false,
    },
    {
      name: "limit",
      type: "number",
      description: "Max results (default: 5)",
      required: false,
    },
    {
      name: "exclude_deploy_triggers",
      type: "boolean",
      description:
        "Skip commit briefs that are deploy triggers (type: deploy) with no substantive code content. Default: true. Set to false only if you specifically want to see deploy history.",
      required: false,
    },
  ],
  handler: async ({ query, section, limit = 5, exclude_deploy_triggers = true }) => {
    await ensureCorpusHydrated();
    try {
      let searchRoot = ITEMS_ROOT;
      if (section) {
        const sectionMap: Record<string, string> = {
          architecture: "architecture",
          build: "build_",
          knowledge: "knowledge",
          repos: "repos",
          memory: "memory",
          tutorials: "tutorials",
        };
        const dir = sectionMap[section.toLowerCase()];
        if (dir) searchRoot = path.join(ITEMS_ROOT, dir);
      }

      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);
      const files = listMarkdownFiles(searchRoot);
      const results: Array<{ path: string; excerpt: string; score: number }> =
        [];

      for (const relPath of files) {
        const fullRelPath = path.relative(
          CODEX_ROOT,
          path.join(searchRoot, relPath)
        );
        const content = readCodexFile(fullRelPath);
        if (!content) continue;
        // Skip deploy-trigger commit briefs unless caller explicitly wants them
        if (
          exclude_deploy_triggers &&
          fullRelPath.includes("build_/COMMITS/") &&
          isDeployCommit(content)
        ) {
          continue;
        }
        const lower = content.toLowerCase();
        const score = terms.reduce(
          (acc, t) => acc + (lower.split(t).length - 1),
          0
        );
        if (score === 0) continue;
        const lines = content.split("\n");
        const excerptLine = lines.find((l) =>
          terms.some((t) => l.toLowerCase().includes(t))
        );
        results.push({
          path: fullRelPath,
          excerpt: (excerptLine || lines[0] || "").slice(0, 300).trim(),
          score,
        });
      }

      const sorted = results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        success: true,
        query,
        results: sorted,
        count: sorted.length,
        hint: sorted.length > 0
          ? "Use agentiq_codex_get to retrieve the full content of any result."
          : "No matches found. Try broader terms or a different section.",
      };
    } catch (error) {
      console.error("[AgentiQ Codex] search error:", error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Retrieve the full content of a specific AgentiQ Codex file.
 */
const agentiq_codex_get: Action<any> = {
  name: "agentiq_codex_get",
  description:
    "Retrieve the full content of a specific file in the AgentiQ Codex. Use paths returned by agentiq_codex_search or agentiq_codex_list_prs.",
  parameters: [
    {
      name: "path",
      type: "string",
      description:
        "Relative path within the codex pack, e.g. 'items/architecture/system-map.md' or 'items/build_/PR/PR-42.md'",
      required: true,
    },
  ],
  handler: async ({ path: relPath }) => {
    await ensureCorpusHydrated();
    try {
      const content = readCodexFile(relPath);
      if (content === null) {
        return { success: false, error: `File not found: ${relPath}` };
      }
      return { success: true, path: relPath, content };
    } catch (error) {
      console.error("[AgentiQ Codex] get error:", error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * List recent PR briefs from the AgentiQ Codex index.
 */
const agentiq_codex_list_prs: Action<any> = {
  name: "agentiq_codex_list_prs",
  description:
    "List recent merged PRs from the AgentiQ Codex index, including which ones contain decision notes or problem logs.",
  parameters: [
    {
      name: "limit",
      type: "number",
      description: "Max number of PRs to return (default: 10)",
      required: false,
    },
  ],
  handler: async ({ limit = 10 }) => {
    await ensureCorpusHydrated();
    try {
      const indexContent = readCodexFile("index.json");
      if (!indexContent) {
        return {
          success: true,
          prs: [],
          message: "No PR history yet — index.json not found.",
        };
      }
      const index = JSON.parse(indexContent);
      const history = (index.pr_history || []).slice(0, limit);
      return {
        success: true,
        latest_pr: index.latest_pr,
        last_updated: index.last_updated,
        prs: history,
        count: history.length,
      };
    } catch (error) {
      console.error("[AgentiQ Codex] list PRs error:", error);
      return { success: false, error: String(error) };
    }
  },
};

/**
 * List recent direct-push commits from the AgentiQ Codex index.
 * By default excludes deploy triggers so results reflect substantive work.
 */
const agentiq_codex_list_commits: Action<any> = {
  name: "agentiq_codex_list_commits",
  description:
    "List recent commits pushed directly to dev (non-PR work) from the AgentiQ Codex index. Use this to understand what was built outside the formal PR process. Excludes deploy triggers by default.",
  parameters: [
    {
      name: "limit",
      type: "number",
      description: "Max number of commits to return (default: 20)",
      required: false,
    },
    {
      name: "type_filter",
      type: "string",
      description:
        "Optional: filter by commit type. One of: feat, fix, refactor, chore, docs, revert, deploy, push. Omit for all types.",
      required: false,
    },
    {
      name: "exclude_deploy_triggers",
      type: "boolean",
      description:
        "Exclude deploy-trigger commits (type: deploy) that contain no code changes. Default: true.",
      required: false,
    },
  ],
  handler: async ({ limit = 20, type_filter, exclude_deploy_triggers = true }) => {
    await ensureCorpusHydrated();
    try {
      const indexContent = readCodexFile("index.json");
      if (!indexContent) {
        return {
          success: true,
          commits: [],
          message: "No commit history yet — index.json not found.",
        };
      }
      const index = JSON.parse(indexContent);
      let history: Array<Record<string, string>> = index.commit_history || [];

      if (exclude_deploy_triggers) {
        history = history.filter((c) => c.type !== "deploy");
      }
      if (type_filter) {
        history = history.filter(
          (c) => c.type === type_filter.toLowerCase()
        );
      }

      const page = history.slice(0, limit);
      return {
        success: true,
        latest_commit: index.latest_commit_short,
        latest_commit_title: index.latest_commit_title,
        last_updated: index.last_updated,
        commits: page,
        count: page.length,
        total_in_index: history.length,
        hint: "Use agentiq_codex_get with a brief path to read the full details of any commit.",
      };
    } catch (error) {
      console.error("[AgentiQ Codex] list commits error:", error);
      return { success: false, error: String(error) };
    }
  },
};

export const agentiqCodexActions = [
  agentiq_codex_search,
  agentiq_codex_get,
  agentiq_codex_list_prs,
  agentiq_codex_list_commits,
];
