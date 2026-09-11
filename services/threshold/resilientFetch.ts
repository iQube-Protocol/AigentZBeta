/**
 * resilientFetch.ts — shared bounded-retry JSON/text fetch for Threshold
 * Gateway adapters that make server-to-server calls against this app's own
 * public routes (same-origin, no external network). Extracted from
 * irlAdapter.ts (2026-09-03) so a second adapter (publicKnowledge.ts) reuses
 * the exact same resiliency behavior instead of forking it — CLAUDE.md
 * "Extend, Don't Duplicate".
 *
 * Read the body EXACTLY ONCE: `res.json()` then a `res.text()` fallback
 * consumes the stream twice and silently nulls a raw-markdown response (the
 * bug this shape fixed for /api/public/irl/doc, Austin QA ①a, 2026-07-22).
 */

export interface ResilientFetchResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function resilientFetch(
  url: string,
  init?: RequestInit,
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<ResilientFetchResult> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 9000;
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
      clearTimeout(timer);
      lastStatus = res.status;
      // Retry only on transient server errors; 4xx is a real answer, don't retry.
      if (res.status >= 500 && attempt < retries) continue;
      const rawText = await res.text().catch(() => null);
      const ct = res.headers.get('content-type') || '';
      let body: unknown = rawText;
      if (rawText != null && (ct.includes('application/json') || ct.includes('+json'))) {
        try {
          body = JSON.parse(rawText);
        } catch {
          body = rawText;
        }
      }
      return { ok: res.ok, status: res.status, body };
    } catch {
      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
    }
  }
  return { ok: false, status: lastStatus || 0, body: null };
}
