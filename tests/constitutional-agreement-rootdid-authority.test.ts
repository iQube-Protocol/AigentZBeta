/**
 * CFS Agreement Authority — DiDQube stable-container binding (DiDQube Phase
 * 2.5 authority closure, 2026-09-07; originally RootDID binding, operator
 * directive 2026-08-08).
 *
 * "CFS agreements are RootDID-authority-bound, not persona-authority-bound"
 * — and, as of this closure, the RootDID/DiDQube distinction is itself
 * enforced: a DiDQube is the stable constitutional subject/container;
 * RootDID is a rotatable identity primitive WITHIN it. `formAgreement`/
 * `authorizeAgreement` resolve identity through the canonical DiDQube
 * resolver (`services/identity/didQubeResolver.ts`) via the caller's
 * `auth_user_id` — NEVER through `resolveRootDidCommitment()`/
 * `personas.root_did` (the DiDQube Phase 2.5 root-did-elimination finding:
 * that legacy column is written once at bind time and never updated on
 * RootDID rotation, so a walk through it cannot tell "rotated" from
 * "different person").
 *
 * This file mocks `resolveDiDQube` directly (never a live Supabase call for
 * identity resolution) and a minimal `root_identity` table fake (only for
 * the legacy-compatibility-verifier tests, which enumerate
 * `root_identity.kybe_id` rows) plus the durable `constitutional_agreements`
 * store (an in-memory fake, keyed like the real table).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveDiDQube = vi.fn();
vi.mock('@/services/identity/didQubeResolver', () => ({
  resolveDiDQube: (...args: any[]) => mockResolveDiDQube(...args),
}));

const mockHasVerifiedWorldIdPassport = vi.fn();
vi.mock('@/services/passport/personhoodProof', () => ({
  hasVerifiedWorldIdPassport: (...args: any[]) => mockHasVerifiedWorldIdPassport(...args),
}));

// didPublicRef is a pure, deterministic 16-hex commitment — reuse the real
// implementation shape (sha256, truncated) so hash equality tests are
// meaningful, but keep it hermetic (no crypto import needed beyond what the
// real module already uses internally).
vi.mock('@/services/passport/bureauIdentityService', () => ({
  didPublicRef: (didUri: string) => `commit:${didUri}`,
}));

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${Math.random().toString(36).slice(2)}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

// ── In-memory fakes ─────────────────────────────────────────────────────────
const rows = new Map<string, Record<string, unknown>>();
let idCounter = 0;
/** kybeIdentityId -> did_uri[] — every root_identity row ever issued under that kybe. */
const rootsByKybe = new Map<string, string[]>();

function findByColumn(col: string, val: unknown) {
  return [...rows.values()].find((r) => r[col] === val) ?? null;
}

function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'root_identity') {
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              if (col !== 'kybe_id') throw new Error(`unexpected root_identity filter: ${col}`);
              const didUris = rootsByKybe.get(String(val)) ?? [];
              return Promise.resolve({ data: didUris.map((did_uri) => ({ did_uri })), error: null });
            },
          }),
        };
      }
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
const PERSONA_OTHER_DIDQUBE = 'persona-other-didqube';
const PERSONA_UNRESOLVABLE = 'persona-no-didqube';

// auth_user_id per persona — the CALLER identity resolveDiDQube keys on.
const AUTH_USER_ARK = 'auth-user-ark'; // ArkAgent and Aigent Z share one human (same DiDQube)
const AUTH_USER_Z = 'auth-user-z';
const AUTH_USER_OTHER = 'auth-user-other-didqube';
const AUTH_USER_UNRESOLVABLE = 'auth-user-unresolvable';

const KYBE_A = 'kybe-aaaa';
const KYBE_B = 'kybe-bbbb';
const DIDQUBE_A = { commitmentVersion: 'v1' as const, value: 'didqube-commit-aaaa1111' };
const DIDQUBE_B = { commitmentVersion: 'v1' as const, value: 'didqube-commit-bbbb2222' };

function resolvedPrimitive(kybeId: string, commitment: typeof DIDQUBE_A, didUri: string) {
  return {
    state: 'resolved' as const,
    primitive: {
      didqubeId: `didqube-${kybeId}`,
      subjectClass: 'natural_person' as const,
      lifecycleState: 'active' as const,
      constitutionalAnchor: { kind: 'kybe_identity' as const, id: kybeId },
      currentIdentityPrimitive: { kind: 'root_identity' as const, id: `root-${didUri}`, didUri },
      passportCredential: null,
      publicCommitment: commitment,
      provenance: { inputKind: 'auth_user_id' as const, resolvedVia: 'test' },
      trustClass: 'server_derived' as const,
    },
  };
}

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

