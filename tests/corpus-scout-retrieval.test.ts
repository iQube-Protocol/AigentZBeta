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
import { retrieveArtifact, sniffMagicBytes, urlLooksLikePdf } from '@/services/corpusScout/retrieval';

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
