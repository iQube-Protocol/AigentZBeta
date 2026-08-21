/**
 * Admin Action Centre + Citizen auto-issuance — the 12 focused canaries
 * from the operator's P1 brief (2026-08-21), in the operator's own
 * numbering (§15).
 *
 * Methodology: pure-function tests where the logic is pure
 * (evaluateCitizenEvidenceCompleteness), one behavioural test against a
 * minimal fake Supabase admin client (recordAdminAction's idempotency —
 * the actual security/correctness-bearing property, and fake-able without
 * a live DB per the FakeAdmin/FakeChain convention
 * tests/passport-explicit-anchor-resolution.test.ts establishes), and
 * source-authority structural checks (tests/_lib/sourceAuthority.ts) for
 * properties that are genuinely source-level with no runtime surface this
 * sandbox can exercise without a live database (auth gating, deep-link
 * shape, the queue's own status filter).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { evaluateCitizenEvidenceCompleteness } from '@/services/passport/citizenPassportRequirements';
import type { PolityPassportApplicationRow } from '@/services/passport/passportApplicationTypes';

// vi.mock is hoisted to the top of the module regardless of where it is
// written — it must be at module scope (mirrors
// tests/passport-explicit-anchor-resolution.test.ts) so `currentFakeAdmin`
// exists by the time the mocked factory runs, rather than nested inside a
// describe() callback where the closed-over `let` would not yet be
// initialised when the hoisted mock executes.
type FakeAdminResult = { data: unknown; error: { code?: string; message: string } | null };

class FakeAdminChain implements PromiseLike<FakeAdminResult> {
  constructor(private readonly result: FakeAdminResult) {}
  select() { return this; }
  eq() { return this; }
  single(): Promise<FakeAdminResult> { return Promise.resolve(this.result); }
  maybeSingle(): Promise<FakeAdminResult> { return Promise.resolve(this.result); }
  then<T1 = FakeAdminResult, T2 = never>(
    onfulfilled?: ((v: FakeAdminResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeAdminClient {
  private queues: Record<string, FakeAdminResult[]> = {};
  queue(table: string, result: FakeAdminResult): this {
    (this.queues[table] ??= []).push(result);
    return this;
  }
  from(_table: string) {
    const table = _table;
    const q = this.queues[table];
    const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
    return { insert: () => new FakeAdminChain(result), select: () => new FakeAdminChain(result) };
  }
}

let currentFakeAdmin: FakeAdminClient;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentFakeAdmin,
}));

const CITIZEN_AUTO_ISSUANCE = 'services/passport/citizenAutoIssuance.ts';
const ISSUANCE_SERVICE = 'services/passport/issuanceService.ts';
const PASSPORT_STATUS_MACHINE = 'services/passport/passportStatusMachine.ts';
const REVIEW_QUEUE_ROUTE = 'app/api/passport/review/queue/route.ts';
const ADMIN_ACTIONS_LIST_ROUTE = 'app/api/admin/actions/route.ts';
const ADMIN_ACTIONS_READ_ROUTE = 'app/api/admin/actions/[id]/read/route.ts';
const ADMIN_ACTIONS_RESOLVE_ROUTE = 'app/api/admin/actions/[id]/resolve/route.ts';
const ADMIN_ACTION_SERVICE = 'services/adminActions/adminActionService.ts';
const CODEX_CONFIGS = 'data/codex-configs.ts';

function baseRow(overrides: Partial<PolityPassportApplicationRow> = {}): PolityPassportApplicationRow {
  return {
    id: 'app-1',
    passport_class: 'citizen',
    application_status: 'submitted',
    persona_id: 'persona-1',
    personhood_proof_type: 'captcha',
    personhood_proof_ref: 'proof-ref-1',
    consents: {
      passport_terms_accepted: true,
      privacy_terms_accepted: true,
      registry_pending_record_consent: true,
      blackqube_private_storage_consent: true,
      self_custody_acknowledgements: {
        private_data_not_stored_in_supabase_acknowledged: true,
        bureau_cannot_decrypt_private_payload_acknowledged: true,
        sysadmins_cannot_recover_private_payload_acknowledged: true,
        loss_of_key_risk_acknowledged: true,
      },
    },
    review_priority: 'normal',
    passport_grade: 'anonymous_citizen',
    ...overrides,
  };
}

const NO_CONFLICT = { conflictingOpenApplicationExists: false, activeCitizenPassportExists: false };

describe('§15.2 — automatic Citizen issuance: evidence complete → complete:true', () => {
  it('a well-formed application with no conflicts evaluates complete', () => {
    const result = evaluateCitizenEvidenceCompleteness(baseRow(), NO_CONFLICT);
    expect(result.complete).toBe(true);
  });
});

describe('§15.3 — evidence ambiguity/incompleteness → action_required (complete:false)', () => {
  it('missing persona_id → evidence_incomplete / identity_binding_incomplete', () => {
    const result = evaluateCitizenEvidenceCompleteness(baseRow({ persona_id: null }), NO_CONFLICT);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reasonCode).toBe('evidence_incomplete');
      expect(result.schemaReasonCodes).toContain('identity_binding_incomplete');
    }
  });

  it('missing weak proof → evidence_incomplete / personhood_proof_insufficient', () => {
    const result = evaluateCitizenEvidenceCompleteness(
      baseRow({ personhood_proof_type: null, personhood_proof_ref: null }),
      NO_CONFLICT,
    );
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reasonCode).toBe('evidence_incomplete');
      expect(result.schemaReasonCodes).toContain('personhood_proof_insufficient');
    }
  });

  it('a missing mandatory consent → evidence_incomplete / obligations_not_accepted', () => {
    const row = baseRow();
    const consents = { ...(row.consents as Record<string, unknown>), passport_terms_accepted: false };
    const result = evaluateCitizenEvidenceCompleteness({ ...row, consents }, NO_CONFLICT);
    expect(result.complete).toBe(false);
    if (!result.complete) expect(result.reasonCode).toBe('evidence_incomplete');
  });

  it('a missing mandatory self-custody acknowledgement → evidence_incomplete / obligations_not_accepted', () => {
    const row = baseRow();
    const consents = row.consents as Record<string, unknown>;
    const acks = { ...(consents.self_custody_acknowledgements as Record<string, unknown>), loss_of_key_risk_acknowledged: false };
    const result = evaluateCitizenEvidenceCompleteness(
      { ...row, consents: { ...consents, self_custody_acknowledgements: acks } },
      NO_CONFLICT,
    );
    expect(result.complete).toBe(false);
    if (!result.complete) expect(result.reasonCode).toBe('evidence_incomplete');
  });

  it('a conflicting open application → evidence_conflict / human_review_required (never a denial)', () => {
    const result = evaluateCitizenEvidenceCompleteness(baseRow(), {
      conflictingOpenApplicationExists: true,
      activeCitizenPassportExists: false,
    });
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reasonCode).toBe('evidence_conflict');
      expect(result.schemaReasonCodes).toContain('human_review_required');
    }
  });

  it('an already-active Citizen Passport → evidence_conflict, never a denial', () => {
    const result = evaluateCitizenEvidenceCompleteness(baseRow(), {
      conflictingOpenApplicationExists: false,
      activeCitizenPassportExists: true,
    });
    expect(result.complete).toBe(false);
    if (!result.complete) expect(result.reasonCode).toBe('evidence_conflict');
  });
});

describe('§15.1 — new application received is recorded unconditionally, before evaluation', () => {
  it('citizenAutoIssuance records the informational new-application item BEFORE evaluating completeness', () => {
    const src = stripComments(readSource(CITIZEN_AUTO_ISSUANCE));
    // The CALL site — `passportNewApplicationKey(applicationId)` — not the
    // import line (which also contains the bare identifier).
    const newAppAt = src.indexOf('passportNewApplicationKey(applicationId)');
    const evalAt = src.indexOf('evaluateCitizenEvidenceCompleteness(row');
    expect(newAppAt, 'expected a passportNewApplicationKey(applicationId) call').toBeGreaterThan(-1);
    expect(evalAt, 'expected an evaluateCitizenEvidenceCompleteness(row call').toBeGreaterThan(-1);
    expect(newAppAt).toBeLessThan(evalAt);
    // And it must be informational, not action_required.
    const block = src.slice(newAppAt - 200, newAppAt + 200);
    expect(block).toMatch(/disposition:\s*['"]informational['"]/);
  });
});

describe('§15.4 — issuance infrastructure failure is an operational exception, never an applicant rejection', () => {
  it('a failed applyReviewDecision after complete evidence records action_required, not a denial', () => {
    const src = stripComments(readSource(CITIZEN_AUTO_ISSUANCE));
    const failAt = src.indexOf('!result.ok');
    expect(failAt, 'expected a !result.ok branch after applyReviewDecision').toBeGreaterThan(-1);
    const block = src.slice(failAt, src.indexOf('return { issued: false', failAt));
    expect(block).toMatch(/passportIssuanceFailedKey/);
    expect(block).toMatch(/disposition:\s*['"]action_required['"]/);
    expect(block).not.toMatch(/decision:\s*['"]deny['"]/);
    expect(block).toMatch(/operational failure|Issuance transition failed/i);
  });
});

describe('§15.5 — a repeated source event never creates a duplicate admin action (idempotency)', () => {
  beforeEach(() => {
    currentFakeAdmin = new FakeAdminClient();
    vi.resetModules();
  });

  it('the second call with the same idempotencyKey returns the existing row, created:false', async () => {
    const { recordAdminAction } = await import('@/services/adminActions/adminActionService');

    currentFakeAdmin.queue('admin_action_items', { data: { id: 'row-1' }, error: null });
    const first = await recordAdminAction({
      idempotencyKey: 'passport-new-application:app-1',
      category: 'passport',
      severity: 'info',
      disposition: 'informational',
      title: 'New Citizen Passport application received',
      summary: 'x',
      sourceType: 'passport_application',
    });
    expect(first).toEqual({ ok: true, id: 'row-1', created: true });

    currentFakeAdmin.queue('admin_action_items', { data: null, error: { code: '23505', message: 'duplicate key' } });
    currentFakeAdmin.queue('admin_action_items', { data: { id: 'row-1' }, error: null });
    const second = await recordAdminAction({
      idempotencyKey: 'passport-new-application:app-1',
      category: 'passport',
      severity: 'info',
      disposition: 'informational',
      title: 'New Citizen Passport application received',
      summary: 'x',
      sourceType: 'passport_application',
    });
    expect(second).toEqual({ ok: true, id: 'row-1', created: false });
  });
});

describe('§15.6/§15.7 — the Admin Action Centre list/resolve routes require cartridge admin', () => {
  it('the list route gates via requireCartridgeAdmin', () => {
    const src = stripComments(readSource(ADMIN_ACTIONS_LIST_ROUTE));
    expect(src).toMatch(/requireCartridgeAdmin\(req,\s*['"]polity-passport-bureau['"]\)/);
    expect(src).toMatch(/gate instanceof NextResponse/);
  });

  it('the resolve route gates via requireCartridgeAdmin', () => {
    const src = stripComments(readSource(ADMIN_ACTIONS_RESOLVE_ROUTE));
    expect(src).toMatch(/requireCartridgeAdmin\(req,\s*['"]polity-passport-bureau['"]\)/);
    expect(src).toMatch(/gate instanceof NextResponse/);
  });
});

describe('§15.8 — an admin can mark an item read', () => {
  it('the read route calls markAdminActionRead behind the same admin gate', () => {
    const src = stripComments(readSource(ADMIN_ACTIONS_READ_ROUTE));
    expect(src).toMatch(/requireCartridgeAdmin\(req,\s*['"]polity-passport-bureau['"]\)/);
    expect(src).toMatch(/markAdminActionRead\(/);
  });
});

describe('§15.9 — resolving an admin action is independent of the underlying Passport state', () => {
  it('resolveAdminAction touches only admin_action_items, never a passport table', () => {
    const src = stripComments(readSource(ADMIN_ACTION_SERVICE));
    const fnAt = src.indexOf('export async function resolveAdminAction');
    expect(fnAt).toBeGreaterThan(-1);
    const fnEnd = src.indexOf('\nexport ', fnAt + 10);
    const body = src.slice(fnAt, fnEnd > -1 ? fnEnd : undefined);
    const fromCalls = body.match(/\.from\(['"][a-z_]+['"]\)/g) ?? [];
    expect(fromCalls.length).toBeGreaterThan(0);
    for (const call of fromCalls) expect(call).toContain('admin_action_items');
  });
});

describe('§15.10 — the action item deep-link points at the EXISTING Passport Bureau review surface', () => {
  it('reviewApplicationHref targets the real codex slug + tab slug', () => {
    const href = stripComments(readSource(CITIZEN_AUTO_ISSUANCE));
    expect(href).toMatch(/\/triad\/embed\/codex\/polity-passport-bureau\?tab=steward/);

    // Cross-check against the actual codex registration — the slug/tab
    // combination must exist in data/codex-configs.ts, not just be
    // plausible-looking.
    const configs = readSource(CODEX_CONFIGS);
    expect(configs).toMatch(/slug:\s*'polity-passport-bureau'/);
    expect(configs).toMatch(/slug:\s*'steward'/);
  });
});

describe('§15.11 — an auto-issued Citizen application never appears as pending manual approval', () => {
  it("the review queue's default status filter excludes 'approved'", () => {
    const src = stripComments(readSource(REVIEW_QUEUE_ROUTE));
    const filterAt = src.indexOf("['submitted', 'pending_approval', 'needs_more_information']");
    expect(filterAt, 'expected the queue default status filter literal').toBeGreaterThan(-1);
    expect(src).not.toMatch(/\[['"]submitted['"],\s*['"]pending_approval['"],\s*['"]needs_more_information['"],\s*['"]approved['"]\]/);
  });
});

describe('§15.12 — the Citizen flow introduces no deny/reject transition', () => {
  it('CitizenPassportStatus still carries no denied/revoked state', () => {
    const src = stripComments(readSource(PASSPORT_STATUS_MACHINE));
    const enumAt = src.indexOf('export type CitizenPassportStatus');
    const enumEnd = src.indexOf(';', enumAt);
    const citizenEnum = src.slice(enumAt, enumEnd);
    expect(citizenEnum).not.toMatch(/'denied'/);
    expect(citizenEnum).not.toMatch(/'revoked'/);
  });

  it('applyReviewDecision rejects decision "deny" for citizen applications', () => {
    const src = stripComments(readSource(ISSUANCE_SERVICE));
    const guardAt = src.indexOf("isCitizen && input.decision === 'deny'");
    expect(guardAt, 'expected the citizen-deny rejection guard').toBeGreaterThan(-1);
    const guardBlock = src.slice(guardAt, src.indexOf('}', src.indexOf('{', guardAt)) + 1);
    expect(guardBlock).toMatch(/ok:\s*false/);
  });

  it("'escalate' is rejected for non-citizen (participant/agent) applications — no cross-contamination", () => {
    const src = stripComments(readSource(ISSUANCE_SERVICE));
    const guardAt = src.indexOf("!isCitizen && input.decision === 'escalate'");
    expect(guardAt, 'expected the participant-escalate rejection guard').toBeGreaterThan(-1);
  });
});
