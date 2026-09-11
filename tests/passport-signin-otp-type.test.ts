/**
 * P0 — Passport sign-in repair (operator ruling, 2026-08-21).
 *
 * ROOT CAUSE. Both client-side session exchanges called
 * `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. 'magiclink'
 * is a valid `GenerateLinkType` for `admin.generateLink()` (server-side mint,
 * services/identity/passportSession.ts) but is NOT a valid `EmailOtpType` for
 * `verifyOtp()` (client-side exchange) against Supabase's current Auth
 * server — the /verify endpoint resolves a magiclink-generated token_hash
 * under the unified 'email' OTP type. Confirmed against Supabase's current
 * passwordless email-login docs (the canonical `/auth/confirm` example uses
 * `type: 'email'` for exactly this token_hash exchange). Every Passport
 * connect (Companion iframe AND the top-level application handoff) exchanges
 * a token minted the same way (`issuePassportSession` in passportSession.ts),
 * so both call sites carried the same defect.
 *
 * These are structural/source-authority canaries (tests/_lib/sourceAuthority.ts
 * convention) — `verifyOtp`/`generateLink` are Supabase network calls with no
 * fake-able return shape worth mocking here; the security-bearing property is
 * which literal `type` value ships in each call, which is a pure source-text
 * property once comments are stripped (a doc comment MUST be free to mention
 * either type without flipping the canary — the historical grep-vs-comment
 * defect class this helper module's own header describes).
 */

import { describe, it, expect } from 'vitest';

import { readSource, stripComments } from './_lib/sourceAuthority';

/**
 * Brace-balanced extraction of the `{ ... }` block starting at the `{` found
 * at or after `fromIndex`. Mirrors the bracket-counting convention in
 * tests/passport-sign-in-hierarchy-and-session-model.test.ts's
 * `extractFunctionBody` — a naive "next `\n  }`" scan overshoots whenever the
 * block's own indentation depth differs from the guess, which is exactly
 * what a fixed-indentation heuristic cannot know across two different files.
 */
function extractBraceBlock(src: string, fromIndex: number): string {
  const braceAt = src.indexOf('{', fromIndex);
  expect(braceAt, `no '{' found from index ${fromIndex}`).toBeGreaterThan(-1);
  let depth = 1;
  for (let i = braceAt + 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(braceAt, i + 1);
    }
  }
  throw new Error(`unbalanced braces from index ${fromIndex}`);
}

const COMPANION_PANEL = 'components/companion/PassportConnectPanel.tsx';
const APPLICATION_COMPLETE_PAGE = 'app/passport-connect/complete/page.tsx';
const SESSION_ISSUER = 'services/identity/passportSession.ts';

describe('Passport sign-in — verifyOtp uses type: "email", never "magiclink"', () => {
  it('the Companion (iframe) session exchange calls verifyOtp with type: "email"', () => {
    const src = stripComments(readSource(COMPANION_PANEL));
    const at = src.indexOf('.auth.verifyOtp({');
    expect(at, 'expected a .auth.verifyOtp({ call in the Companion panel').toBeGreaterThan(-1);
    const call = src.slice(at, src.indexOf('}', src.indexOf('type:', at)) + 1);
    expect(call).toMatch(/type:\s*["']email["']/);
    expect(call).not.toMatch(/type:\s*["']magiclink["']/);
  });

  it('the application handoff (/passport-connect/complete) session exchange calls verifyOtp with type: "email"', () => {
    const src = stripComments(readSource(APPLICATION_COMPLETE_PAGE));
    const at = src.indexOf('.auth.verifyOtp({');
    expect(at, 'expected a .auth.verifyOtp({ call on the complete page').toBeGreaterThan(-1);
    const call = src.slice(at, src.indexOf('}', src.indexOf('type:', at)) + 1);
    expect(call).toMatch(/type:\s*["']email["']/);
    expect(call).not.toMatch(/type:\s*["']magiclink["']/);
  });

  it('neither client exchange site calls verifyOtp with type: "magiclink" anywhere in the file', () => {
    // Broader than the two tests above: catches a second, later verifyOtp
    // call added to either file without updating this canary's assumption
    // that there is exactly one.
    for (const path of [COMPANION_PANEL, APPLICATION_COMPLETE_PAGE]) {
      const src = stripComments(readSource(path));
      const verifyOtpCalls = src.match(/\.auth\.verifyOtp\(\{[^}]*\}/g) ?? [];
      expect(verifyOtpCalls.length, `${path}: expected at least one verifyOtp call`).toBeGreaterThan(0);
      for (const call of verifyOtpCalls) {
        expect(call, `${path}: a verifyOtp call still uses type: 'magiclink'`).not.toMatch(
          /type:\s*["']magiclink["']/,
        );
      }
    }
  });

  it('the server-side session minter still uses generateLink({ type: "magiclink" }) — that type is correct and must NOT change', () => {
    // Guards the inverse mistake: "fixing" the mint side too. generateLink's
    // GenerateLinkType enum has no 'email' member — only verifyOtp's
    // EmailOtpType does. Flipping generateLink to 'email' would be a type
    // error and a behavioural regression (magiclink is what requires the
    // user to already exist, which this path depends on).
    const src = stripComments(readSource(SESSION_ISSUER));
    const generateLinkCalls = src.match(/\.generateLink\(\{[^}]*\}/g) ?? [];
    expect(generateLinkCalls.length, 'expected generateLink calls in the session issuer').toBeGreaterThan(0);
    for (const call of generateLinkCalls) {
      expect(call).toMatch(/type:\s*["']magiclink["']/);
    }
  });
});

describe('Passport sign-in — safe diagnostics on exchange failure (no token leakage)', () => {
  for (const path of [COMPANION_PANEL, APPLICATION_COMPLETE_PAGE]) {
    it(`${path}: a failed verifyOtp is diagnosed without logging the token_hash`, () => {
      const rawSrc = readSource(path); // NOT stripped — a diagnostic call is real code, not prose.
      const verifyAt = rawSrc.indexOf('.auth.verifyOtp({');
      expect(verifyAt).toBeGreaterThan(-1);

      // The diagnostic must be the next console.warn/error after the call,
      // inside the `if (error)` branch that follows.
      const ifErrorAt = rawSrc.indexOf('if (error)', verifyAt);
      expect(ifErrorAt, 'expected an if (error) branch after verifyOtp').toBeGreaterThan(-1);
      const branch = extractBraceBlock(rawSrc, ifErrorAt);

      const diagnosticAt = branch.search(/console\.(warn|error)\(/);
      expect(diagnosticAt, `${path}: expected a console.warn/error diagnostic in the error branch`).toBeGreaterThan(
        -1,
      );
      const diagnosticCall = branch.slice(diagnosticAt);

      // Never the raw token, the grant, or the hash — only error metadata.
      expect(diagnosticCall).not.toMatch(/token_hash/);
      expect(diagnosticCall).not.toMatch(/tokenHash/);
      expect(diagnosticCall).not.toMatch(/\bgrant\b/);
      // Must carry SOME identifying error metadata to be useful at all.
      expect(diagnosticCall).toMatch(/error\.(status|code|name)/);
    });
  }
});
