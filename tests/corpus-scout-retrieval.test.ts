/**
 * Corpus Scout (PRD-ICA-001) Retrieval Agent canaries.
 *
 * Pins the explicit PRD-ICA-001 §7 non-goal: "A `.pdf`-looking URL is not
 * sufficient proof of a valid PDF" — an HTML body served at a `.pdf` URL (or
 * under a declared `application/pdf` Content-Type) must be flagged
 * `mime-mismatch` and never treated as a valid retrieved artifact, whatever
 * the URL or header claims.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { retrieveArtifact, sniffMagicBytes, urlLooksLikePdf, followRedirects, TRANSIENT_HTTP_STATUSES } from '@/services/corpusScout/retrieval';

function mockResponse(body: string, opts: { status?: number; contentType?: string | null } = {}): Response {
  const status = opts.status ?? 200;
  const headers = new Headers();
  if (opts.contentType !== null) headers.set('content-type', opts.contentType ?? 'application/octet-stream');
  const buf = Buffer.from(body, 'utf8');
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as Response;
}

describe('sniffMagicBytes / urlLooksLikePdf — byte-level, not URL-inferred', () => {
  it('detects a real PDF by its %PDF- magic bytes', () => {
    expect(sniffMagicBytes(Buffer.from('%PDF-1.4\n%rest of a real pdf')).isPdf).toBe(true);
  });

  it('detects HTML by a leading <!DOCTYPE or <html', () => {
    expect(sniffMagicBytes(Buffer.from('<!DOCTYPE html><html></html>')).isHtml).toBe(true);
    expect(sniffMagicBytes(Buffer.from('   <html><body>hi</body></html>')).isHtml).toBe(true);
  });

  it('a .pdf-looking URL is only a hint, never proof — urlLooksLikePdf is extension-only', () => {
    expect(urlLooksLikePdf('https://example.com/report.pdf')).toBe(true);
    expect(urlLooksLikePdf('https://example.com/report.pdf?dl=1')).toBe(true);
    expect(urlLooksLikePdf('https://example.com/report.html')).toBe(false);
  });
});

describe('retrieveArtifact — MIME mismatch is flagged, never accepted as valid (PRD-ICA-001 §7)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flags an HTML error/landing page served at a .pdf-looking URL', async () => {
    const html = '<!DOCTYPE html><html><head><title>Not Found</title></head><body>404</body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(html, { contentType: 'text/html; charset=utf-8' })));

    const result = await retrieveArtifact('https://example.com/whitepaper.pdf');

    expect(result.ok).toBe(false);
    expect(result.declaredMimeMismatch).toBe(true);
    expect(result.failureClass).toBe('mime-mismatch');
    // Bytes were retrieved and hashed for the audit trail even though the
    // content failed verification — a failed acquisition is recorded, never
    // silently dropped (PRD-ICA-001 §12).
    expect(result.artifactHash).toBeTruthy();
  });

  it('flags an HTML body even when the server DECLARES Content-Type: application/pdf', async () => {
    const html = '<!DOCTYPE html><html><body>Please log in to continue</body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(html, { contentType: 'application/pdf' })));

    const result = await retrieveArtifact('https://example.com/download?id=42');

    expect(result.ok).toBe(false);
    expect(result.declaredMimeMismatch).toBe(true);
    expect(result.failureClass).toBe('mime-mismatch');
  });

  it('accepts a genuine PDF at a .pdf URL (no false-positive mismatch)', async () => {
    const pdf = '%PDF-1.4\n' + 'x'.repeat(200);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(pdf, { contentType: 'application/pdf' })));

    const result = await retrieveArtifact('https://example.com/whitepaper.pdf');

    expect(result.ok).toBe(true);
    expect(result.declaredMimeMismatch).toBe(false);
    expect(result.artifactHash).toBeTruthy();
    expect(result.fileSizeBytes).toBeGreaterThan(0);
  });

  it('never throws on a network failure — returns a structured failure result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')));

    const result = await retrieveArtifact('https://nonexistent.example/doc.pdf');

    expect(result.ok).toBe(false);
    expect(result.failureClass).toBeDefined();
    expect(result.bytes).toBeUndefined();
  });

  it('flags a zero-byte response body as empty-artifact', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse('', { contentType: 'application/pdf' })));

    const result = await retrieveArtifact('https://example.com/empty.pdf');

    expect(result.ok).toBe(false);
    expect(result.failureClass).toBe('empty-artifact');
  });

  it('flags a 401 as login-required and a 403 as access-denied, never as a valid artifact', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse('', { status: 401, contentType: null })));
    const loginResult = await retrieveArtifact('https://example.com/private.pdf');
    expect(loginResult.ok).toBe(false);
    expect(loginResult.failureClass).toBe('login-required');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse('', { status: 403, contentType: null })));
    const deniedResult = await retrieveArtifact('https://example.com/forbidden.pdf');
    expect(deniedResult.ok).toBe(false);
    expect(deniedResult.failureClass).toBe('access-denied');
  });
});

// ── Bounded retry on transient failures (operator-approved fix, 2026-07-28:
//    "World Bank hit two 504s and lost both attempts") ───────────────────────

describe('followRedirects — bounded retry on TRANSIENT failures only', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the transient-status vocabulary is exactly 429/502/503/504', () => {
    expect([...TRANSIENT_HTTP_STATUSES].sort((a, b) => a - b)).toEqual([429, 502, 503, 504]);
  });

  it('THE CANARY: a 504 followed by success recovers — retries a transient status rather than failing on the first hit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse('', { status: 504, contentType: null }))
      .mockResolvedValueOnce(mockResponse('ok', { status: 200, contentType: 'text/html' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://worldbank.example/report');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries EVERY transient status in the vocabulary (429/502/503/504), not just one', async () => {
    for (const status of [...TRANSIENT_HTTP_STATUSES]) {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse('', { status, contentType: null }))
        .mockResolvedValueOnce(mockResponse('ok', { status: 200, contentType: 'text/html' }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await followRedirects(`https://example.com/${status}`);

      expect(result.ok, `status ${status} must be retried`).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.unstubAllGlobals();
    }
  });

  it('retry is BOUNDED — exactly 3 total attempts, never open-ended', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse('', { status: 503, contentType: null }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://persistent-503.example/report');

    // Retries are exhausted, not endless: the FINAL attempt's (still-bad)
    // response is returned as the outcome — `followRedirects` itself doesn't
    // judge the status, its callers do (registryVerification maps this to
    // `temporarily_unavailable`).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.status).toBe(503);
  });

  it('a genuine timeout/abort is retried, and recovers on a later attempt', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(mockResponse('ok', { status: 200, contentType: 'text/html' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://slow.example/report');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a persistent timeout exhausts retries and reports failureClass "timeout" — never silence', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://always-times-out.example/report');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureClass).toBe('timeout');
  });

  it('a NON-transient failure (e.g. DNS failure) is NOT retried — the retry budget is for transient conditions only', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://nonexistent.example/report');

    expect(fetchMock, 'a permanent DNS failure must fail on the first attempt, not spend the retry budget').toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it('a definitive non-transient status (404) is NOT retried', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse('', { status: 404, contentType: null }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await followRedirects('https://example.com/missing');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true); // followRedirects itself doesn't judge status; the caller does
    if (result.ok) expect(result.response.status).toBe(404);
  });
});