async function formAcceptAs(
  personaId: string,
  authUserId: string | null,
  agreementId: string,
  overrides: Partial<Parameters<typeof formAgreement>[1]> = {},
) {
  const formed = await formAgreement(personaId, baseFormInput(agreementId, overrides), authUserId);
  expect(formed.ok).toBe(true);
  const accepted = await acceptAgreement(personaId, { agreementId, acceptorType: 'operator', acceptorId: personaId });
  expect(accepted.ok).toBe(true);
  return formed;
}

beforeEach(() => {
  rows.clear();
  idCounter = 0;
  rootsByKybe.clear();
  createActivityReceipt.mockClear();
  mockResolveDiDQube.mockReset();
  mockHasVerifiedWorldIdPassport.mockReset();
  mockHasVerifiedWorldIdPassport.mockResolvedValue(true);
  mockResolveDiDQube.mockImplementation(async ({ authUserId }: { kind: 'auth_user_id'; authUserId: string }) => {
    if (authUserId === AUTH_USER_ARK) return resolvedPrimitive(KYBE_A, DIDQUBE_A, 'did:root:ark-current');
    if (authUserId === AUTH_USER_Z) return resolvedPrimitive(KYBE_A, DIDQUBE_A, 'did:root:z-current');
    if (authUserId === AUTH_USER_OTHER) return resolvedPrimitive(KYBE_B, DIDQUBE_B, 'did:root:other-current');
    return { state: 'unresolved', reason: 'anchor_absent' };
  });
});

