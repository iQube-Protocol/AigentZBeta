/**
 * P0.2 — Passport passkey session grant repair (operator ruling, 2026-08-21).
 *
 * ROOT CAUSE, live-evidenced: `issuePassportSession()` minted TWO
 * `generateLink({ type: 'magiclink' })` grants back-to-back for the same
 * email. Direct inspection of the connected project's `auth.one_time_tokens`
 * and `auth.users` proved a `magiclink` grant for an existing user
 * materializes in this project's GoTrue as a single-slot `recovery_token`
 * column, not an append-only store — the second call overwrote the first's
 * token before this function even returned the grant, so the first grant was
 * dead on arrival every time (100% of `/verify` attempts in the live session
 * under test failed with `otp_expired` / "One-time token not found").
 *
 * THE FIX is architectural: `issuePassportSession()` now mints exactly ONE
 * grant. The still-necessary second, application-world grant (the Companion
 * iframe and the top-level app are separate storage partitions) is minted
 * SEQUENTIALLY by `POST /api/passport-connect/handoff-grant`, requested only
 * after the first grant is redeemed and a real Supabase session confirmed.
 *
 * These are structural/source-authority canaries (the
 * tests/_lib/sourceAuthority.ts convention already established by
 * tests/passport-signin-otp-type.test.ts and
 * tests/passport-connection-challenge.test.ts) plus one behavioural canary
 * for the endpoint's own unauthenticated-refusal path, which needs no live
 * Supabase instance to prove.
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { readSource, stripComments } from './_lib/sourceAuthority';
import { POST as handoffGrantPost } from '@/app/api/passport-connect/handoff-grant/route';

const SESSION_ISSUER = 'services/identity/passportSession.ts';
const HANDOFF_ROUTE = 'app/api/passport-connect/handoff-grant/route.ts';
const AUTH_VERIFY_ROUTE = 'app/api/passport/passkey/auth-verify/route.ts';
const FINALIZE_ROUTE = 'app/api/passport-connect/finalize/route.ts';
const COMPANION_PANEL = 'components/companion/PassportConnectPanel.tsx';

describe('P0.2 — issuePassportSession() mints exactly one grant', () => {
  it('exactly one generateLink() call in the session issuer', () => {
    const src = stripComments(readSource(SESSION_ISSUER));
    expect((src.match(/\.generateLink\(/g) ?? []).length).toBe(1);
  });

  it('handoffTokenHash no longer exists anywhere in the session issuer or its type', () => {
    const src = stripComments(readSource(SESSION_ISSUER));
    expect(src).not.toContain('handoffTokenHash');
  });

  it('neither initial-grant response route echoes a pre-minted handoff token', () => {
    for (const path of [AUTH_VERIFY_ROUTE, FINALIZE_ROUTE]) {
      const src = stripComments(readSource(path));
      expect(src, `${path} still returns handoffTokenHash`).not.toContain('handoffTokenHash');
    }
  });
});

describe('P0.2 — POST /api/passport-connect/handoff-grant', () => {
  function makeRequest(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://dev-beta.aigentz.me/api/passport-connect/handoff-grant', {
      method: 'POST',
      headers,
    });
  }

  it('refuses an unauthenticated caller — no Authorization header, no grant', async () => {
    const res = await handoffGrantPost(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('refuses a caller whose Authorization header is not a Bearer token', async () => {
    const res = await handoffGrantPost(makeRequest({ authorization: 'Basic not-a-bearer-token' }));
    expect(res.status).toBe(401);
  });

  it('derives its principal server-side from the verified Bearer session — never from a request body', () => {
    const src = stripComments(readSource(HANDOFF_ROUTE));
    // The route resolves authUserId from Supabase's OWN verification of the
    // bearer, then walks the SAME passport-native principal resolver every
    // other entry point uses — no parallel resolution path
    // (inv.engineering.036/037).
    expect(src).toContain('auth.getUser(');
    expect(src).toContain('resolvePassportPrincipalForAuthUser');
    expect(src).toContain('issuePassportSession');
    // Never a second, hand-rolled generateLink call in this route — the
    // mint itself lives in exactly one place (passportSession.ts).
    expect(src).not.toMatch(/\.generateLink\(/);
    // No request body is parsed at all — there is nothing for a caller to
    // submit that could select a different principal's grant.
    expect(src, 'the route reads a request body').not.toMatch(/request\.json\(\)/);
    for (const forbidden of ['personaId', 'passportId', 'rootDid', 'kybeDid']) {
      expect(src, `the route names a client-suppliable ${forbidden} anchor`).not.toMatch(
        new RegExp(`body\\??\\.${forbidden}`, 'i'),
      );
    }
  });

  it('mints exactly one fresh grant per request and returns only the token hash', () => {
    const src = stripComments(readSource(HANDOFF_ROUTE));
    expect((src.match(/issuePassportSession\(/g) ?? []).length).toBe(1);
    // The success response carries tokenHash and nothing T0/already-disclosed.
    const returnAt = src.indexOf('NextResponse.json({ ok: true, tokenHash:');
    expect(returnAt, 'expected a { ok: true, tokenHash } success response').toBeGreaterThan(-1);
  });
});

describe('P0.2 — the Companion redeems the first grant BEFORE requesting the second', () => {
  it('verifyOtp for the initial grant appears before the handoff-grant fetch, in source order', () => {
    const src = stripComments(readSource(COMPANION_PANEL));
    const verifyAt = src.indexOf('.auth.verifyOtp({');
    const handoffFetchAt = src.indexOf('/api/passport-connect/handoff-grant');
    expect(verifyAt, 'expected a verifyOtp call in the Companion panel').toBeGreaterThan(-1);
    expect(handoffFetchAt, 'expected a fetch to /api/passport-connect/handoff-grant').toBeGreaterThan(-1);
    expect(verifyAt, 'the handoff grant is requested before the initial grant is redeemed').toBeLessThan(
      handoffFetchAt,
    );
  });

  it('the handoff-grant fetch carries the freshly-established session as a Bearer header, not a client-chosen identity', () => {
    const src = stripComments(readSource(COMPANION_PANEL));
    expect(src).toMatch(/Authorization:\s*`Bearer \$\{accessToken\}`/);
    expect(src, "expected the access token to come from the client's own session read").toMatch(
      /auth\.getSession\(\)/,
    );
    // The Bearer literal and the fetch call must be the SAME occurrence, not
    // two unrelated ones elsewhere in this large file.
    const headerAt = src.search(/Authorization:\s*`Bearer \$\{accessToken\}`/);
    const fetchAt = src.lastIndexOf('fetch("/api/passport-connect/handoff-grant"', headerAt);
    expect(fetchAt, 'the Bearer header is not attached to the handoff-grant fetch call').toBeGreaterThan(-1);
    expect(headerAt - fetchAt).toBeLessThan(200);
  });

  it('a handoff-grant failure sets a retry affordance, never an error state that discards the established session', () => {
    const src = stripComments(readSource(COMPANION_PANEL));
    const handoffFetchAt = src.indexOf('/api/passport-connect/handoff-grant');
    const failureBranchAt = src.indexOf('if (!handoffTokenHash)', handoffFetchAt);
    expect(failureBranchAt, 'expected a !handoffTokenHash failure branch after the fetch').toBeGreaterThan(-1);
    const branch = src.slice(failureBranchAt, src.indexOf('return;', failureBranchAt) + 'return;'.length);
    expect(branch).toContain('kind: "connected"');
    expect(branch).toContain('handoffRetry');
    expect(branch, 'a handoff failure must not report an error state').not.toContain('kind: "error"');
  });

  it('the second grant is genuinely distinct — the handoff URL is built from the freshly-fetched hash, never the initial grant.tokenHash', () => {
    const src = stripComments(readSource(COMPANION_PANEL));
    const handoffUrlAt = src.indexOf('const handoffUrl = `/passport-connect/complete?token_hash=');
    expect(handoffUrlAt, 'expected the handoff URL template').toBeGreaterThan(-1);
    const line = src.slice(handoffUrlAt, src.indexOf('`;', handoffUrlAt) + 2);
    expect(line).toContain('handoffTokenHash');
    expect(line, 'the handoff URL must not redeem the initial, already-spent grant').not.toContain('grant.tokenHash');
  });
});
