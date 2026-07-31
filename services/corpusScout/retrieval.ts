/**
 * Corpus Scout (PRD-ICA-001) — Retrieval Agent (§10 agent D) + the byte-level
 * MIME check that belongs alongside it (§7).
 *
 * `retrieveArtifact()` itself still only fetches ONE URL (following same-URL
 * redirects, never cross-page link traversal) — it validates and hashes
 * bytes, it does not discover them. Multi-hop discovery (institution page ->
 * publication listing -> download link -> final artifact) is the
 * Constitutional Discovery amendment's Agent B/C, built in
 * `institutionNavigator.ts`, which resolves a final document URL via HTML
 * link-following and then calls `retrieveArtifact(documentUrl, seedUrl)` —
 * same validation path, an honest `discoveryUrl` recorded on the chain.
 *
 * `followRedirects()` below is the shared redirect-following mechanic both
 * modules use (evaluated per PRD-ICA-001 §0.4: a dedicated lightweight
 * fetch, not `services/aa-api/src/browser/*`'s interactive session/mount/
 * takeover machinery, which is built for user-facing live browsing, not a
 * bounded backend HTML-link crawl).
 *
 * Never throws — every failure path returns a structured RetrievalResult
 * (PRD-ICA-001 §12). Uses Node's built-in `fetch` (no axios/node-fetch dep).
 */

import { createHash } from 'crypto';
import type { RetrievalResult, RetrievalFailureClass, ResolutionChain } from './types';

const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
export const USER_AGENT = 'CorpusScout/1.0 (+metaMe IRL invariant corpus acquisition; PRD-ICA-001)';

export type FollowRedirectsFailure = 'timeout' | 'redirect-loop' | 'unknown';

/**
 * HTTP statuses that signal a TRANSIENT condition on the remote end (rate
 * limiting, gateway/upstream trouble) rather than a judgment about the URL
 * itself — worth retrying, unlike a 404 or 403. Shared by every caller of
 * `followRedirects` (retrieval, institution navigation, registry
 * verification) so "what counts as transient" is answered in exactly one
 * place (operator-approved fix, 2026-07-28: "World Bank hit two 504s and
 * lost both attempts").
 */
export const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/** Bounded: 3 total attempts (1 initial + 2 retries) per outbound fetch — a
 *  deliberately SMALL ceiling, not an open-ended increase (operator: "bounded
 *  retry, not an open-ended increase"). Enough to survive a single transient
 *  blip (the World Bank 504 case) without turning a genuinely dead source
 *  into a long hang; `TIMEOUT_MS` already bounds each individual attempt, so
 *  the worst case stays `3 × TIMEOUT_MS` plus two short backoff waits. */
const MAX_FETCH_ATTEMPTS = 3;
/** Exponential backoff between attempts: 400ms, then 800ms. */
const RETRY_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ONE raw `fetch`, retried with exponential backoff — but ONLY on a TRANSIENT
 * failure: a network-level abort/timeout, or a response carrying a
 * `TRANSIENT_HTTP_STATUSES` code. A DEFINITIVE outcome (success, or a
 * permanent status like 404/403, or a non-abort exception such as DNS
 * failure) returns immediately on the first attempt and spends no retry —
 * retrying a dead host would not help, and the operator was explicit this is
 * "bounded retry, not an open-ended increase" for genuinely transient
 * conditions only. This is the ONE place the retry policy lives —
 * `followRedirects` calls it for every hop, so `retrieveArtifact`,
 * `institutionNavigator.ts`'s page fetches, and `registryVerification.ts`'s
 * seed-URL resolution all inherit it without a second implementation
 * (Extend, Don't Duplicate).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; response: Response } | { ok: false; aborted: boolean }> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (TRANSIENT_HTTP_STATUSES.has(res.status) && attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return { ok: true, response: res };
    } catch (e) {
      clearTimeout(timer);
      const isAbort = e instanceof Error && e.name === 'AbortError';
      if (isAbort && attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      // A non-abort exception (DNS failure, connection refused, …) is not
      // transient — fail on the first occurrence rather than spending the
      // retry budget on a host that isn't coming back.
      return { ok: false, aborted: isAbort };
    }
  }
  // Unreachable — the loop always returns on its final iteration — but kept
  // for TypeScript's control-flow analysis.
  return { ok: false, aborted: false };
}

/**
 * Manual same-or-cross-host redirect follower shared by `retrieveArtifact`
 * (artifact bytes) and the Constitutional Discovery amendment's Agent B/C
 * institution navigator (`institutionNavigator.ts`, HTML link discovery) —
 * one redirect-following mechanic, two different consumers of the final
 * response (Extend, Don't Duplicate). Never throws; aborts after
 * `timeoutMs` PER ATTEMPT and caps at `maxRedirects` hops. Each hop's raw
 * fetch is bounded-retried on a transient failure via `fetchWithRetry` — a
 * single 429/502/503/504 or timeout no longer costs the whole acquisition
 * attempt; only exhausting all `MAX_FETCH_ATTEMPTS` does.
 */