describe('CFS Agreement Authority — DiDQube stable-container binding (2026-09-07)', () => {
  it('form as ArkAgent -> authorize as ArkAgent (same DiDQube) -> PASS', async () => {
    const agreementId = 'agr-didqube-same-persona';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agreement.status).toBe('authorized');
  });

  it('form as ArkAgent -> authorize as Aigent Z (different persona, same DiDQube) -> PASS', async () => {
    const agreementId = 'agr-didqube-cross-persona';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agreement.status).toBe('authorized');
  });

  it('RootDID rotation inside the SAME DiDQube preserves authorized continuity (new-model agreement)', async () => {
    const agreementId = 'agr-didqube-rootdid-rotation';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    // Simulate the human re-keying their RootDID (device recovery, rotation)
    // WITHOUT changing their kybe/DiDQube anchor — publicCommitment (the
    // DiDQube's own commitment) is unchanged even though currentIdentityPrimitive's
    // didUri now differs from formation time.
    mockResolveDiDQube.mockImplementationOnce(async () => resolvedPrimitive(KYBE_A, DIDQUBE_A, 'did:root:ark-ROTATED'));

    const result = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agreement.status).toBe('authorized');
  });

  it('a copied RootDID string across a DIFFERENT DiDQube cannot authorize', async () => {
    const agreementId = 'agr-didqube-mismatch';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_OTHER_DIDQUBE, { agreementId }, AUTH_USER_OTHER);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('same DiDQube');
    // Never silently authorized — the row must still read 'accepted'.
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('accepted');
  });

  it('conflicting personas.root_did values have NO effect — resolution never reads personas.root_did at all', async () => {
    const agreementId = 'agr-didqube-root-did-column-irrelevant';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    // authorizeAgreement is called with a personaId whose (hypothetical)
    // personas.root_did column could say anything -- it is never read. Only
    // the resolved DiDQube (keyed on auth_user_id) governs the outcome.
    const result = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);

    expect(result.ok).toBe(true);
    // Static proof: the production module never IMPORTS or CALLS the legacy
    // resolver, and never queries the personas table (prose mentioning these
    // names in explanatory comments is fine — only actual usage is checked).
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(path.join(process.cwd(), 'services/constitutional/constitutionalAgreement.ts'), 'utf8');
    expect(source).not.toMatch(/from\(['"]personas['"]\)/);
    expect(source).not.toMatch(/import\s*\{[^}]*resolveRootDidCommitment/);
    expect(source).not.toMatch(/[^.`'"A-Za-z]resolveRootDidCommitment\(/);
  });

  it('forming a ROOT_DID-bound agreement REFUSES when the forming persona has no resolvable auth_user_id at all', async () => {
    const formed = await formAgreement(PERSONA_UNRESOLVABLE, baseFormInput('agr-didqube-unresolvable-form'), null);
    expect(formed.ok).toBe(false);
    if (!formed.ok) expect(formed.reason).toContain('auth_user_id');
  });

  it('forming REFUSES when the resolver returns anything other than "resolved" (unresolved/ambiguous/conflicted/unsupported)', async () => {
    for (const state of [
      { state: 'unresolved', reason: 'lineage_incomplete' },
      { state: 'ambiguous', candidateCount: 2 },
      { state: 'conflicted', detail: 'test conflict' },
      { state: 'unsupported_subject_class', subjectClass: 'organization' },
    ]) {
      mockResolveDiDQube.mockResolvedValueOnce(state as any);
      const formed = await formAgreement(PERSONA_UNRESOLVABLE, baseFormInput(`agr-didqube-form-${state.state}`), AUTH_USER_UNRESOLVABLE);
      expect(formed.ok).toBe(false);
    }
  });

  it('authorizing REFUSES when the authorizing persona has no resolvable auth_user_id at all — never treats "unresolvable" as "matches"', async () => {
    const agreementId = 'agr-didqube-authorizer-unresolvable';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_UNRESOLVABLE, { agreementId }, null);

    expect(result.ok).toBe(false);
  });

  it('authorizing REFUSES when the resolver returns anything other than "resolved" (unresolved/ambiguous/conflicted/unsupported)', async () => {
    const agreementId = 'agr-didqube-authorize-non-resolved';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    for (const state of [
      { state: 'unresolved', reason: 'lineage_incomplete' },
      { state: 'ambiguous', candidateCount: 2 },
      { state: 'conflicted', detail: 'test conflict' },
      { state: 'unsupported_subject_class', subjectClass: 'organization' },
    ]) {
      mockResolveDiDQube.mockResolvedValueOnce(state as any);
      const result = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);
      expect(result.ok).toBe(false);
    }
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('accepted');
  });

  it('same DiDQube but the CFS verification requirement is unmet -> REFUSE (DiDQube equivalence is necessary, not sufficient)', async () => {
    const agreementId = 'agr-didqube-verification-unmet';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId, { verificationRequirements: [PROOF_REQUIREMENT.world_id] });
    // Same DiDQube as the principal (Aigent Z resolves to the same kybe too),
    // but THIS specific human hasn't met the CFS verification bar.
    mockHasVerifiedWorldIdPassport.mockResolvedValue(false);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('World-ID-verified');
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('accepted');
  });

  it('successful ROOT_DID authorization issues the agreement_authorized DVN receipt, carrying authority class, principal commitments, and acting persona commitment', async () => {
    const agreementId = 'agr-didqube-receipt-shape';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);

    const result = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);

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
      principalDiDQubeCommitment: DIDQUBE_A.value,
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
    const agreementId = 'agr-didqube-persona-switch-stable';
    await formAcceptAs(PERSONA_ARK, AUTH_USER_ARK, agreementId);
    const authorized = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);
    expect(authorized.ok).toBe(true);

    const row = findByColumn('agreement_id', agreementId);
    expect(row?.status).toBe('authorized');

    // Re-authorizing (idempotent path) under yet another same-DiDQube
    // persona must not regress the status or mint a second receipt.
    createActivityReceipt.mockClear();
    const reAuthorized = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);
    expect(reAuthorized.ok).toBe(true);
    if (reAuthorized.ok) expect(reAuthorized.alreadyAuthorized).toBe(true);
    expect(createActivityReceipt).not.toHaveBeenCalled();
    expect(findByColumn('agreement_id', agreementId)?.status).toBe('authorized');
  });

  it('existing PERSONA-bound agreements (authorityBinding omitted) are completely unaffected — same persona required, exactly as before, no auth_user_id needed', async () => {
    const agreementId = 'agr-persona-bound-unchanged';
    const formed = await formAgreement(PERSONA_ARK, baseFormInput(agreementId, { authorityBinding: undefined }), null);
    expect(formed.ok).toBe(true);
    await acceptAgreement(PERSONA_ARK, { agreementId, acceptorType: 'operator', acceptorId: PERSONA_ARK });

    // A DIFFERENT persona, even one sharing the SAME DiDQube, may not
    // authorize a PERSONA-bound agreement — DiDQube equivalence is a
    // ROOT_DID-only concept.
    const crossPersonaAttempt = await authorizeAgreement(PERSONA_Z, { agreementId }, AUTH_USER_Z);
    expect(crossPersonaAttempt.ok).toBe(false);

    const samePersonaAttempt = await authorizeAgreement(PERSONA_ARK, { agreementId }, null);
    expect(samePersonaAttempt.ok).toBe(true);
  });

  describe('legacy compatibility verifier (agreements formed before the DiDQube public commitment was pinned)', () => {
    function legacyRow(agreementId: string, principalRootDidCommitment: string | null) {
      idCounter += 1;
      const row = {
        id: `row-${idCounter}`,
        agreement_id: agreementId,
        display_label: 'Legacy CFS Agreement',
        status: 'accepted',
        capability_ref: 'cap-cfs-test',
        selected_agent_ref: 'aigent-nakamoto',
        acceptance: { provider: 'local', commitmentHash: 'legacyhash', createdAt: 'now' },
        formed_receipt_id: 'receipt-legacy',
        authorized_receipt_id: null,
        created_at: 'now',
        updated_at: 'now',
        object: {
          identity: { id: agreementId, kind: 'agreement', ref: `ref-${agreementId}`, displayLabel: 'Legacy CFS Agreement' },
          version: { version: 1, status: 'published' },
          standing: { standing: 0, band: 'experimental', reach: 0 },
          authority: { ratificationRequired: false, governingInvariants: ['CRP-003a'] },
          ownership: { ownerCommitment: 'legacy-owner-commitment' },
          provenance: { receiptIds: ['receipt-legacy'], contentCommitment: 'legacyterms', source: 'agreement' },
          lifecycle: { state: 'accepted', order: ['proposed', 'accepted', 'authorized', 'executed', 'settled', 'reconstitutable'] },
          dependencies: [],
          payload: {
            capabilityRef: 'cap-cfs-test',
            selectedAgentRef: 'aigent-nakamoto',
            delegatedAuthority: DELEGATED_AUTHORITY,
            constraints: [],
            verificationRequirements: [],
            settlementTerms: null,
            termsCommitment: 'legacyterms',
            acceptance: { provider: 'local', commitmentHash: 'legacyhash', createdAt: 'now' },
            authorityBinding: 'ROOT_DID',
            // Legacy shape: NO principalDiDQubeCommitment field at all.
            principalRootDidCommitment,
          },
        },
      };
      rows.set(agreementId, row);
      return row;
    }

    it('a historical RootDID under the SAME kybe (even after rotation) authorizes via the legacy verifier — never reads personas.root_did', async () => {
      const agreementId = 'agr-legacy-rootdid-match';
      // The forming persona's RootDID at formation time hashed to this commitment.
      const historicalCommitment = 'commit:did:root:ark-historical';
      legacyRow(agreementId, historicalCommitment);
      // The acting persona's kybe (KYBE_A) has issued TWO roots over time:
      // the historical one the legacy commitment was pinned against, and the
      // CURRENT one resolveDiDQube now returns (simulating rotation).
      rootsByKybe.set(KYBE_A, ['did:root:ark-historical', 'did:root:ark-current']);

      const result = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);
      expect(result.ok).toBe(true);
    });

    it('a legacy agreement with NO matching historical root under the acting persona\'s kybe is REFUSED', async () => {
      const agreementId = 'agr-legacy-rootdid-no-match';
      legacyRow(agreementId, 'commit:did:root:someone-elses-historical-root');
      rootsByKybe.set(KYBE_A, ['did:root:ark-current']); // never issued the historical root

      const result = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('DiDQube');
    });

    it('legacy agreement payloads and hashes remain byte-for-byte unchanged by this closure', async () => {
      const agreementId = 'agr-legacy-payload-immutable';
      const row = legacyRow(agreementId, 'commit:did:root:ark-historical');
      const payloadBefore = JSON.parse(JSON.stringify(row.object.payload));
      rootsByKybe.set(KYBE_A, ['did:root:ark-historical']);

      const result = await authorizeAgreement(PERSONA_ARK, { agreementId }, AUTH_USER_ARK);
      expect(result.ok).toBe(true);

      // The payload's pre-existing fields (termsCommitment, the legacy
      // principalRootDidCommitment, acceptance, etc.) are untouched — only
      // the lifecycle.state and provenance.receiptIds on the OBJECT change on
      // authorize (the pre-existing, unrelated update), never the payload's
      // own signed content.
      const rowAfter = findByColumn('agreement_id', agreementId) as any;
      expect(rowAfter.object.payload).toEqual(payloadBefore);
    });
  });
});
