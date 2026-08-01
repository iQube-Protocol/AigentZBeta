/**
 * Independent Reviewer Agreement — the experiment-scoped consent artifact and
 * its x409 gate (operator ruling, 2026-08-02).
 *
 * The ruling's required canaries, in its own order:
 *
 *   non-review-readable role cannot receive experiment reviewer invitation
 *   reviewer can inspect the EXP-P1 agreement
 *   agreement display alone does not authorize it
 *   wrong principal cannot reuse another reviewer's authorization
 *   wrong experiment/version/package does not satisfy the gate
 *   expired/revoked/superseded agreement does not satisfy the gate
 *   missing agreement returns structured 409
 *   authorized agreement enables submission
 *   review submission does not freeze, publish, canonise or grant Standing
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSource, stripComments, importAuthority, extractJsonResponseBodies } from './_lib/sourceAuthority';
import {
  EXP_P1_REVIEWER_AGREEMENT_V1,
  REVIEWER_AGREEMENTS,
  REVIEWER_AGREEMENT_REQUIRED,
  agreementHash,
  agreementCoversPackage,
  currentReviewerAgreement,
  requireReviewerAgreement,
  isReviewerAgreementAuthorized,
} from '@/services/research/reviewerAgreement';

const SERVICE = 'services/research/reviewerAgreement.ts';
const ROUTE = 'app/api/research/reviewer-agreement/route.ts';
const PANEL = 'components/research/ReviewerAgreementPanel.tsx';

// ─── A minimal fake Supabase query builder (repo convention) ───────────────

type FakeResult = { data: unknown; error: unknown };

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  constructor(private readonly result: FakeResult) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  maybeSingle() {
    return this;
  }
  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((v: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function fakeAdmin(rows: Record<string, unknown>[] | null, error: unknown = null): SupabaseClient {
  return { from: () => new FakeQueryBuilder({ data: rows, error }) } as unknown as SupabaseClient;
}

/** A stored authorization row matching the canonical v1 agreement. */
function authRow(over: Record<string, unknown> = {}) {
  return {
    id: 'auth-1',
    persona_id: 'persona-reviewer',
    reviewer_ref: 'ref-reviewer',
    passport_ref: null,
    agreement_id: EXP_P1_REVIEWER_AGREEMENT_V1.agreementId,
    agreement_version: EXP_P1_REVIEWER_AGREEMENT_V1.version,
    agreement_hash: agreementHash(EXP_P1_REVIEWER_AGREEMENT_V1),
    experiment_id: 'EXP-P1',
    package_scope: '*',
    conflict_declared: false,
    conflict_statement: null,
    authorized_at: '2026-08-02T00:00:00.000Z',
    proof_ref: null,
    receipt_id: 'receipt-1',
    status: 'active',
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The artifact
// ─────────────────────────────────────────────────────────────────────────

describe('The agreement is a canonical, reusable, experiment-scoped artifact', () => {
  it('is registered under the ruled id, versioned and bound to EXP-P1', () => {
    expect(EXP_P1_REVIEWER_AGREEMENT_V1.agreementId).toBe('agreement.exp-p1.independent-review.v1');
    expect(EXP_P1_REVIEWER_AGREEMENT_V1.version).toBe('v1');
    expect(EXP_P1_REVIEWER_AGREEMENT_V1.experimentId).toBe('EXP-P1');
    expect(currentReviewerAgreement('EXP-P1')?.agreementId).toBe(EXP_P1_REVIEWER_AGREEMENT_V1.agreementId);
  });

  it('is reusable, not per-collaborator — it names no individual reviewer or agent', () => {
    const serialised = JSON.stringify(EXP_P1_REVIEWER_AGREEMENT_V1).toLowerCase();
    // The one-off console artifact bound a named collaborator + agent ref.
    expect(serialised).not.toContain('austin');
    expect(serialised).not.toContain('selectedagentref');
    expect(serialised).not.toContain('agent:');
  });

  it('binds every element the ruling requires', () => {
    const clauseIds = EXP_P1_REVIEWER_AGREEMENT_V1.clauses.map((c) => c.id);
    for (const required of [
      'mandate',
      'non-ratification',
      'consequence-boundary',
      'independence',
      'conflict',
      'evidence-handling',
      'submission',
      'supersession',
    ]) {
      expect(clauseIds, `clause "${required}" must be present`).toContain(required);
    }
    expect(EXP_P1_REVIEWER_AGREEMENT_V1.effectiveFrom).toBeTruthy();
    expect(EXP_P1_REVIEWER_AGREEMENT_V1.packageScope).toBeTruthy();
  });

  it('states the consequence boundary explicitly — no freeze, canonise, publish, lifecycle or Standing', () => {
    const prohibited = EXP_P1_REVIEWER_AGREEMENT_V1.prohibitedActs.join(' ').toLowerCase();
    for (const act of ['freeze', 'canonise', 'publish', 'lifecycle', 'standing']) {
      expect(prohibited, `"${act}" must be explicitly prohibited`).toContain(act);
    }
  });

  it('states that findings are evidence, not ratification, and that contested stays contested', () => {
    const text = EXP_P1_REVIEWER_AGREEMENT_V1.clauses.map((c) => c.body).join(' ').toLowerCase();
    expect(text).toContain('evidence');
    expect(text).toContain('do not ratify');
    expect(text).toContain('contested findings remain contested');
    expect(text).toContain('attributable to you');
  });

  it('permits only inspect/comment/cite/recommend/contest/unable-to-assess/submit', () => {
    const permitted = EXP_P1_REVIEWER_AGREEMENT_V1.permittedActs.join(' ').toLowerCase();
    expect(permitted).toContain('inspect');
    expect(permitted).toContain('comment');
    expect(permitted).toContain('recommend');
    expect(permitted).toContain('contest');
    expect(permitted).toContain('unable-to-assess');
    // And never a governed act.
    expect(permitted).not.toContain('freeze');
    expect(permitted).not.toContain('publish');
    expect(permitted).not.toContain('ratify');
  });

  it('the hash covers the terms — a wording or permission change changes it', () => {
    const base = agreementHash(EXP_P1_REVIEWER_AGREEMENT_V1);
    const reworded = agreementHash({
      ...EXP_P1_REVIEWER_AGREEMENT_V1,
      clauses: [{ ...EXP_P1_REVIEWER_AGREEMENT_V1.clauses[0], body: 'materially different terms' }],
    });
    const widened = agreementHash({
      ...EXP_P1_REVIEWER_AGREEMENT_V1,
      permittedActs: [...EXP_P1_REVIEWER_AGREEMENT_V1.permittedActs, 'freeze the crystal'],
    });
    expect(reworded).not.toBe(base);
    expect(widened).not.toBe(base);
    // Stable across recomputation — a pinned hash must stay comparable.
    expect(agreementHash(EXP_P1_REVIEWER_AGREEMENT_V1)).toBe(base);
  });

  it('is frozen so it cannot be edited in place at runtime', () => {
    expect(Object.isFrozen(EXP_P1_REVIEWER_AGREEMENT_V1)).toBe(true);
    expect(Object.isFrozen(REVIEWER_AGREEMENTS)).toBe(true);
  });

  it('package scope: "*" covers everything; a pinned list covers only its members', () => {
    expect(agreementCoversPackage(EXP_P1_REVIEWER_AGREEMENT_V1, 'pkg-any')).toBe(true);
    const pinned = { ...EXP_P1_REVIEWER_AGREEMENT_V1, packageScope: ['pkg-a'] as string[] };
    expect(agreementCoversPackage(pinned, 'pkg-a')).toBe(true);
    expect(agreementCoversPackage(pinned, 'pkg-b')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The gate
// ─────────────────────────────────────────────────────────────────────────

describe('requireReviewerAgreement — the x409 gate', () => {
  it('an authorized agreement enables submission', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin([authRow()]), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-P1',
    });
    expect(gate.ok).toBe(true);
    expect(gate.authorization?.agreementId).toBe(EXP_P1_REVIEWER_AGREEMENT_V1.agreementId);
  });

  it('a MISSING agreement returns the structured 409 refusal, not a generic failure', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin([]), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-P1',
    });
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('no-authorization');
    expect(gate.refusal).toEqual({
      code: REVIEWER_AGREEMENT_REQUIRED,
      experimentId: 'EXP-P1',
      agreementId: 'agreement.exp-p1.independent-review.v1',
      agreementVersion: 'v1',
      requiredAction: 'AUTHORIZE_REVIEWER_AGREEMENT',
      reason: 'no-authorization',
    });
  });

  it('a MATERIALLY CHANGED version does not satisfy the gate — the pinned hash no longer matches', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin([authRow({ agreement_hash: 'stale-hash-from-older-terms' })]), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-P1',
    });
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('hash-mismatch');
    expect(gate.refusal?.requiredAction).toBe('AUTHORIZE_REVIEWER_AGREEMENT');
  });

  it('an authorization for a DIFFERENT agreement id does not satisfy the gate', async () => {
    const gate = await requireReviewerAgreement(
      fakeAdmin([authRow({ agreement_id: 'agreement.exp-p1.independent-review.v0' })]),
      { personaId: 'persona-reviewer', experimentId: 'EXP-P1' },
    );
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('version-superseded');
  });

  it('a REVOKED or SUPERSEDED authorization does not satisfy the gate — only status=active is queried', () => {
    // Structural: the query pins status='active', so a revoked/superseded row
    // is never a candidate. (The fake builder ignores .eq, so this property is
    // asserted at the source rather than through the stub.)
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('export async function requireReviewerAgreement(');
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain(".eq('status', 'active')");
  });

  it('a WRONG PACKAGE does not satisfy the gate when the authorization is package-pinned', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin([authRow({ package_scope: ['pkg-a'] })]), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-P1',
      packageRef: 'pkg-b',
    });
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('package-scope');
  });

  it('a WRONG PRINCIPAL cannot reuse another reviewer\'s authorization — the query is persona-scoped', () => {
    // Structural for the same reason as the revoked case: the row filter is
    // `persona_id = caller`, so another reviewer's row is never returned.
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('export async function requireReviewerAgreement(');
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain(".eq('persona_id', input.personaId)");
    // And nothing may widen it back out.
    expect(body).not.toContain('.neq(');
  });

  it('a store error fails UNKNOWN, distinguishable from a real refusal', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin(null, { message: 'boom' }), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-P1',
    });
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('unavailable');
  });

  it('an experiment with no defined agreement refuses structurally rather than passing', async () => {
    const gate = await requireReviewerAgreement(fakeAdmin([]), {
      personaId: 'persona-reviewer',
      experimentId: 'EXP-NOT-DEFINED',
    });
    expect(gate.ok).toBe(false);
    expect(gate.failure).toBe('no-agreement-defined');
  });

  it('isReviewerAgreementAuthorized is the same rule, not a second implementation', async () => {
    expect(await isReviewerAgreementAuthorized(fakeAdmin([authRow()]), 'persona-reviewer', 'EXP-P1')).toBe(true);
    expect(await isReviewerAgreementAuthorized(fakeAdmin([]), 'persona-reviewer', 'EXP-P1')).toBe(false);
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('export async function isReviewerAgreementAuthorized(');
    expect(src.slice(start, src.indexOf('\n}', start))).toContain('requireReviewerAgreement(');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Display is not consent
// ─────────────────────────────────────────────────────────────────────────

describe('Agreement display alone does not authorize it', () => {
  it('the GET route has no write path — reading the agreement records nothing', () => {
    const src = stripComments(readSource(ROUTE));
    const start = src.indexOf('export async function GET(');
    const body = src.slice(start, src.indexOf('export async function POST(', start));
    expect(body).not.toContain('authorizeReviewerAgreement(');
    expect(body).not.toContain('.insert(');
    expect(body).not.toContain('.update(');
  });

  it('authorization requires an EXPLICIT acknowledgement — an unacknowledged POST is refused', () => {
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('export async function authorizeReviewerAgreement(');
    const body = src.slice(start, src.indexOf('\n}\n', start));
    expect(body).toContain('if (!input.acknowledged)');
  });

  it('a declared conflict without a statement is refused — disclosure must actually disclose', () => {
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('export async function authorizeReviewerAgreement(');
    const body = src.slice(start, src.indexOf('\n}\n', start));
    expect(body).toContain('input.conflictDeclared && !input.conflictStatement');
  });

  it('the panel never sets its own authorized flag — it is read from the server derivation', () => {
    const src = stripComments(readSource(PANEL));
    // setAuthorized appears only where the server response is applied.
    const sets = [...src.matchAll(/setAuthorized\(([^)]*)\)/g)].map((m) => m[1]);
    expect(sets.length).toBeGreaterThan(0);
    for (const arg of sets) {
      expect(arg, 'authorized may only come from the server payload').toContain('body');
    }
    expect(src).not.toContain('setAuthorized(true)');
  });

  it('the conflict question has NO default — unanswered is not "no conflict"', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain('useState<boolean | null>(null)');
    // Submit is blocked while unanswered.
    expect(src).toContain('conflictDeclared === null');
  });

  it('the panel echoes the displayed hash so consent cannot be recorded against unseen terms', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain('agreementHash: agreement.agreementHash');
    const route = stripComments(readSource(ROUTE));
    expect(route).toContain("error: 'agreement_changed'");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Consent ≠ access ≠ submission ≠ freeze
// ─────────────────────────────────────────────────────────────────────────

describe('The agreement never becomes access, submission, or governed authority', () => {
  it('the agreement does not grant review access — the route checks access FIRST and independently', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain('diagnoseExperimentReviewAccess(');
    // Both GET and POST refuse without reach, so an agreement is never a route in.
    expect((src.match(/review_access_required/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('authorizing does not freeze, publish, canonise or grant Standing', () => {
    const src = stripComments(readSource(SERVICE));
    // CALLS, not words — the agreement's own prohibition clauses legitimately
    // contain "canonise", "publish" and "ratify" as TERMS the reviewer is
    // consenting to be bound by. Grepping the bare word would flag the module
    // for correctly stating its own boundary, which is the grep-vs-prose
    // defect tests/_lib/sourceAuthority.ts exists to prevent.
    for (const forbidden of ['freezeCrystal(', 'publishReport(', 'canonise(', 'grantStanding(', 'ratify(']) {
      expect(src, `reviewerAgreement must not call ${forbidden}`).not.toContain(forbidden);
    }
    // Import authority is the stronger check: a module cannot call what it
    // never bound.
    const graph = importAuthority(readSource(SERVICE));
    for (const r of graph.records) {
      expect(r.specifier).not.toMatch(/crystalFreeze|freezeCeremony|publish/i);
    }
    const bound = [...graph.boundNames].join(' ').toLowerCase();
    for (const forbidden of ['freeze', 'canonise', 'ratify', 'standing']) {
      expect(bound, `must bind nothing named ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the receipt records an authorization only, and says what it does NOT confer', () => {
    const src = readSource(SERVICE);
    expect(src).toContain("actionType: 'agreement_authorized'");
    expect(src).toMatch(/confers no freeze, publication, canonisation or Standing authority/);
  });

  it('T0 law: the receipt and every client payload carry reviewerRef, never a persona id', () => {
    const src = stripComments(readSource(SERVICE));
    const start = src.indexOf('const receipt = await createActivityReceipt({');
    const receiptBlock = src.slice(start, src.indexOf('});', start));
    expect(receiptBlock).toContain('reviewer=${reviewerRef}');
    expect(receiptBlock).not.toMatch(/\$\{input\.personaId\}/);

    // Only the RESPONSE BODIES matter here: passing persona.personaId to a
    // server-side function is correct and necessary (that is how the row is
    // scoped to its owner). What must never happen is serialising it to the
    // caller — so extract exactly what reaches NextResponse.json.
    for (const body of extractJsonResponseBodies(stripComments(readSource(ROUTE)))) {
      expect(body, 'no response body may serialise a raw persona id').not.toContain('personaId');
      expect(body).not.toContain('persona.personaId');
    }
  });

  it('the Submit Review stage no longer hosts the invitation claim — accession happens before entry', () => {
    const src = stripComments(readSource('services/journey/validationProgrammeJourney.ts'));
    const start = src.indexOf("id: 'submit-review'");
    const stage = src.slice(start, src.indexOf("id: 'experiment-progress'", start));
    expect(stage).toContain("visibleSections: ['peerExchange', 'uploadToLocker']");
    expect(stage, 'the invitation panel must be gone from this stage').not.toContain("'invitation'");
  });

  it('the Submit Review stage exposes the agreement surface, and no broader Locker capability', () => {
    const src = stripComments(readSource('services/journey/validationProgrammeJourney.ts'));
    const start = src.indexOf("id: 'submit-review'");
    const stage = src.slice(start, src.indexOf("id: 'experiment-progress'", start));
    expect(stage).toContain('validation-programme-reviewer-agreement');
    for (const wider of ['credentials', 'agentChannels', 'lockerItems', 'locationTracking']) {
      expect(stage, `visibility must not widen to ${wider}`).not.toContain(wider);
    }
  });
});