export async function followRedirects(
  url: string,
  opts: { timeoutMs?: number; maxRedirects?: number; accept?: string } = {},
): Promise<
  | { ok: true; response: Response; finalUrl: string; redirectCount: number }
  | { ok: false; failureClass: FollowRedirectsFailure; redirectCount: number; finalUrl: string }
> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  let currentUrl = url;
  let redirectCount = 0;

  try {
    for (;;) {
      const attempt = await fetchWithRetry(
        currentUrl,
        { redirect: 'manual', headers: { 'User-Agent': USER_AGENT, Accept: opts.accept ?? '*/*' } },
        timeoutMs,
      );
      if (!attempt.ok) {
        return { ok: false, failureClass: attempt.aborted ? 'timeout' : 'unknown', redirectCount, finalUrl: currentUrl };
      }
      const res = attempt.response;

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return { ok: false, failureClass: 'unknown', redirectCount, finalUrl: currentUrl };
        redirectCount += 1;
        if (redirectCount > maxRedirects) return { ok: false, failureClass: 'redirect-loop', redirectCount, finalUrl: currentUrl };
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return { ok: true, response: res, finalUrl: currentUrl, redirectCount };
    }
  } catch (e) {
    const isAbort = e instanceof Error && e.name === 'AbortError';
    return { ok: false, failureClass: isAbort ? 'timeout' : 'unknown', redirectCount, finalUrl: currentUrl };
  }
}

/** A `.pdf`-looking URL is not sufficient proof of a valid PDF (PRD-ICA-001
 *  §7's explicit non-goal) — used only as one signal in the mismatch check,
 *  never alone to accept a file. */
export function urlLooksLikePdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
  }
}

/** Byte-level signature check (magic bytes), never inferred from the URL or
 *  the declared Content-Type alone. */
export function sniffMagicBytes(bytes: Buffer): { isPdf: boolean; isHtml: boolean } {
  const isPdf = bytes.subarray(0, 5).toString('latin1') === '%PDF-';

  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3; // UTF-8 BOM
  const sample = bytes.subarray(start, start + 1024).toString('utf8');
  const trimmed = sample.replace(/^\s+/, '');
  const lower = trimmed.toLowerCase();
  const isHtml = lower.startsWith('<!doctype') || lower.startsWith('<html') || trimmed.startsWith('<');

  return { isPdf, isHtml };
}

function failure(failureClass: RetrievalFailureClass, resolutionChain: ResolutionChain): RetrievalResult {
  return {
    ok: false,
    contentType: null,
    declaredMimeMismatch: failureClass === 'mime-mismatch',
    artifactHash: null,
    fileSizeBytes: 0,
    failureClass,
    resolutionChain,
  };
}

/**
 * Fetch a direct document URL. Follows at most MAX_REDIRECTS same-host-or-not
 * redirects manually (so redirectCount is honestly counted), aborts after
 * TIMEOUT_MS, and never throws. Computes sha256 of the raw retrieved bytes
 * and flags a MIME mismatch when a `.pdf`-looking URL (or a `Content-Type`
 * claiming PDF) actually returns HTML bytes.
 */
export async function retrieveArtifact(url: string, discoveryUrl?: string): Promise<RetrievalResult> {
  const resolutionChain: ResolutionChain = {
    discoveryUrl: discoveryUrl ?? url,
    downloadUrl: url,
    resolvedArtifactUrl: url,
    redirectCount: 0,
  };

  const followed = await followRedirects(url);
  resolutionChain.redirectCount = followed.redirectCount;
  resolutionChain.resolvedArtifactUrl = followed.finalUrl;
  if (!followed.ok) return failure(followed.failureClass, resolutionChain);
  const response = followed.response;

  if (response.status === 401) return failure('login-required', resolutionChain);
  if (response.status === 402) return failure('paywall', resolutionChain);
  if (response.status === 403 || response.status === 404) return failure('access-denied', resolutionChain);
  if (!response.ok) return failure('unknown', resolutionChain);

  const contentType = response.headers.get('content-type');
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await response.arrayBuffer());
  } catch {
    return failure('corrupted-file', resolutionChain);
  }
  if (bytes.length === 0) return failure('empty-artifact', resolutionChain);

  const artifactHash = createHash('sha256').update(bytes).digest('hex');
  const { isPdf, isHtml } = sniffMagicBytes(bytes);
  const expectsPdf = urlLooksLikePdf(followed.finalUrl) || Boolean(contentType?.toLowerCase().includes('pdf'));

  // The explicit PRD-ICA-001 §7 case: a `.pdf`-looking URL / declared PDF
  // content-type that is actually an HTML body (landing page, error page,
  // login wall rendered as 200). Flagged, never treated as a valid artifact.
  if (expectsPdf && !isPdf && isHtml) {
    return {
      ok: false,
      bytes,
      contentType,
      declaredMimeMismatch: true,
      artifactHash,
      fileSizeBytes: bytes.length,
      failureClass: 'mime-mismatch',
      resolutionChain,
    };
  }

  return {
    ok: true,
    bytes,
    contentType,
    declaredMimeMismatch: false,
    artifactHash,
    fileSizeBytes: bytes.length,
    resolutionChain,
  };
}
