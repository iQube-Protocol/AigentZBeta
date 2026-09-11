/**
 * Regression canary for the OAuth token-endpoint body parser (PRD-THR-001 §6).
 *
 * The first live crossing failed because request.formData() silently returned
 * nothing for the urlencoded token body, 400-ing every exchange. This locks the
 * form-encoded path (the OAuth 2.1 default) plus JSON, so that exact failure
 * cannot recur.
 */

import { describe, it, expect } from 'vitest';
import { parseOAuthBody } from '../services/threshold/oauthBody';

describe('parseOAuthBody', () => {
  it('parses application/x-www-form-urlencoded (the OAuth token default)', () => {
    const raw = 'grant_type=authorization_code&code=thac_abc&code_verifier=v123&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback';
    const p = parseOAuthBody('application/x-www-form-urlencoded', raw);
    expect(p.grant_type).toBe('authorization_code');
    expect(p.code).toBe('thac_abc');
    expect(p.code_verifier).toBe('v123');
    expect(p.redirect_uri).toBe('https://claude.ai/api/mcp/auth_callback'); // decoded
  });

  it('parses application/json', () => {
    const p = parseOAuthBody('application/json', JSON.stringify({ grant_type: 'authorization_code', code: 'x' }));
    expect(p.grant_type).toBe('authorization_code');
    expect(p.code).toBe('x');
  });

  it('treats a missing content-type as urlencoded and never throws', () => {
    expect(parseOAuthBody('', 'a=1&b=2')).toEqual({ a: '1', b: '2' });
    expect(parseOAuthBody('application/json', 'not json')).toEqual({});
    expect(parseOAuthBody('', '')).toEqual({});
  });
});
