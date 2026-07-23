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
 * Manual same-or-cross-host redirect follower shared by `retrieveArtifact`
 * (artifact bytes) and the Constitutional Discovery amendment's Agent B/C
 * institution navigator (`institutionNavigator.ts`, HTML link discovery) —
 * one redirect-following mechanic, two different consumers of the final
 * response (Extend, Don't Duplicate). Never throws; aborts after
 * `timeoutMs` and caps at `maxRedirects`.
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(currentUrl, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT, Accept: opts.accept ?? '*/*' },
        });
      } finally {
        clearTimeout(timer);
      }

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
