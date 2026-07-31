/**
 * oauthBody.ts — parse an OAuth request body that may be
 * application/x-www-form-urlencoded (the OAuth 2.1 default for the token
 * endpoint) or application/json.
 *
 * Pure + synchronous over already-read strings so it is unit-testable in
 * isolation. The form-encoded path is the one that regressed: relying on
 * `Request.formData()` for urlencoded bodies silently returned nothing in the
 * Lambda runtime, which 400'd every token exchange during the first live
 * crossing. This helper parses urlencoded with URLSearchParams over the raw text
 * so that failure cannot recur (see tests/threshold-oauth-body.test.ts).
 */

export function parseOAuthBody(contentType: string, raw: string): Record<string, string> {
  if ((contentType ?? '').includes('application/json')) {
    try {
      const j = JSON.parse(raw || '{}') as Record<string, unknown>;
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? '')]));
    } catch {
      return {};
    }
  }
  const sp = new URLSearchParams(raw ?? '');
  const out: Record<string, string> = {};
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}
