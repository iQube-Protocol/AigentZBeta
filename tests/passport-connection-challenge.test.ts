/**
 * Passport-native access — challenge canaries.
 *
 * PRD-PAG-001 Amendment A §A.9.4. These are the prerequisite half of the
 * plan: the challenge store must be single-use and pre-session BEFORE any
 * route mints a session from it.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, extractJsonResponseBodies } from './_lib/sourceAuthority';
import {
  buildConnectionChallengeMessage,
  CHALLENGE_TTL_MS,
  sha256,
} from '@/services/passport/connectionChallenge';

const SERVICE = 'services/passport/connectionChallenge.ts';
const MIGRATION = 'supabase/migrations/20260819000000_passport_connection_challenges.sql';

/** Drop `--` lines and COMMENT ON prose, leaving only executable SQL. */
function stripSqlProse(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .replace(/COMMENT ON[\s\S]*?;/g, '');
}

describe('the pre-session law — ruling 8', () => {
  it('THE negative canary: nothing in the challenge path names an identity the caller cannot have', () => {
    // A caller at challenge time has no session. A parameter, column or return
    // field asking for one of these would rebuild the exact circular
    // dependency Amendment A exists to remove.
    for (const file of [SERVICE, MIGRATION]) {
      // `stripComments` is TypeScript-AST-based, so it does not touch SQL
      // comments. Both files DOCUMENT this boundary by naming the forbidden
      // identifiers — the grep-vs-comment defect `_lib/sourceAuthority` warns
      // about, where a compliant file fails its own canary.
      const code = file.endsWith('.sql') ? stripSqlProse(readSource(file)) : stripComments(readSource(file));
      for (const forbidden of ['personaId', 'persona_id', 'authProfileId', 'auth_profile_id', 'didPersonaId', 'did_persona_id']) {
        expect(code, `${file} references ${forbidden} in a pre-session path`).not.toContain(forbidden);
      }
    }
  });

  it('the caller is named by an opaque connection handle, not a derived one', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain('provisionalConnectionId');
    // Randomly generated, never derived from anything about the citizen.
    expect(code).toMatch(/pcx_\$\{crypto\.randomBytes/);
  });

  it('the challenge message carries no persona and binds what it should', () => {
    const msg = buildConnectionChallengeMessage({
      audience: 'metame',
      origin: 'https://dev-beta.aigentz.me',
      nonce: 'abc123',
      requestedAction: 'connect',
      expiresAt: '2026-07-26T12:00:00.000Z',
    });
    expect(msg).toContain('Application: metame');
    expect(msg).toContain('Origin: https://dev-beta.aigentz.me');
    expect(msg).toContain('Nonce: abc123');
    expect(msg).toContain('Expires: 2026-07-26T12:00:00.000Z');
    expect(msg.toLowerCase()).not.toContain('persona');
  });

  it('a step-up challenge says so, so a connect proof cannot be spent on one', () => {
    const base = { audience: 'a', origin: 'o', nonce: 'n', expiresAt: 'e' } as const;
    const connect = buildConnectionChallengeMessage({ ...base, requestedAction: 'connect' });
    const stepUp = buildConnectionChallengeMessage({ ...base, requestedAction: 'step_up' });
    expect(connect).not.toEqual(stepUp);
    expect(stepUp).toContain('step-up');
  });
});

