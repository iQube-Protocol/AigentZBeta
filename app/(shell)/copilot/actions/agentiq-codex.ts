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
import * as fs from "fs";
import * as path from "path";

const CODEX_ROOT = path.join(process.cwd(), "codexes/packs/aigency");
const ITEMS_ROOT = path.join(CODEX_ROOT, "items");

/** Read a codex file safely. */
function readCodexFile(relPath: string): string | null {
  try {
    const abs = path.join(CODEX_ROOT, relPath);
    // Prevent path traversal outside the codex root
    if (!abs.startsWith(CODEX_ROOT)) return null;
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/** List all .md files recursively under a directory. */
function listMarkdownFiles(dir: string, base = CODEX_ROOT): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listMarkdownFiles(full, base));
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
        results.push(path.relative(base, full));
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
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
  ],
  handler: async ({ query, section, limit = 5 }) => {
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

export const agentiqCodexActions = [
  agentiq_codex_search,
  agentiq_codex_get,
  agentiq_codex_list_prs,
];
