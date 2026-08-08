/**
 * CFS Agreement Authority — RootDID binding (operator directive, 2026-08-08).
 *
 * "CFS agreements are RootDID-authority-bound, not persona-authority-bound."
 * Diagnosis (an Explore agent's read-only investigation, same day) found:
 *   - `authorizeAgreement` checked `ownerCommitment` — a PERSONA-level
 *     commitment set once at formation — so a different persona could never
 *     authorize what another persona formed, even under the same RootDID.
 *   - "Ratified" and "Agreement authorized" in AgreementRatifyPanel.tsx are
 *     the SAME underlying fact (`agreement.status === 'authorized' | ...`)
 *     rendered twice (a badge + a button label) — genuinely not two
 *     constitutional states, so no duplication to resolve there.
 *   - The RootDID-resolving walk already existed (private
 *     `lookupExistingBinding` in services/passport/bureauIdentityService.ts)
 *     and is now exported as `resolveRootDidCommitment` — reused here, never
 *     duplicated (inv.engineering.036/037).
 *
 * This file exercises the resulting `authorityBinding: 'ROOT_DID'` branch in
 * `formAgreement`/`authorizeAgreement`, mocking the identity-spine resolver
 * and the durable store (an in-memory fake, keyed like the real
 * `constitutional_agreements` table) — never a live Supabase call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveRootDidCommitment = vi.fn();
vi.mock('@/services/passport/bureauIdentityService', () => ({
  resolveRootDidCommitment: (...args: any[]) => mockResolveRootDidCommitment(...args),
}));

const mockHasVerifiedWorldIdPassport = vi.fn();
vi.mock('@/services/passport/personhoodProof', () => ({
  hasVerifiedWorldIdPassport: (...args: any[]) => mockHasVerifiedWorldIdPassport(...args),
}));

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${Math.random().toString(36).slice(2)}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

// ── In-memory fake for the constitutional_agreements table ─────────────────
const rows = new Map<string, Record<string, unknown>>();
let idCounter = 0;

function findByColumn(col: string, val: unknown) {
  return [...rows.values()].find((r) => r[col] === val) ?? null;
}

function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table !== 'constitutional_agreements') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (col: string, val: unknown) => ({
            maybeSingle: async () => ({ data: findByColumn(col, val), error: null }),
          }),
        }),
        insert: (values: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              idCounter += 1;
              const row = { id: `row-${idCounter}`, created_at: 'now', updated_at: 'now', ...values };
              rows.set(String(values.agreement_id), row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => ({
            select: () => ({
              single: async () => {
                const row = findByColumn(col, val);
                if (!row) return { data: null, error: { message: 'not found' } };
                Object.assign(row, patch);
                return { data: row, error: null };
              },
            }),
          }),
        }),
      };
    },
  } as any;
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin(),
}));

import { formAgreement, authorizeAgreement, acceptAgreement } from '@/services/constitutional/constitutionalAgreement';
import { PROOF_REQUIREMENT } from '@/services/constitutional/guidedOnboarding';

const PERSONA_ARK = 'persona-arkagent';
const PERSONA_Z = 'persona-aigent-z';
const PERSONA_OTHER_ROOTDID = 'persona-other-rootdid';
const PERSONA_UNRESOLVABLE = 'persona-no-rootdid';

const ROOTDID_A = 'rootdid-commit-aaaa1111';
const ROOTDID_B = 'rootdid-commit-bbbb2222';

const DELEGATED_AUTHORITY = {
  band: 'L2',
  allowedActions: ['read_balance'],
  forbiddenActions: [],
  allowedSurfaces: ['runtime'],
  ttlHours: 8,
  maxActions: 5,
  valueCeiling: null,
};

function baseFormInput(agreementId: string, overrides: Partial<Parameters<typeof formAgreement>[1]> = {}) {
  return {
    agreementId,
    displayLabel: 'CFS Test Agreement',
    capabilityRef: 'cap-cfs-test',
    selectedAgentRef: 'aigent-nakamoto',
    delegatedAuthority: DELEGATED_AUTHORITY,
    authorityBinding: 'ROOT_DID' as const,
    ...overrides,
  };
}

async function formAcceptAs(personaId: string, agreementId: string, overrides: Partial<Parameters<typeof formAgreement>[1]> = {}) {
  const formed = await formAgreement(personaId, baseFormInput(agreementId, overrides));
  expect(formed.ok).toBe(true);
  const accepted = await acceptAgreement(personaId, { agreementId, acceptorType: 'operator', acceptorId: personaId });
  expect(accepted.ok).toBe(true);
  return formed;
}

beforeEach(() => {
  rows.clear();
  idCounter = 0;
  createActivityReceipt.mockClear();
  mockResolveRootDidCommitment.mockReset();
  mockHasVerifiedWorldIdPassport.mockReset();
  mockHasVerifiedWorldIdPassport.mockResolvedValue(true);
  mockResolveRootDidCommitment.mockImplementation(async (personaId: string) => {
    if (personaId === PERSONA_ARK || personaId === PERSONA_Z) return { rootDidPublicRef: ROOTDID_A };
    if (personaId === PERSONA_OTHER_ROOTDID) return { rootDidPublicRef: ROOTDID_B };
    return {};
  });
});

describe('CFS Agreement Authority — RootDID binding (2026-08-08)', () => {
  it('form as ArkAgent -> authorize as ArkAgent (same RootDID) -> PASS', async () => {
    const agreementId = 'agr-rootdid-same-persona';
    await formAcceptAs(PERSONA_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_ARK, { agreementId });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agreement.status).toBe('authorized');
  });

  it('form as ArkAgent -> authorize as Aigent Z (different persona, same RootDID) -> PASS', async () => {
    const agreementId = 'agr-rootdid-cross-persona';
    await formAcceptAs(PERSONA_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agreement.status).toBe('authorized');
  });

  it('form under RootDID A -> authorize through a persona belonging to RootDID B -> REFUSE', async () => {
    const agreementId = 'agr-rootdid-mismatch';
    await formAcceptAs(PERSONA_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_OTHER_ROOTDID, { agreementId });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('same RootDID');
    // Never silently authorized — the row must still read 'accepted'.
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('accepted');
  });

  it('forming a ROOT_DID-bound agreement REFUSES when the forming persona has no resolvable RootDID — fails closed, never forms with a null principal', async () => {
    const formed = await formAgreement(PERSONA_UNRESOLVABLE, baseFormInput('agr-rootdid-unresolvable-form'));
    expect(formed.ok).toBe(false);
    if (!formed.ok) expect(formed.reason).toContain('RootDID');
  });

  it('authorizing REFUSES when the authorizing persona has no resolvable RootDID at all — never treats "unresolvable" as "matches"', async () => {
    const agreementId = 'agr-rootdid-authorizer-unresolvable';
    await formAcceptAs(PERSONA_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_UNRESOLVABLE, { agreementId });

    expect(result.ok).toBe(false);
  });

  it('same RootDID but the CFS verification requirement is unmet -> REFUSE (RootDID equivalence is necessary, not sufficient)', async () => {
    const agreementId = 'agr-rootdid-verification-unmet';
    await formAcceptAs(PERSONA_ARK, agreementId, { verificationRequirements: [PROOF_REQUIREMENT.world_id] });
    // Same RootDID as the principal (PERSONA_Z resolves to ROOTDID_A too),
    // but THIS specific human hasn't met the CFS verification bar.
    mockHasVerifiedWorldIdPassport.mockResolvedValue(false);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('World-ID-verified');
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('accepted');
  });

  it('successful ROOT_DID authorization issues the agreement_authorized DVN receipt, carrying authority class, principal RootDID commitment, and acting persona commitment — and that receipt is the canonical gateway to AUTHORIZED', async () => {
    const agreementId = 'agr-rootdid-receipt-shape';
    await formAcceptAs(PERSONA_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.agreement.status).toBe('authorized');
    expect(result.receiptId).toBeTruthy();
    expect(result.agreement.authorizedReceiptId).toBe(result.receiptId);

    const receiptCall = createActivityReceipt.mock.calls.find((c: any[]) => c[0].actionType === 'agreement_authorized');
    expect(receiptCall).toBeDefined();
    expect(receiptCall![0].actionInput).toMatchObject({
      agreement: agreementId,
      authorityClass: 'ROOT_DID',
      principalRootDidCommitment: ROOTDID_A,
      actingPersonaCommitment: expect.any(String),
    });
    // The acting persona (Aigent Z) is auditable via createActivityReceipt's
    // own top-level personaId (the SAME T0-scoping every receipt already
    // uses) but never asserted as the constitutional principal INSIDE the
    // DVN-anchored actionInput commitment payload — no raw personaId or
    // RootDID appears there.
    expect(JSON.stringify(receiptCall![0].actionInput)).not.toContain(PERSONA_Z);
    expect(JSON.stringify(receiptCall![0].actionInput)).not.toContain(PERSONA_ARK);
  });

  it('switching the active persona afterward does not alter the CSA state — status remains authorized regardless of who reads it next', async () => {
    const agreementId = 'agr-rootdid-persona-switch-stable';
    await formAcceptAs(PERSONA_ARK, agreementId);
    const authorized = await authorizeAgreement(PERSONA_Z, { agreementId });
    expect(authorized.ok).toBe(true);

    // No API in this module re-derives status from "the active persona" —
    // the row itself is the single source of truth. Simulate "switching
    // persona" by simply reading the row fresh, as a DIFFERENT persona's
    // request would, and confirm nothing about the stored row changed.
    const row = findByColumn('agreement_id', agreementId);
    expect(row?.status).toBe('authorized');

    // Re-authorizing (idempotent path) under yet another same-RootDID
    // persona must not regress the status or mint a second receipt.
    createActivityReceipt.mockClear();
    const reAuthorized = await authorizeAgreement(PERSONA_ARK, { agreementId });
    expect(reAuthorized.ok).toBe(true);
    if (reAuthorized.ok) expect(reAuthorized.alreadyAuthorized).toBe(true);
    expect(createActivityReceipt).not.toHaveBeenCalled();
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('authorized');
  });

  it('existing PERSONA-bound agreements (authorityBinding omitted) are completely unaffected — same persona required, exactly as before', async () => {
    const agreementId = 'agr-persona-bound-unchanged';
    const formed = await formAgreement(PERSONA_ARK, baseFormInput(agreementId, { authorityBinding: undefined }));
    expect(formed.ok).toBe(true);
    await acceptAgreement(PERSONA_ARK, { agreementId, acceptorType: 'operator', acceptorId: PERSONA_ARK });

    // A DIFFERENT persona, even one sharing the SAME RootDID, may not
    // authorize a PERSONA-bound agreement — RootDID equivalence is a
    // ROOT_DID-only concept.
    const crossPersonaAttempt = await authorizeAgreement(PERSONA_Z, { agreementId });
    expect(crossPersonaAttempt.ok).toBe(false);

    const samePersonaAttempt = await authorizeAgreement(PERSONA_ARK, { agreementId });
    expect(samePersonaAttempt.ok).toBe(true);
  });
});