describe('single use is a database guarantee — ruling 7', () => {
  it('consumption is a conditional update, never read-then-write', () => {
    // Two proofs racing one nonce would both pass a read check and both mint a
    // session. Only the conditional update can be won exactly once.
    const code = stripComments(readSource(SERVICE));
    const spend = code.slice(code.indexOf('.update({ consumed_at'));
    expect(spend, 'the spend no longer filters on an unconsumed row').toContain(
      ".is('consumed_at', null)",
    );
  });

  it('the challenge is spent BEFORE the signature is judged', () => {
    // Otherwise a failed signature leaves the nonce live and an attacker can
    // grind signatures against one challenge until something verifies.
    const code = stripComments(readSource(SERVICE));
    const spendAt = code.indexOf(".is('consumed_at', null)");
    const verifyAt = code.indexOf('verifyMessage(input.message');
    expect(spendAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeGreaterThan(-1);
    expect(spendAt, 'signature verification now precedes the spend').toBeLessThan(verifyAt);
  });

  it('the raw nonce is never stored — only its hash', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain('nonce_hash: sha256(nonce)');
    expect(code, 'the raw nonce is being persisted').not.toMatch(/nonce:\s*nonce,/);
    expect(sha256('x')).toHaveLength(64);
  });

  it('the signer is recovered, never taken from the caller', () => {
    // The wallet address on the request is untrusted input.
    const code = stripComments(readSource(SERVICE));
    expect(code).toMatch(/recovered = normaliseAddress\('evm', verifyMessage\(/);
    const result = code.slice(code.indexOf('return {\n    ok: true,'));
    expect(result).toContain('walletAddress: recovered');
  });

  it('challenges are short-lived', () => {
    expect(CHALLENGE_TTL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe('the migration is additive and fails closed', () => {
  it('creates its own table and alters nothing existing', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.passport_connection_challenges');
    // Rollback is DROP TABLE and nothing else (§A.9.3).
    expect(sql, 'the migration mutates an existing table').not.toMatch(/ALTER TABLE(?!.*passport_connection_challenges)/);
  });

  it('carries deny-all RLS like the gateway session store', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql, 'a policy grants access to a non-service caller').not.toMatch(/CREATE POLICY/i);
  });

  it('the nonce hash is unique, so one signature cannot answer two challenges', () => {
    expect(readSource(MIGRATION)).toMatch(/nonce_hash text NOT NULL UNIQUE/);
  });
});

// ─── Increments 2–6: resolution, session, routes, Connect surface ───────────

const PRINCIPAL = 'services/identity/passportPrincipal.ts';
const SESSION = 'services/identity/passportSession.ts';
const CHALLENGE_ROUTE = 'app/api/passport-connect/challenge/route.ts';
const PROOF_ROUTE = 'app/api/passport-connect/proof/route.ts';
// FINALIZE_ROUTE (added 2026-07-28, §A.11.2): session issuance MOVED here from
// PROOF_ROUTE — /proof now stops at a pending-auth transaction + persona
// choices; /finalize mints the session after an explicit persona selection.
// Assertions about session/handoff minting that used to target PROOF_ROUTE
// now target this file instead — see tests/passport-first-connection.test.ts
// for the full closure's own canaries.
const FINALIZE_ROUTE = 'app/api/passport-connect/finalize/route.ts';
const CONNECT_PANEL = 'components/companion/PassportConnectPanel.tsx';

describe('no pre-session surface requires an identity the caller cannot have', () => {
  it('THE canary: none of the three pre-session routes authenticates its caller', () => {
    // A getActivePersona call on any of these three rebuilds the exact
    // circular dependency Amendment A exists to remove: an account session
    // required in order to prove the Passport meant to establish it.
    // FINALIZE_ROUTE joined this list 2026-07-28 (§A.11.2) — it is the route
    // that NOW mints the session, so it is exactly as pre-session as the two
    // it joined. /resolved-persona is DELIBERATELY excluded: it is the one
    // Bearer-gated, POST-session self-view read this closure adds (the owner
    // self-view exception), and belongs nowhere near this list.
    for (const file of [CHALLENGE_ROUTE, PROOF_ROUTE, FINALIZE_ROUTE]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} authenticates its caller`).not.toContain('getActivePersona');
      expect(code, `${file} authenticates its caller`).not.toContain('getCallerIdentityContext');
      expect(code, `${file} authenticates its caller`).not.toContain('resolvePersonaOrTimeout');
      expect(code, `${file} uses the persona-bearing transport`).not.toContain('personaFetch');
    }
  });

  it('the resolver takes a wallet, never a persona or profile', () => {
    const code = stripComments(readSource(PRINCIPAL));
    const sig = code.slice(code.indexOf('export async function resolvePassportPrincipal'));
    const params = sig.slice(0, sig.indexOf('{'));
    for (const forbidden of ['personaId', 'authProfileId', 'didPersonaId']) {
      expect(params, `resolvePassportPrincipal accepts ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('personaFetch, when present, appears only AFTER the session is exchanged', () => {
    // STRENGTHENED 2026-07-28, not relaxed. The panel now makes exactly ONE
    // personaFetch call — /resolved-persona, the owner self-view read that
    // pins the citizen's explicitly chosen persona (§A.11.2) — and it fires
    // strictly after `verifyOtp` has already exchanged the single-use token
    // for a real session. A personaFetch call BEFORE that point would demand
    // the Bearer session Connect exists to create, exactly the defect this
    // canary always existed to catch. Order-checked, not merely absence-
    // checked, so the property survives the file legitimately gaining a
    // post-session call.
    const code = stripComments(readSource(CONNECT_PANEL));
    const verifyOtpAt = code.indexOf('verifyOtp(');
    expect(verifyOtpAt, 'the panel no longer exchanges a session token').toBeGreaterThan(-1);
    const personaFetchAt = code.indexOf('personaFetch(');
    if (personaFetchAt === -1) return; // no personaFetch call at all is also compliant
    expect(personaFetchAt, 'personaFetch is called before the session exists').toBeGreaterThan(verifyOtpAt);
  });
});

describe('binding is by lineage — ruling 3', () => {
  it('the resolver keys on the kybe, never on email, name or wallet', () => {
    const code = stripComments(readSource(PRINCIPAL));
    expect(code).toContain("eq('kybe_identity_id', kybeId)");
    // The wallet is an ENTRY point, not the binding key: no passport lookup
    // may be keyed by an address or an email.
    expect(code).not.toMatch(/polity_passport_records[\s\S]{0,200}eq\('(wallet|email)/);
    expect(code, 'email matching has entered the resolver').not.toContain('email');
  });

  it('an ambiguous lineage refuses rather than choosing', () => {
    // Two live roots for one wallet, or two auth users under one personhood,
    // means picking one would silently choose whose session to mint.
    const code = stripComments(readSource(PRINCIPAL));
    expect(code).toContain("new Set(rootIds).size > 1");
    expect(code).toContain('authUserIds.length > 1');
  });

  it('only active aliases and usable passports carry access', () => {
    const code = stripComments(readSource(PRINCIPAL));
    expect(code).toContain("eq('status', 'active')");
    expect(code).toContain('isPassportUsable(passport)');
  });
});

describe('session issuance stays inside the compatibility envelope — ruling 4', () => {
  it('no protected spine file is modified', () => {
    // §A.9.1. If this fails the design has drifted from the ruling.
    for (const file of [
      'services/identity/getActivePersona.ts',
      'services/access/evaluateAccess.ts',
      'services/identity/personaSessionToken.ts',
    ]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} now knows about the passport path`).not.toContain('passportPrincipal');
      expect(code, `${file} now knows about the passport path`).not.toContain('passportSession');
      expect(code, `${file} now knows about the passport path`).not.toContain('connectionChallenge');
    }
  });

  it('the session is an ordinary Supabase session, not a hand-rolled one', () => {
    // This is what keeps rollback safe: a session minted here is
    // indistinguishable from any other, so disabling the path strands nothing.
    const code = stripComments(readSource(SESSION));
    expect(code).toContain('auth.admin.generateLink');
    expect(code, 'a bespoke session token appeared').not.toMatch(/jwt\.sign|createSessionToken/);
  });

  it('only a single-use handle reaches the browser — no identity on its face', () => {
    const code = stripComments(readSource(SESSION));
    const grant = code.slice(code.indexOf('return { ok: true, grant:'));
    for (const forbidden of ['email', 'authUserId', 'kybeId', 'rootIdentityId', 'personaId']) {
      expect(grant, `the grant leaks ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the proof response carries no T0 identifier', () => {
    // Precision note (2026-07-28): checks the actual NextResponse.json(...)
    // BODIES, not the whole handler — see extractJsonResponseBodies's own
    // header. /proof's §A.11 rewrite legitimately reads kybeId/rootIdentityId/
    // authUserId INTERNALLY (to build the pending-auth transaction); that is
    // not a leak unless one of those names reaches a response body.
    const code = stripComments(readSource(PROOF_ROUTE));
    const bodies = extractJsonResponseBodies(code);
    expect(bodies.length, 'no NextResponse.json calls found — extraction broke').toBeGreaterThan(0);
    for (const body of bodies) {
      for (const forbidden of ['kybeId', 'rootIdentityId', 'authUserId', 'personaId', 'authProfileId']) {
        expect(body, `a proof response body returns ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('the finalize response carries no T0 identifier', () => {
    const code = stripComments(readSource(FINALIZE_ROUTE));
    const bodies = extractJsonResponseBodies(code);
    expect(bodies.length, 'no NextResponse.json calls found — extraction broke').toBeGreaterThan(0);
    for (const body of bodies) {
      for (const forbidden of ['kybeId', 'rootIdentityId', 'authUserId', 'personaId', 'authProfileId']) {
        expect(body, `a finalize response body returns ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('resolution failures do not let a caller probe the lineage graph', () => {
    // "unknown wallet" vs "no passport" would let someone map the graph with
    // wallets they do not own.
    //
    // Precision note (2026-07-28): scoped to response BODIES, not the whole
    // file — §A.11's /proof legitimately BRANCHES on `resolved.reason ===
    // 'wallet_unknown'` internally (that branch is what offers the World ID
    // rescue instead of a dead end), which is not a leak unless the literal
    // value reaches a response body. It never does: the unrescued case sends
    // the new `link_required` (itself a narrow, considered, non-identifying
    // disclosure — see the route's own header) or falls through to the same
    // single opaque `no_constitutional_access` as every other reason.
    const code = stripComments(readSource(PROOF_ROUTE));
    expect(code).toContain("error: 'no_constitutional_access'");
    const bodies = extractJsonResponseBodies(code);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      for (const leak of [
        'wallet_unknown',
        'no_passport',
        'passport_inactive',
        'lineage_incomplete',
        'principal_unprovisioned',
        'conflict_different_root',
      ]) {
        expect(body, `a proof response body discloses ${leak}`).not.toContain(`'${leak}'`);
      }
    }
  });

  it('the origin is server-determined, never taken from the body', () => {
    const code = stripComments(readSource(CHALLENGE_ROUTE));
    expect(code).toContain('origin: request.nextUrl.origin');
    expect(code, 'a caller can nominate its own origin').not.toMatch(/body\?\.origin/);
  });
});

describe('the Companion is preferred, never exclusive — ruling 6', () => {
  it('Connect drives the open protocol, not an extension-only capability', () => {
    // Any wallet or web connector must be able to drive the same two routes.
    const code = stripComments(readSource(CONNECT_PANEL));
    expect(code).toContain('/api/passport-connect/challenge');
    expect(code).toContain('/api/passport-connect/proof');
    expect(code, 'Connect reaches for an extension-only API').not.toContain('chrome.');
  });

  it('presence of a credential is never treated as authorisation', () => {
    // The citizen always performs a local approval ceremony.
    const code = stripComments(readSource(CONNECT_PANEL));
    expect(code).toContain('personal_sign');
  });

  it('it never silently chooses between wallets', () => {
    // Renamed 'choose' -> 'choose-wallet' 2026-07-28 (ruling 3) so it cannot
    // be read as the persona chooser — see 'choose-persona' below.
    const code = stripComments(readSource(CONNECT_PANEL));
    expect(code).toContain('kind: "choose-wallet"');
    expect(code).toContain('accounts.length === 1 ? accounts[0] : null');
  });

  it('a wallet-address choice is never conflated with a persona choice — ruling 3', () => {
    const code = stripComments(readSource(CONNECT_PANEL));
    expect(code, 'no distinct persona-selection state exists').toContain('kind: "choose-persona"');
    // The two states carry structurally different data — a list of address
    // strings vs a list of PersonaChoice objects — so a future edit cannot
    // silently merge them back into one chooser without this failing.
    expect(code).toContain('addresses: string[]');
    expect(code).toContain('personas: PersonaChoice[]');
  });

  it('the companion offers Connect where it used to show a sign-in wall', () => {
    const page = stripComments(readSource('app/(embed)/triad/embed/companion/page.tsx'));
    expect(page).toContain('connectGate');
    expect(page, 'a sign-in wall survives on a gated surface').not.toContain('Sign in to');
  });
});

// ─── The door is on EVERY surface, including the wallet (operator, 2026-07-28) ─
//
// "My passport is supposed to be able to be detected via a cryptographic
// signature, provide me access to my wallet without me signing in, where I
// should then be able to select which persona I wish to activate."
//
// It could not. Four surfaces carried `connectGate`; the WALLET branch — the
// one the operator's flow actually starts at — mounted `SmartWalletDrawer`
// unconditionally and fell through to that component's own inline
// email/password form. The rule was a convention restated at each call site,
// so a surface could simply not carry it. These canaries make it structural.

const COMPANION_PAGE = 'app/(embed)/triad/embed/companion/page.tsx';

describe('every gated companion surface passes through the one door', () => {
  it('the gate is a single node, not a rule restated per surface', () => {
    // inv.engineering.036. `gated` is the only place the "session or door"
    // decision is made; a surface that hand-rolls `identity && personaId ? … :
    // connectGate` again is the exact drift that let the wallet miss it.
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page).toMatch(/const gated = \(surface: \(activePersonaId: string\) => ReactNode\)/);
    expect(
      page,
      'a surface decides session-vs-door for itself instead of calling gated()',
    ).not.toMatch(/identity && personaId \?/);
  });

  it('the WALLET surface offers the Passport door, not a password form', () => {
    // The regression-shaped hole: without this, a citizen holding a Passport
    // reaches their wallet only by typing an email and a password.
    const page = stripComments(readSource(COMPANION_PAGE));
    // Anchor forward from the wallet branch: `activeSurface === "search" ?`
    // also appears earlier, in the composer-mode prop, and slicing to THAT
    // yields an empty string that would pass a naive `.not.toContain`.
    const walletAt = page.indexOf('activeSurface === "wallet" ?');
    expect(walletAt, 'the wallet branch is gone').toBeGreaterThan(-1);
    const searchAt = page.indexOf('activeSurface === "search" ?', walletAt);
    expect(searchAt, 'the search branch no longer follows the wallet branch').toBeGreaterThan(walletAt);
    const walletBranch = page.slice(walletAt, searchAt);
    expect(walletBranch, 'the wallet mounts unconditionally again').toContain('gated(');
    // And the drawer must receive the persona the GATE narrowed, not the raw
    // possibly-undefined one — same identity on the surface as in the gate.
    expect(walletBranch).toContain('personaId={activePersonaId}');
  });

  it('every gated surface names the persona the gate resolved, never a cast', () => {
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page, 'a call site casts around the gate instead of using its argument')
      .not.toContain('personaId as string');
    // One builder argument per gated surface: permissions, wallet, search,
    // overlay, workspace.
    expect((page.match(/gated\(\(activePersonaId\)/g) ?? []).length).toBe(5);
  });

  it('identity is TRI-state: unresolved is never rendered as absent', () => {
    // `resolveCompanionContext` always resolves to an object, so `ctx === null`
    // means "not looked yet". Collapsing that into the falsy branch showed the
    // Connect door to an already-connected citizen on every load — an absence
    // observed before the observation completed is not an absence (MS-4).
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page).toContain('const identityResolved = ctx !== null');
    const gate = page.slice(page.indexOf('const gated = ('));
    expect(gate, 'the gate shows the door before identity has resolved').toMatch(
      /identityResolved \? connectGate : resolvingGate/,
    );
  });
});

// ─── The application handshake — the partition gap (operator, 2026-07-26) ───

describe('the Companion session reaches the application', () => {
  const COMPLETE_PAGE = 'app/passport-connect/complete/page.tsx';

  it('finalize mints one grant per storage world', () => {
    // Iframe storage partitioning means the Companion partition and the
    // top-level app never share a session; one single-use token cannot serve
    // both. The handoff grant is best-effort — its failure degrades to the
    // pre-handoff behaviour, never blocks the Companion's own session.
    // MOVED 2026-07-28 (§A.11.2): session issuance is now FINALIZE_ROUTE's
    // job, not PROOF_ROUTE's — /proof stops at a pending-auth transaction.
    const code = stripComments(readSource(SESSION));
    expect(code).toContain('handoffTokenHash');
    expect((code.match(/generateLink\(/g) ?? []).length).toBe(2);
    const finalize = stripComments(readSource(FINALIZE_ROUTE));
    expect(finalize).toContain('handoffTokenHash: session.grant.handoffTokenHash');
    // /proof itself must NOT mint a session any more — the absence is the
    // point of this ruling, not incidental.
    const proof = stripComments(readSource(PROOF_ROUTE));
    expect(proof, 'proof/route.ts still mints a session directly').not.toContain('issuePassportSession');
  });

  it('the handoff is exchanged top-level, and the panel opens it in the browser', () => {
    const panel = stripComments(readSource(CONNECT_PANEL));
    expect(panel).toContain('/passport-connect/complete?token_hash=');
    // The handoff URL is built once (`handoffUrl`) and passed to `window.open`
    // — reused by the popup-blocked fallback button (bug fix, 2026-07-31:
    // "Passport sign-in doesn't connect on non-metaMe sites") so the manual
    // retry opens the SAME URL the automatic attempt tried, never a second
    // hand-derived one.
    expect(panel, 'the handoff URL is built from the real template').toMatch(
      /handoffUrl = `\/passport-connect\/complete\?token_hash=/,
    );
    expect(panel, 'the handoff must leave the iframe').toMatch(/window\.open\(handoffUrl/);
    const page = stripComments(readSource(COMPLETE_PAGE));
    expect(page).toContain("type: \"magiclink\"");
  });

  it('a blocked handoff popup is detected and offered as a manual, one-click retry — never a silent "connected" that never crossed', () => {
    // window.open() returns null (or an already-closed Window) when a popup
    // is blocked, with no thrown error — the ONLY reliable signal. Trusting
    // `connected` unconditionally here would be exactly the class of "No
    // Simulated Completion" defect CLAUDE.md forbids for this reason.
    const panel = stripComments(readSource(CONNECT_PANEL));
    expect(panel).toMatch(/if \(!popup \|\| popup\.closed\)/);
    expect(panel).toMatch(/handoffUrl \}\);\s*onConnected\?\.\(\);\s*return;/);
    // The fallback renders a real user-gesture retry, so it is never blocked.
    expect(panel).toMatch(/onClick=\{\(\) => window\.open\(state\.handoffUrl,/);
  });

  it('the complete page permits no open redirect', async () => {
    const { safeNextPath } = await import('@/app/passport-connect/complete/page');
    expect(safeNextPath('/metame/runtime')).toBe('/metame/runtime');
    expect(safeNextPath('/codex/viewer')).toBe('/codex/viewer');
    for (const evil of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      'http://evil',
      '\\\\evil',
      null,
      '',
      'relative-no-slash',
    ]) {
      expect(safeNextPath(evil as string | null)).toBe('/metame/runtime');
    }
  });

  it('the token is scrubbed from the URL before the exchange', () => {
    // The single-use token must not survive into history/bookmarks even if
    // the exchange hangs.
    const page = stripComments(readSource(COMPLETE_PAGE));
    const scrub = page.indexOf('history.replaceState');
    const exchange = page.indexOf('verifyOtp');
    expect(scrub).toBeGreaterThan(-1);
    expect(scrub, 'the scrub no longer precedes the exchange').toBeLessThan(exchange);
  });
});
