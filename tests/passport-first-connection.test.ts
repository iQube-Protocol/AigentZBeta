/**
 * PRD-PAG-001 Amendment A §A.11 — first-connection closure (operator ruling
 * 2026-07-28) canaries.
 *
 * The nine required canaries, in the operator's own numbering. Behavioural
 * where the logic is pure or fake-able without a live Supabase instance
 * (canaries 2–7, the actual security-bearing logic); structural/ordering
 * where it genuinely requires a live DB round-trip this sandbox cannot run
 * (canary 1's end-to-end shape, canary 9's receipt wiring) — same
 * methodology tests/passport-connection-challenge.test.ts already
 * establishes for this pipeline.
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSource, stripComments, extractJsonResponseBodies } from './_lib/sourceAuthority';
import {
  selectPersonaChoice,
  toPersonaChoice,
  sha256,
  spendPendingAuth,
  type CandidatePersona,
} from '@/services/identity/passportPendingAuth';
import { establishWalletBindingForRoot } from '@/services/identity/walletAliasService';
import { personaPublicRef } from '@/services/identity/personaReferences';

// walletAliasService's HMAC helpers (buildAddressFingerprint, etc.) require a
// real server secret at call time. This is a test-only value — never used to
// derive anything that leaves this process — set only when the real env
// doesn't already provide one, so a real local/CI secret is never clobbered.
process.env.WALLET_ALIAS_HMAC_KEY =
  process.env.WALLET_ALIAS_HMAC_KEY || 'test-only-wallet-alias-hmac-key-do-not-use-in-prod-32chars';

const PROOF_ROUTE = 'app/api/passport-connect/proof/route.ts';
const FINALIZE_ROUTE = 'app/api/passport-connect/finalize/route.ts';
const PENDING_AUTH_SERVICE = 'services/identity/passportPendingAuth.ts';
const PRINCIPAL = 'services/identity/passportPrincipal.ts';
const WALLET_ALIAS_SERVICE = 'services/identity/walletAliasService.ts';
const MIGRATION = 'supabase/migrations/20260831000000_passport_native_first_connection.sql';

// ─── A minimal fake Supabase query builder ─────────────────────────────────
//
// Every function under test in this file calls `.from(table)` some number of
// TIMES, each time chaining a handful of builder methods before being
// awaited. A real supabase-js builder is both chainable AND thenable (it
// resolves when awaited, however it was chained). This fake reproduces
// EXACTLY that shape with a pre-programmed queue of results, one per
// `.from()` call, consumed in call order — sufficient to drive the real
// functions' real branching without a live database.

type FakeResult = { data: unknown; error: unknown };

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  constructor(private readonly result: FakeResult) {}
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
  order() { return this; }
  is() { return this; }
  maybeSingle() { return this; }
  insert() { return this; }
  update() { return this; }
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  private queue: FakeResult[] = [];
  queueResult(r: FakeResult): this {
    this.queue.push(r);
    return this;
  }
  from(_table: string) {
    const next = this.queue.shift() ?? { data: null, error: null };
    return new FakeQueryBuilder(next);
  }
}

function fakeClient(fake: FakeSupabase): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

// ─── Fixtures ────────────────────────────────────────────────────────────

const ALICE: CandidatePersona = { id: 'persona-alice-uuid', displayLabel: 'Alice', avatarUrl: null, personaType: null };
const BOB: CandidatePersona = { id: 'persona-bob-uuid', displayLabel: 'Bob', avatarUrl: null, personaType: null };
const CANDIDATES: CandidatePersona[] = [ALICE, BOB];

const EVM_ADDRESS = `0x${'ab'.repeat(20)}`;
const ROOT_A = 'root-identity-aaaa';
const ROOT_B = 'root-identity-bbbb';

// ─── Canary 1 — first-ever connection, no prior session, reaches persona
// choices end to end. ────────────────────────────────────────────────────

describe('canary 1 — first-ever Passport connection succeeds end to end with no prior session', () => {
  it('the full rescue-and-transact path is wired in the ruled order, with no Bearer anywhere in it', () => {
    const code = stripComments(readSource(PROOF_ROUTE));
    const order = [
      "resolvePassportPrincipal(proof.walletAddress)",
      "'wallet_unknown'",
      'resolvePassportPrincipalByWorldId(worldIdProof)',
      'establishWalletBindingForRoot(',
      'issuePendingAuth(',
    ];
    let cursor = -1;
    for (const marker of order) {
      const at = code.indexOf(marker, cursor + 1);
      expect(at, `expected to find "${marker}" after index ${cursor}`).toBeGreaterThan(cursor);
      cursor = at;
    }
    // And genuinely no Bearer/session requirement anywhere in this file —
    // the stronger, already-established canary in
    // passport-connection-challenge.test.ts covers this; restated narrowly
    // here so this file stands alone as the closure's own record.
    expect(code).not.toContain('getActivePersona');
    expect(code).not.toContain('getCallerIdentityContext');
  });

  it('/proof never mints a session — /finalize does, only after a persona is chosen', () => {
    const proof = stripComments(readSource(PROOF_ROUTE));
    expect(proof).not.toContain('issuePassportSession');
    const finalize = stripComments(readSource(FINALIZE_ROUTE));
    expect(finalize).toContain('issuePassportSession(');
    // The session mint must be AFTER the persona selection is validated —
    // never before, or an unchosen/invalid persona could still win a session.
    const selectAt = finalize.indexOf('selectPersonaChoice(');
    const mintAt = finalize.indexOf('issuePassportSession(');
    expect(selectAt).toBeGreaterThan(-1);
    expect(mintAt).toBeGreaterThan(selectAt);
  });
});

// ─── Canary 2 — no pre-existing wallet alias; binding is established, not
// blocked. Behavioural — drives the real function against the fake. ───────

describe('canary 2 — first-connection wallet binding is established, never blocked', () => {
  it('establishes a NEW binding when no active alias exists for this wallet', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: [], error: null }); // no existing active binding
    fake.queueResult({ error: null }); // insert succeeds
    const result = await establishWalletBindingForRoot(fakeClient(fake), {
      chain: 'evm',
      walletAddress: EVM_ADDRESS,
      rootIdentityId: ROOT_A,
    });
    expect(result).toEqual({ ok: true, created: true });
  });

  it('is idempotent when the wallet is already bound to the SAME root (a retry, not a conflict)', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: [{ id: 'row-1', root_identity_id: ROOT_A }], error: null });
    const result = await establishWalletBindingForRoot(fakeClient(fake), {
      chain: 'evm',
      walletAddress: EVM_ADDRESS,
      rootIdentityId: ROOT_A,
    });
    expect(result).toEqual({ ok: true, created: false });
  });

  it('REFUSES rather than re-binds when the wallet is already bound to a DIFFERENT root (Amendment B rule 3)', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: [{ id: 'row-1', root_identity_id: ROOT_B }], error: null });
    const result = await establishWalletBindingForRoot(fakeClient(fake), {
      chain: 'evm',
      walletAddress: EVM_ADDRESS,
      rootIdentityId: ROOT_A,
    });
    expect(result).toEqual({ ok: false, reason: 'conflict_different_root' });
  });

  it('a race that loses the unique-index insert reconciles rather than silently succeeding or failing', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: [], error: null }); // SELECT: nothing yet
    fake.queueResult({ error: { code: '23505', message: 'duplicate key' } }); // INSERT loses the race
    fake.queueResult({ data: { root_identity_id: ROOT_A }, error: null }); // re-read: the winner bound the SAME root
    const result = await establishWalletBindingForRoot(fakeClient(fake), {
      chain: 'evm',
      walletAddress: EVM_ADDRESS,
      rootIdentityId: ROOT_A,
    });
    expect(result).toEqual({ ok: true, created: false });
  });
});

// ─── Canaries 3, 4, 5, 7 — persona selection. Fully pure — no fake needed. ─

describe('canaries 3 & 4 — every owned persona is offered, and the chosen one is the one that activates', () => {
  it('canary 3 — multiple owned personas are ALL offered, never silently narrowed to one', () => {
    const choices = CANDIDATES.map(toPersonaChoice);
    expect(choices).toHaveLength(2);
    expect(new Set(choices.map((c) => c.personaPublicRef)).size).toBe(2);
    expect(choices.map((c) => c.displayLabel).sort()).toEqual(['Alice', 'Bob']);
  });

  it('canary 3b — the projection carries ONLY the ruling-2 shape, nothing else', () => {
    const choice = toPersonaChoice(ALICE);
    expect(Object.keys(choice).sort()).toEqual(['displayLabel', 'personaPublicRef']);
  });

  it('canary 4 — the SELECTED ref resolves to exactly that persona and no other', () => {
    const bobRef = personaPublicRef(BOB.id);
    const result = selectPersonaChoice(CANDIDATES, bobRef);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaId).toBe(BOB.id);
      expect(result.choice.personaPublicRef).toBe(bobRef);
      expect(result.choice.displayLabel).toBe('Bob');
    }
  });
});

describe('canary 5 — NO fallback persona activation, ever, mutation-provable', () => {
  it('a missing ref is refused even with exactly ONE candidate', () => {
    const oneCandidate = [ALICE];
    expect(selectPersonaChoice(oneCandidate, undefined)).toEqual({ ok: false, reason: 'ref_required' });
    expect(selectPersonaChoice(oneCandidate, null)).toEqual({ ok: false, reason: 'ref_required' });
    expect(selectPersonaChoice(oneCandidate, '')).toEqual({ ok: false, reason: 'ref_required' });
    expect(selectPersonaChoice(oneCandidate, '   ')).toEqual({ ok: false, reason: 'ref_required' });
  });

  it('a missing ref is refused with MULTIPLE candidates too — same refusal, not a "pick first"', () => {
    expect(selectPersonaChoice(CANDIDATES, undefined)).toEqual({ ok: false, reason: 'ref_required' });
  });

  it('structural: /finalize requires personaPublicRef in the request body — no default branch', () => {
    const code = stripComments(readSource(FINALIZE_ROUTE));
    expect(code).toContain("body?.personaPublicRef === 'string' ? body.personaPublicRef : ''");
    // The exact regression shape: a branch that auto-selects when exactly
    // one candidate exists. None may exist anywhere in the selection path.
    expect(code, 'finalize auto-selects a single candidate').not.toMatch(/candidates\.length === 1/);
    const pending = stripComments(readSource(PENDING_AUTH_SERVICE));
    expect(pending, 'selectPersonaChoice auto-selects a single candidate').not.toMatch(
      /candidates\.length === 1/,
    );
  });
});

describe('canary 7 — cross-principal persona selection is refused (the load-bearing property)', () => {
  it('a personaPublicRef forged from OUTSIDE this principal\'s own candidate set matches nothing', () => {
    // personaPublicRef is a ONE-WAY hash but NOT a secret — it is already the
    // identifier that appears in receipts today, so an attacker can compute
    // it for any personaId it can guess or observe elsewhere. The defence is
    // never "the ref is unguessable"; it is "the ref must match one of THIS
    // transaction's own resolved candidates".
    const someoneElsesPersonaId = 'persona-belongs-to-a-different-principal-entirely';
    const forgedRef = personaPublicRef(someoneElsesPersonaId);
    expect(CANDIDATES.some((c) => c.id === someoneElsesPersonaId)).toBe(false); // fixture sanity
    const result = selectPersonaChoice(CANDIDATES, forgedRef);
    expect(result).toEqual({ ok: false, reason: 'cross_principal_ref' });
  });

  it('the SAME ref that was refused above is accepted once genuinely added to the candidate set', () => {
    // Proves the refusal above was about principal membership, not about the
    // ref being malformed or the function being broken.
    const foreignPersonaId = 'persona-belongs-to-a-different-principal-entirely';
    const foreignChoice: CandidatePersona = { id: foreignPersonaId, displayLabel: 'Foreign', avatarUrl: null, personaType: null };
    const ref = personaPublicRef(foreignPersonaId);
    const stillRefused = selectPersonaChoice(CANDIDATES, ref);
    expect(stillRefused.ok).toBe(false);
    const nowAccepted = selectPersonaChoice([...CANDIDATES, foreignChoice], ref);
    expect(nowAccepted.ok).toBe(true);
  });

  it('an empty candidate set refuses distinctly, never as a false cross-principal match', () => {
    const result = selectPersonaChoice([], personaPublicRef('anything'));
    expect(result).toEqual({ ok: false, reason: 'no_candidates' });
  });
});

// ─── Canary 6 — replayed pending-auth transaction is refused. Behavioural —
// drives the real conditional-update spend path against the fake. ─────────

describe('canary 6 — a replayed pending-auth transaction can never spend twice', () => {
  const FUTURE = new Date(Date.now() + 60_000).toISOString();
  const baseRow = {
    id: 'pending-row-1',
    kybe_identity_id: 'kybe-1',
    root_identity_id: ROOT_A,
    auth_user_id: 'auth-user-1',
    assurance_level: 'wallet_binding',
    audience: 'metame-companion',
    origin: 'https://dev-beta.aigentz.me',
    expires_at: FUTURE,
  };

  it('the first spend succeeds', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: { ...baseRow, consumed_at: null }, error: null }); // read: unconsumed
    fake.queueResult({ data: { id: baseRow.id }, error: null }); // conditional update: won
    const result = await spendPendingAuth(fakeClient(fake), 'raw-token-value');
    expect(result.ok).toBe(true);
  });

  it('a second spend of an ALREADY-consumed row is refused outright (the read already shows it spent)', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: { ...baseRow, consumed_at: new Date().toISOString() }, error: null });
    const result = await spendPendingAuth(fakeClient(fake), 'raw-token-value');
    expect(result).toEqual({ ok: false, reason: 'already_consumed' });
  });

  it('THE race: two spends both read "unconsumed" — only the conditional UPDATE decides, never the read', async () => {
    const fake = new FakeSupabase();
    fake.queueResult({ data: { ...baseRow, consumed_at: null }, error: null }); // read: still looks unconsumed
    fake.queueResult({ data: null, error: null }); // conditional update matched ZERO rows — the other request already won
    const result = await spendPendingAuth(fakeClient(fake), 'raw-token-value');
    expect(result).toEqual({ ok: false, reason: 'already_consumed' });
  });

  it('an expired transaction is refused even though it was successfully spent (spend-before-verify, same discipline as connectionChallenge)', async () => {
    const fake = new FakeSupabase();
    const past = new Date(Date.now() - 60_000).toISOString();
    fake.queueResult({ data: { ...baseRow, expires_at: past, consumed_at: null }, error: null });
    fake.queueResult({ data: { id: baseRow.id }, error: null }); // the spend itself still succeeds — it's judged AFTER
    const result = await spendPendingAuth(fakeClient(fake), 'raw-token-value');
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('structural: the spend is a conditional UPDATE, never read-then-write', () => {
    const code = stripComments(readSource(PENDING_AUTH_SERVICE));
    const spendFnAt = code.indexOf('export async function spendPendingAuth');
    const spendSlice = code.slice(spendFnAt);
    expect(spendSlice).toContain(".is('consumed_at', null)");
  });
});

// ─── Canary 8 — no protected identifier in ANY pre-session/pending-auth
// response payload. ─────────────────────────────────────────────────────

describe('canary 8 — no T0 identifier reaches any pre-session or pending-auth response', () => {
  const FORBIDDEN = ['kybeId', 'rootIdentityId', 'authUserId', 'personaId', 'authProfileId', 'email'];

  it('every NextResponse.json body in /proof and /finalize is clean', () => {
    for (const file of [PROOF_ROUTE, FINALIZE_ROUTE]) {
      const code = stripComments(readSource(file));
      const bodies = extractJsonResponseBodies(code);
      expect(bodies.length, `${file}: extraction found no responses`).toBeGreaterThan(0);
      for (const body of bodies) {
        for (const forbidden of FORBIDDEN) {
          expect(body, `${file} response body contains ${forbidden}`).not.toContain(forbidden);
        }
      }
    }
  });

  it('PersonaChoice — the only persona shape a pre-session response may carry — matches ruling 2 exactly', () => {
    const code = stripComments(readSource(PENDING_AUTH_SERVICE));
    const ifaceAt = code.indexOf('export interface PersonaChoice');
    const iface = code.slice(ifaceAt, code.indexOf('}', ifaceAt));
    expect(iface).toContain('personaPublicRef: string');
    expect(iface).toContain('displayLabel: string');
    for (const forbidden of ['authProfileId', 'personaId:', 'rootDid', 'email', 'standing', 'relationship']) {
      expect(iface, `PersonaChoice widened to include ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the migration keeps the pending-auth row deny-all — no policy is granted to a client role', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.passport_pending_auth');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql, 'a policy grants client access to the pending-auth table').not.toMatch(
      /CREATE POLICY[\s\S]{0,400}passport_pending_auth/i,
    );
  });
});

// ─── Canary 9 — SessionQube receipt created on successful session issuance. ─

describe('canary 9 — a SessionQube receipt is written on successful session issuance', () => {
  it('/finalize writes an activity receipt with the required fields, via the EXISTING unified writer', () => {
    const code = stripComments(readSource(FINALIZE_ROUTE));
    expect(code, 'a parallel receipt writer was introduced').toContain('createActivityReceipt(');
    expect(code, 'a new/forked receipt writer import appeared').toContain(
      "from '@/services/receipts/activityReceiptService'",
    );
    const callAt = code.indexOf('createActivityReceipt({');
    expect(callAt).toBeGreaterThan(-1);
    const call = code.slice(callAt, code.indexOf('});', callAt));
    // Required fields (operator's list, §A.11.5).
    for (const required of [
      'audience: spend.row.audience',
      'origin: spend.row.origin',
      'proofMethod: spend.row.assuranceLevel',
      'assuranceLevel: spend.row.assuranceLevel',
      'passportLineageRef: kybeDidPublicRef',
      'personaPublicRef: selection.choice.personaPublicRef',
      'consent:',
      'issuedAt:',
    ]) {
      expect(call, `SessionQube receipt is missing ${required}`).toContain(required);
    }
    // The receipt call happens AFTER session issuance succeeded, never before
    // — a receipt must record what actually happened, not what was attempted.
    const mintAt = code.indexOf('issuePassportSession(');
    expect(mintAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(mintAt);
  });

  it('the receipt call never receives an excluded T0/relationship field by name', () => {
    const code = stripComments(readSource(FINALIZE_ROUTE));
    const callAt = code.indexOf('createActivityReceipt({');
    const call = code.slice(callAt, code.indexOf('});', callAt));
    // personaId: IS required by createActivityReceipt's own signature
    // (server-internal attribution — never returned to a client from this
    // route; canary 8 above proves the response bodies are clean). Everything
    // ELSE that would be a T0/relationship leak inside the actionInput must
    // still be absent.
    for (const forbidden of ['authProfileId', 'rootDid', 'kybeAttestation', 'walletAddress', 'email']) {
      expect(call, `SessionQube receipt call references ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('no new action type was added — reuses the EXISTING session_started type, DVN pipeline untouched', () => {
    const code = stripComments(readSource(FINALIZE_ROUTE));
    expect(code).toContain("actionType: 'session_started'");
    const dvn = readSource('services/dvn/activityReceiptDvnPipeline.ts');
    expect(dvn, 'the DVN pipeline file was modified by this closure').not.toContain('passport_pending_auth');
    expect(dvn, 'the DVN pipeline file was modified by this closure').not.toContain('passportPendingAuth');
  });
});

// ─── Cross-cutting — the shared kybe→auth-user walk is ONE function, not two
// copies that could drift (inv.engineering.036). ────────────────────────────

describe('the wallet and World ID entry points share one kybe resolution, not two', () => {
  it('resolvePassportPrincipalByWorldId calls the SAME resolveAuthUserForKybe helper the wallet path uses', () => {
    const code = stripComments(readSource(PRINCIPAL));
    const walletFnAt = code.indexOf('export async function resolvePassportPrincipal(');
    const worldIdFnAt = code.indexOf('export async function resolvePassportPrincipalByWorldId');
    expect(walletFnAt).toBeGreaterThan(-1);
    expect(worldIdFnAt).toBeGreaterThan(-1);
    const walletBody = code.slice(walletFnAt, worldIdFnAt);
    const worldIdBody = code.slice(worldIdFnAt, code.indexOf('async function resolveAuthUserForKybe'));
    expect(walletBody).toContain('resolveAuthUserForKybe(');
    expect(worldIdBody).toContain('resolveAuthUserForKybe(');
    // Only ONE definition of the walk exists.
    expect((code.match(/async function resolveAuthUserForKybe/g) ?? []).length).toBe(1);
  });

  it('the root-scoped binding commitment uses a THIRD, uncorrelated HMAC prefix', () => {
    const code = stripComments(readSource(WALLET_ALIAS_SERVICE));
    expect(code).toContain("`root|${rootIdentityId}|${chain}|${normalised}`");
    // Distinct from buildAliasCommitment's `${didPersonaId}|${chain}|${normalised}`
    // and buildAddressFingerprint's `fp|${chain}|${normalised}` — three
    // different message prefixes, none derivable from another.
    expect(code).toContain('`${didPersonaId}|${chain}|${normalised}`');
    expect(code).toContain('`fp|${chain}|${normalised}`');
  });
});

// ─── The persona must survive the STORAGE PARTITION (operator, 2026-07-28:
// "now actions aren't working — red check mark and not pulling over or
// getting right overlay"). ──────────────────────────────────────────────────
//
// §A.11.2 pinned the chosen persona to localStorage.currentPersonaId from the
// Companion panel — which is an IFRAME, whose storage the browser partitions
// away from the top-level application. One cause, three symptoms:
//   1. personaFetch sends no x-persona-id -> getActivePersona falls back;
//   2. MetaMeRuntimeClient LATCHES that fallback into localStorage;
//   3. the extension observer scrapes that same key off the top-level tab,
//      finds nothing, refuses to pair, and every capture dies red.

const COMPLETE_PAGE = 'app/passport-connect/complete/page.tsx';
const CONNECT_PANEL = 'components/companion/PassportConnectPanel.tsx';
const RESOLVED_PERSONA_ROUTE = 'app/api/passport-connect/resolved-persona/route.ts';
const HANDOFF_MIGRATION = 'supabase/migrations/20260832000000_passport_persona_activation_handoff.sql';

describe('the chosen persona survives the partition handoff', () => {
  it('the TOP-LEVEL page redeems the activation and writes the pin', () => {
    // This is the whole fix: without a write here, the top-level app — where
    // the actions, the overlay and the extension observer all actually run —
    // has a session but no chosen persona.
    const page = stripComments(readSource(COMPLETE_PAGE));
    expect(page, 'the complete page no longer redeems the persona activation').toContain(
      '/api/passport-connect/resolved-persona?world=application',
    );
    expect(page, 'the complete page no longer pins the chosen persona').toContain(
      'localStorage.setItem("currentPersonaId"',
    );
    // personaFetch, not raw fetch: the redemption is Bearer-gated and the
    // spine ignores cookies entirely (CLAUDE.md, PARAMOUNT).
    expect(page).toContain('personaFetch(');
  });

  it('the pin is written AFTER the session exists, never before', () => {
    // The redemption is Bearer-gated, so it needs the session verifyOtp
    // establishes in THIS storage world. Ordered, not merely present.
    const page = stripComments(readSource(COMPLETE_PAGE));
    const verifyAt = page.indexOf('verifyOtp(');
    const redeemAt = page.indexOf('resolved-persona?world=application');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(redeemAt).toBeGreaterThan(verifyAt);
  });

  it('the pin overwrites unconditionally — a deliberate choice outranks a latched fallback', () => {
    // MetaMeRuntimeClient persists its own "first owned persona" guess and
    // guards it with `if (!localStorage.getItem(...))`. If this page wrote
    // conditionally too, the wrong latched value would win forever.
    const page = stripComments(readSource(COMPLETE_PAGE));
    const writeAt = page.indexOf('localStorage.setItem("currentPersonaId"');
    const before = page.slice(Math.max(0, writeAt - 400), writeAt);
    expect(before, 'the pin write became conditional on the key being empty').not.toMatch(
      /if\s*\(\s*!\s*(window\.)?localStorage\.getItem\(\s*["']currentPersonaId["']\s*\)\s*\)/,
    );
  });

  it('the panel hands the transaction token to the top-level page', () => {
    const panel = stripComments(readSource(CONNECT_PANEL));
    expect(panel, 'the handoff no longer carries the persona transaction').toMatch(
      /persona_tx=\$\{encodeURIComponent\(transactionToken\)\}/,
    );
  });

  it('the two storage worlds redeem INDEPENDENT single-use markers', () => {
    // One shared marker is what made the pin exist in only one world.
    const svc = stripComments(readSource(PENDING_AUTH_SERVICE));
    expect(svc).toContain("companion: 'persona_activation_consumed_at'");
    expect(svc).toContain("application: 'persona_activation_handoff_consumed_at'");
    // Still a conditional UPDATE per world — single-use is not weakened.
    const fn = svc.slice(svc.indexOf('export async function consumeResolvedPersona'));
    expect(fn).toContain('.is(column, null)');
    const sql = readSource(HANDOFF_MIGRATION);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS persona_activation_handoff_consumed_at');
  });

  it('an unrecognised world can never redeem the OTHER world\'s marker', () => {
    const route = stripComments(readSource(RESOLVED_PERSONA_ROUTE));
    expect(route).toMatch(/rawWorld === 'application' \? 'application' : 'companion'/);
  });
});

describe('no T0 identifier crosses the partition in a URL', () => {
  it('the handoff URL carries only opaque single-use handles — never a personaId', () => {
    const panel = stripComments(readSource(CONNECT_PANEL));
    const openAt = panel.indexOf('/passport-connect/complete?');
    expect(openAt).toBeGreaterThan(-1);
    const url = panel.slice(openAt, panel.indexOf('`', openAt + 1) + 1);
    for (const forbidden of ['personaId', 'persona_id', 'authProfileId', 'rootDid', 'kybe', 'email']) {
      expect(url, `the handoff URL carries ${forbidden}`).not.toContain(forbidden);
    }
    // What it MAY carry: the session grant and the opaque transaction handle.
    expect(url).toContain('token_hash=');
    expect(url).toContain('persona_tx=');
  });

  it('the complete page scrubs the query string BEFORE redeeming anything', () => {
    const page = stripComments(readSource(COMPLETE_PAGE));
    const scrubAt = page.indexOf('history.replaceState');
    const verifyAt = page.indexOf('verifyOtp(');
    const redeemAt = page.indexOf('resolved-persona?world=application');
    expect(scrubAt).toBeGreaterThan(-1);
    expect(scrubAt).toBeLessThan(verifyAt);
    expect(scrubAt).toBeLessThan(redeemAt);
  });

  it('the persona id reaches the browser only in an authenticated response body', () => {
    // The route is Bearer-gated AND auth-user-matched; the id is never a URL
    // parameter anywhere in the flow.
    const route = stripComments(readSource(RESOLVED_PERSONA_ROUTE));
    expect(route).toContain('getCallerIdentityContext');
    expect(route).toContain("error: 'caller_mismatch'");
    for (const file of [COMPLETE_PAGE, CONNECT_PANEL]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} puts a personaId in a URL`).not.toMatch(
        /[?&]personaId=\$\{[^}]*personaId/,
      );
    }
  });
});
