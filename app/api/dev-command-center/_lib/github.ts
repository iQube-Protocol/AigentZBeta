/**
 * Read-only GitHub access for the Dev Command Center tool viewports (Terminal
 * `repo …` + the GitHub layout). CFS-020 CDE.
 *
 * Configuration is MIRRORED from the existing aigentiq write-doc route
 * (app/api/codex/chat/aigentiq/write-doc/route.ts) — the same
 * `process.env.GITHUB_TOKEN` and `process.env.GITHUB_REPOSITORY ||
 * "iQube-Protocol/AigentZBeta"` source. Owner/repo are NEVER hardcoded or
 * guessed here beyond that exact fallback; the token is server-side env only
 * and NEVER travels to the client (this module is imported only by API routes).
 *
 * Every operation is read-only (GET). There is no create/update/delete surface.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// Same source + fallback as the aigentiq write-doc route.
export const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'iQube-Protocol/AigentZBeta';
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
// Read against the dev branch (the deploy branch — matches write-doc's ?ref=dev).
export const GITHUB_REF = 'dev';

/** True when GITHUB_TOKEN is present. */
export function githubConfigured(): boolean {
  return Boolean(GITHUB_TOKEN);
}

/** The env var name the operator must set when unconfigured (honest degradation). */
export const GITHUB_MISSING_ENV = 'GITHUB_TOKEN';

export interface GhResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/** Hard deadline for a GitHub API call — the viewport degrades honestly rather
 * than hanging on a slow/unreachable api.github.com (CDE hang fix, 2026-07-08). */
const GH_TIMEOUT_MS = 8000;

async function ghGet<T>(pathAndQuery: string): Promise<GhResult<T>> {
  if (!GITHUB_TOKEN) {
    return { ok: false, status: 0, error: `${GITHUB_MISSING_ENV} not configured on this server` };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${pathAndQuery}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `GitHub API ${res.status} ${res.statusText}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      error: aborted ? `GitHub API timed out after ${GH_TIMEOUT_MS}ms — unavailable` : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface GhBranch {
  name: string;
  commitSha: string;
}

export async function ghListBranches(limit = 50): Promise<GhResult<GhBranch[]>> {
  const r = await ghGet<Array<{ name: string; commit: { sha: string } }>>(
    `/branches?per_page=${Math.min(Math.max(limit, 1), 100)}`,
  );
  if (!r.ok || !r.data) return { ok: r.ok, status: r.status, error: r.error };
  return {
    ok: true,
    status: r.status,
    data: r.data.map((b) => ({ name: b.name, commitSha: b.commit?.sha?.slice(0, 8) ?? '' })),
  };
}

export interface GhCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export async function ghRecentCommits(limit = 15): Promise<GhResult<GhCommit[]>> {
  const r = await ghGet<
    Array<{
      sha: string;
      commit: { message: string; author: { name?: string; date?: string } };
      author: { login?: string } | null;
    }>
  >(`/commits?sha=${GITHUB_REF}&per_page=${Math.min(Math.max(limit, 1), 100)}`);
  if (!r.ok || !r.data) return { ok: r.ok, status: r.status, error: r.error };
  return {
    ok: true,
    status: r.status,
    data: r.data.map((c) => ({
      sha: c.sha.slice(0, 8),
      message: (c.commit?.message ?? '').split('\n')[0].slice(0, 120),
      author: c.author?.login || c.commit?.author?.name || 'unknown',
      date: (c.commit?.author?.date ?? '').slice(0, 10),
    })),
  };
}

export interface GhPull {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  headRef: string;
}

export async function ghOpenPulls(limit = 30): Promise<GhResult<GhPull[]>> {
  const r = await ghGet<
    Array<{
      number: number;
      title: string;
      user: { login?: string } | null;
      updated_at: string;
      head: { ref?: string };
    }>
  >(`/pulls?state=open&per_page=${Math.min(Math.max(limit, 1), 100)}`);
  if (!r.ok || !r.data) return { ok: r.ok, status: r.status, error: r.error };
  return {
    ok: true,
    status: r.status,
    data: r.data.map((p) => ({
      number: p.number,
      title: (p.title ?? '').slice(0, 140),
      author: p.user?.login ?? 'unknown',
      updatedAt: (p.updated_at ?? '').slice(0, 10),
      headRef: p.head?.ref ?? '',
    })),
  };
}

export interface GhTreeEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
}

/** List a directory (empty path = repo root) on the dev branch. */
export async function ghTree(path = ''): Promise<GhResult<GhTreeEntry[]>> {
  const clean = path.replace(/^\/+/, '');
  const r = await ghGet<
    Array<{ name: string; type: string; path: string }> | { name: string; type: string; path: string }
  >(`/contents/${encodeURI(clean)}?ref=${GITHUB_REF}`);
  if (!r.ok || r.data === undefined) return { ok: r.ok, status: r.status, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : [r.data];
  return {
    ok: true,
    status: r.status,
    data: arr
      .map((e) => ({ name: e.name, type: e.type === 'dir' ? ('dir' as const) : ('file' as const), path: e.path }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)),
  };
}

export interface GhFile {
  path: string;
  /** Decoded UTF-8 text (empty when unavailable — see `note`). */
  text: string;
  note: string | null;
}

/** Read a file's decoded text on the dev branch. */
export async function ghFile(path: string): Promise<GhResult<GhFile>> {
  const clean = path.replace(/^\/+/, '');
  const r = await ghGet<{ type: string; encoding?: string; content?: string; size?: number }>(
    `/contents/${encodeURI(clean)}?ref=${GITHUB_REF}`,
  );
  if (!r.ok || !r.data) return { ok: r.ok, status: r.status, error: r.error };
  if (r.data.type !== 'file') {
    return { ok: false, status: r.status, error: `${clean} is not a file (it is a ${r.data.type})` };
  }
  // Files > 1MB return empty content from the contents API (blob API required).
  if (r.data.encoding !== 'base64' || !r.data.content) {
    return {
      ok: true,
      status: r.status,
      data: { path: clean, text: '', note: 'file too large to inline via the contents API (>1MB)' },
    };
  }
  const text = Buffer.from(r.data.content, 'base64').toString('utf8');
  return { ok: true, status: r.status, data: { path: clean, text, note: null } };
}
