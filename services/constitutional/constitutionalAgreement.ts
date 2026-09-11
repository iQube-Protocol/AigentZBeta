/**
 * constitutionalAgreement — the Constitutional Agreement primitive (CRP-003a
 * Increment 1 / N1; CFI-002, Workstream 2, canonical-service-pattern step 3).
 *
 * THE one load-bearing greenfield of the Constitutional Financial Services
 * Programme (CRP-003a §1.2): an explicit, attributable, machine-readable record
 * binding {requesting operator · requested capability · selected agent ·
 * delegated authority · constraints · verification requirements · settlement
 * terms} BEFORE delegated execution. Delegated execution refuses (HTTP 409)
 * without an authorized agreement — the x409 gate idiom, already native here
 * (the capability-registry + merge gates 409 on unmet constitutional
 * preconditions).
 *
 * Extend-don't-duplicate: mirrors `services/constitutional/capabilityRegistry.ts`
 * exactly — the ConstitutionalObject shape, the one-way commitment discipline,
 * the durable-store soft-fail, and the ONE `createActivityReceipt` path. It
 * COMPOSES existing seams rather than inventing them: `capabilityRef` is a
 * capability_registry id (Discovery, step 2), `delegatedAuthority` is the
 * PolicyEnvelope shape (steps 5/6), `settlementTerms` is optional x402/USDC
 * (step 9). The acceptance proof is produced by a swappable provider
 * (`agreementProviders`: local | x409); DVN is the constitutional anchor of
 * record (the agreement_formed / agreement_authorized receipts).
 *
 * T2 discipline: NO personaId is ever stored. The requesting operator is a
 * one-way `ownerCommitment`; the acceptor a one-way `acceptorCommitment`. The
 * object is T2-safe by construction (findForbiddenObjectKey clean).
 *
 * N1 scope: form → accept → authorize (Domain 3, read-only; execution /
 * settlement / Transaction Reconstitution are later increments).
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  standingBandFor,
  isLegalObjectTransition,
  findForbiddenObjectKey,
  type ConstitutionalObject,
} from '@/types/constitutionalObject';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { PROOF_REQUIREMENT } from '@/services/constitutional/guidedOnboarding';
import { hasVerifiedWorldIdPassport } from '@/services/passport/personhoodProof';
import { didPublicRef } from '@/services/passport/bureauIdentityService';
import { resolveDiDQube, type DiDQubePrimitive } from '@/services/identity/didQubeResolver';
import {
  getAcceptanceProvider,
  type AcceptanceRecord,
  type AcceptorType,
} from '@/services/constitutional/agreementProviders';

// ---------------------------------------------------------------------------
// Lifecycle + constants
// ---------------------------------------------------------------------------

/** The agreement lifecycle order. N1 implements the first three. */
export const AGREEMENT_LIFECYCLE = [
  'proposed',
  'accepted',
  'authorized',
  'executed',
  'settled',
  'reconstitutable',
] as const;
export type AgreementStatus = (typeof AGREEMENT_LIFECYCLE)[number];

/** Statuses at/after which the 409 gate lets delegated execution proceed. */
const GATE_OPEN_STATUSES = new Set<AgreementStatus>(['authorized', 'executed', 'settled', 'reconstitutable']);

/**
 * Authority tier an agreement's AUTHORIZE step is bound to (operator
 * directive, 2026-08-08: "CFS agreements are RootDID-authority-bound, not
 * persona-authority-bound"). `PERSONA` (the pre-existing, only behavior) —
 * the SAME persona that formed the agreement must authorize it, checked by
 * one-way `ownerCommitment` equality. `ROOT_DID` — forming and authorizing
 * personas may differ; authorization succeeds when both resolve, through the
 * canonical DiDQube resolver (`services/identity/didQubeResolver.ts`), to the
 * SAME stable constitutional subject. Deliberately scoped to CFS agreements
 * only for now — see this file's own `formAgreement` and `authorizeAgreement`.
 *
 * ── DiDQube is the anchor, RootDID is not (DiDQube Phase 2.5 authority
 *    closure, 2026-09-07) ────────────────────────────────────────────────────
 *
 * A DiDQube is the stable constitutional subject/container; RootDID is a
 * rotatable identity primitive WITHIN that container. Agreements formed after
 * this closure pin a versioned, stable DiDQube public commitment
 * (`principalDiDQubeCommitment` / `principalDiDQubeCommitmentVersion`) — THE
 * authority anchor. The RootDID commitment current at formation time may
 * still be recorded (`principalRootDidCommitment`, unchanged field), but it is
 * informational only and is never compared for authority on a new-model
 * agreement. This means RootDID rotation inside the same DiDQube (a citizen
 * re-keying their root, a device recovery) preserves authorized continuity —
 * the previous `resolveRootDidCommitment()`/`personas.root_did` walk could
 * not offer that guarantee, because `personas.root_did` is a legacy column
 * written once at bind time and never updated on rotation (DiDQube Phase 2.5
 * root-did-elimination finding). Agreements formed BEFORE this closure carry
 * only the legacy `principalRootDidCommitment` — those are authorized through
 * an explicit compatibility verifier (see `legacyRootDidCommitmentBelongsToKybe`
 * below) that proves the historical RootDID belonged to the SAME
 * canonically-resolved DiDQube, by enumerating every `root_identity` ever
 * issued under that DiDQube's own `kybe_identity` anchor — it never reads
 * `personas.root_did`.
 *
 * NOT a claim that RootDID is the highest authority tier — sovereign
 * personhood remains constitutionally prior to RootDID. This says only that
 * CFS currently belongs at the RootDID/DiDQube tier rather than the persona
 * tier; the broader authority hierarchy (personhood → RootDID → persona →
 * delegation → session) is a separate development.
 */
export const AGREEMENT_AUTHORITY_BINDINGS = ['PERSONA', 'ROOT_DID'] as const;
export type AgreementAuthorityBinding = (typeof AGREEMENT_AUTHORITY_BINDINGS)[number];

/** Named policy/version string carried on every agreement_authorized receipt's actionInput — bump on any change to the authorization decision logic itself. */
const AGREEMENT_AUTHORIZATION_POLICY_VERSION = 'cfs-agreement-authority-v1';

const MISSING = 'constitutional_agreements';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function commitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

/** T2-safe one-way commitment of the requesting operator persona. Server-only. */
export function agreementOwnerCommitment(personaId: string): string {
  return commitment('agreement:operator', personaId);
}

/** T2-safe one-way commitment of an acceptor (operator persona or agent ref). */
export function acceptorCommitmentFor(acceptorType: AcceptorType, acceptorId: string): string {
  return commitment(`agreement:acceptor:${acceptorType}`, acceptorId);
}

function termsCommitment(terms: unknown): string {
  return createHash('sha256').update(JSON.stringify(terms)).digest('hex');
}

/** The PolicyEnvelope-shaped delegated authority the agreement carries.
 *  Structurally aligned with the delegation grant envelope; the enforced
 *  `valueCeiling` is unused in N1/Domain 3 (money-moving domains need P3). */
export interface DelegatedAuthority {
  band: string;
  allowedActions: string[];
  forbiddenActions: string[];
  allowedSurfaces: string[];
  ttlHours: number;
  maxActions: number;
  /** P3 — enforced spend ceiling (rail's smallest unit). Money-moving domains
   *  MUST declare one; Domain 3 (read-only) leaves it null. */
  valueCeiling?: number | null;
}

/** Settlement terms an agreement may carry (money-moving Domains 1/2). `amount`
 *  is in the rail's smallest unit (Q¢ cents / USDC micro-units). */
export interface SettlementTerms {
  rail: string;
  amount: number;
  currency: string;
}

/**
 * P3 — enforce the delegated authority's value ceiling on a settlement amount.
 * PURE. A money-moving agreement MUST declare a `valueCeiling`: a null ceiling
 * with a settlement present is REFUSED (an unbounded delegated spend is exactly
 * what P3 forbids). An amount over the ceiling is refused. Domain 3 (read-only)
 * carries no settlement, so it never reaches this check.
 */
export function spendWithinCap(authority: DelegatedAuthority, amount: number): { ok: boolean; reason?: string } {
  const ceiling = authority.valueCeiling;
  if (ceiling == null) {
    return { ok: false, reason: 'money movement requires an enforced valueCeiling on the delegated authority (P3) — none declared' };
  }
  if (!(amount >= 0)) {
    return { ok: false, reason: `invalid settlement amount ${amount}` };
  }
  if (amount > ceiling) {
    return { ok: false, reason: `settlement amount ${amount} exceeds the delegated spend ceiling ${ceiling}` };
  }
  return { ok: true };
}

export interface FormAgreementInput {
  /** Stable slug — idempotent formation key. */
  agreementId: string;
  displayLabel: string;
  /** A capability_registry id (Discovery, step 2). */
  capabilityRef: string;
  /** The selected producer / delegate ref. */
  selectedAgentRef: string;
  delegatedAuthority: DelegatedAuthority;
  constraints?: string[];
  verificationRequirements?: string[];
  /** Optional settlement terms (x402/USDC/Q¢). null for Domain 3 (no fund movement). */
  settlementTerms?: Record<string, unknown> | null;
  governingInvariants?: string[];
  /**
   * Which authority tier the AUTHORIZE step is bound to. Omitted/undefined
   * means `'PERSONA'` — existing callers are unaffected. CFS agreements
   * pass `'ROOT_DID'` explicitly (operator directive, 2026-08-08: "Existing
   * agreements remain PERSONA unless explicitly classified otherwise").
   */
  authorityBinding?: AgreementAuthorityBinding;
}

export interface AgreementTerms {
  capabilityRef: string;
  selectedAgentRef: string;
  delegatedAuthority: DelegatedAuthority;
  constraints: string[];
  verificationRequirements: string[];
  settlementTerms: Record<string, unknown> | null;
}

export interface AgreementPayload extends AgreementTerms {
  termsCommitment: string;
  acceptance: AcceptanceRecord | null;
  /** Defaults to 'PERSONA' via `?? 'PERSONA'` at every read site — never assume this field is present on a row formed before 2026-08-08. */
  authorityBinding: AgreementAuthorityBinding;
  /**
   * T2-safe RootDID commitment recorded at formation, for observability
   * only. `null` for `authorityBinding: 'PERSONA'` agreements. NOT the
   * authority anchor for a new-model agreement (see
   * `principalDiDQubeCommitment`) — kept for legacy rows formed before the
   * DiDQube closure, where it IS the only pinned principal and is verified
   * at authorize time through the legacy compatibility verifier, never by
   * reading `personas.root_did`.
   */
  principalRootDidCommitment: string | null;
  /**
   * T2-safe, versioned public commitment of the FORMING persona's DiDQube —
   * the STABLE constitutional container, resolved via the canonical DiDQube
   * resolver and pinned once at formation, never re-derived at authorize
   * time. `null` for `authorityBinding: 'PERSONA'` agreements and for legacy
   * `ROOT_DID` agreements formed before this field existed. THE authority
   * anchor for a new-model `ROOT_DID` agreement: equality against the
   * AUTHORIZING persona's own freshly-resolved DiDQube public commitment is
   * what lets a different persona under the same DiDQube (including one
   * that has since rotated its RootDID) authorize what a different persona
   * formed.
   */
  principalDiDQubeCommitment: string | null;
  /** `null` iff `principalDiDQubeCommitment` is `null`. Never assume 'v1' — compare versions before comparing values. */
  principalDiDQubeCommitmentVersion: 'v1' | null;
}

/** PURE — build the agreement's ConstitutionalObject. No I/O, no receipts. */
export function buildAgreementObject(
  input: FormAgreementInput,
  ownerCommitment: string,
  principalRootDidCommitment: string | null = null,
  principalDiDQubeCommitment: { value: string; version: 'v1' } | null = null,
): ConstitutionalObject<AgreementPayload> {
  const terms: AgreementTerms = {
    capabilityRef: input.capabilityRef,
    selectedAgentRef: input.selectedAgentRef,
    delegatedAuthority: input.delegatedAuthority,
    constraints: input.constraints ?? [],
    verificationRequirements: input.verificationRequirements ?? [],
    settlementTerms: input.settlementTerms ?? null,
  };
  const payload: AgreementPayload = {
    ...terms,
    termsCommitment: termsCommitment(terms),
    acceptance: null,
    authorityBinding: input.authorityBinding ?? 'PERSONA',
    principalRootDidCommitment,
    principalDiDQubeCommitment: principalDiDQubeCommitment?.value ?? null,
    principalDiDQubeCommitmentVersion: principalDiDQubeCommitment?.version ?? null,
  };
  return {
    identity: {
      id: input.agreementId,
      kind: 'agreement',
      ref: commitment('agreement', input.agreementId),
      displayLabel: input.displayLabel,
    },
    version: { version: 1, status: 'draft' },
    // An agreement is not a standing-bearing artifact; it starts experimental/0.
    standing: { standing: 0, band: standingBandFor(0), reach: 0 },
    authority: {
      ratificationRequired: false,
      governingInvariants: input.governingInvariants ?? ['CRP-003a', 'CFI-002'],
    },
    ownership: { ownerCommitment },
    provenance: { receiptIds: [], contentCommitment: payload.termsCommitment.slice(0, 16), source: 'agreement' },
    lifecycle: { state: 'proposed', order: AGREEMENT_LIFECYCLE },
    dependencies: [
      { id: input.capabilityRef, kind: 'capability' },
      { id: input.selectedAgentRef, kind: 'aigent' },
    ],
    payload,
  };
}

// ---------------------------------------------------------------------------
// Durable store (soft-fail, capabilityRegistry pattern)
// ---------------------------------------------------------------------------

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[constitutional agreement] migration 20260719000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[constitutional agreement] ${scope} failed:`, message);
  }
}

export interface ConstitutionalAgreementRow {
  id: string;
  agreementId: string;
  displayLabel: string;
  object: ConstitutionalObject<AgreementPayload>;
  status: AgreementStatus;
  capabilityRef: string | null;
  selectedAgentRef: string | null;
  acceptance: AcceptanceRecord | null;
  formedReceiptId: string | null;
  authorizedReceiptId: string | null;
  createdAt: string;
}

function rowToAgreement(row: Record<string, unknown>): ConstitutionalAgreementRow {
  return {
    id: String(row.id),
    agreementId: String(row.agreement_id),
    displayLabel: String(row.display_label),
    object: row.object as ConstitutionalObject<AgreementPayload>,
    status: String(row.status) as AgreementStatus,
    capabilityRef: row.capability_ref ? String(row.capability_ref) : null,
    selectedAgentRef: row.selected_agent_ref ? String(row.selected_agent_ref) : null,
    acceptance: (row.acceptance as AcceptanceRecord | null) ?? null,
    formedReceiptId: row.formed_receipt_id ? String(row.formed_receipt_id) : null,
    authorizedReceiptId: row.authorized_receipt_id ? String(row.authorized_receipt_id) : null,
    createdAt: String(row.created_at),
  };
}

export async function listAgreements(): Promise<ConstitutionalAgreementRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from('constitutional_agreements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return (data ?? []).map(rowToAgreement);
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function getAgreement(agreementId: string): Promise<ConstitutionalAgreementRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from('constitutional_agreements')
      .select('*')
      .eq('agreement_id', agreementId.trim())
      .maybeSingle();
    return data ? rowToAgreement(data) : null;
  } catch (e) {
    softFail('get', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ---------------------------------------------------------------------------
// ROOT_DID authority — DiDQube stable-container resolution
// ---------------------------------------------------------------------------

/**
 * LEGACY COMPATIBILITY VERIFIER — for `ROOT_DID`-bound agreements formed
 * before the DiDQube public commitment was pinned (`principalDiDQubeCommitment`
 * is `null`, only the legacy `principalRootDidCommitment` exists). Proves the
 * historical RootDID commitment belonged to the SAME canonically-resolved
 * DiDQube the acting persona resolves to today, by enumerating every
 * `root_identity` row ever issued under that DiDQube's own `kybe_identity`
 * anchor (`root_identity.kybe_id`) and hash-comparing each `did_uri` against
 * the pinned commitment. This tolerates RootDID rotation (a historical root
 * under the same kybe still matches) without EVER reading `personas.root_did`
 * — the anchor (`kybeIdentityId`) itself comes from the canonical DiDQube
 * resolver's own `constitutionalAnchor`, never from the legacy column.
 */
async function legacyRootDidCommitmentBelongsToKybe(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  kybeIdentityId: string,
  targetCommitment: string,
): Promise<boolean> {
  const { data, error } = await admin.from('root_identity').select('did_uri').eq('kybe_id', kybeIdentityId);
  if (error) return false;
  const rows = (data ?? []) as Array<{ did_uri: string | null }>;
  return rows.some((r) => Boolean(r.did_uri) && didPublicRef(r.did_uri as string) === targetCommitment);
}

/**
 * THE shared ROOT_DID authority predicate — used identically by
 * `authorizeAgreement` (execution-gating) and the agreement listing route
 * (visibility only), so the two can never disagree about who counts as the
 * same principal. Fails closed: any resolver state other than `resolved`, or
 * an agreement with no principal commitment of either kind, is `false`.
 */
export async function agreementPrincipalMatches(
  agreement: Pick<ConstitutionalAgreementRow, 'object'>,
  actingPrimitive: DiDQubePrimitive,
): Promise<boolean> {
  const pinned = agreement.object.payload.principalDiDQubeCommitment;
  if (pinned) {
    return actingPrimitive.publicCommitment.value === pinned;
  }
  const legacy = agreement.object.payload.principalRootDidCommitment;
  if (!legacy) return false;
  if (actingPrimitive.constitutionalAnchor.kind !== 'kybe_identity') return false;
  const admin = getSupabaseServer();
  if (!admin) return false;
  return legacyRootDidCommitmentBelongsToKybe(admin, actingPrimitive.constitutionalAnchor.id, legacy);
}

// ---------------------------------------------------------------------------
// Form → Accept → Authorize
// ---------------------------------------------------------------------------

export type FormResult =
  | { ok: true; agreement: ConstitutionalAgreementRow; alreadyFormed: boolean }
  | { ok: false; reason: string };

/**
 * Form the agreement (status 'proposed'). Idempotent on agreementId. No receipt
 * — a proposal is pre-commitment; the constitutional commitment happens at
 * acceptance. The requesting operator is stored only as a one-way commitment.
 */
export async function formAgreement(
  personaId: string,
  input: FormAgreementInput,
  callerAuthUserId: string | null = null,
): Promise<FormResult> {
  const agreementId = input.agreementId?.trim();
  if (!agreementId) return { ok: false, reason: 'agreementId required' };
  if (!input.displayLabel?.trim()) return { ok: false, reason: 'displayLabel required' };
  if (!input.capabilityRef?.trim()) return { ok: false, reason: 'capabilityRef required (a registered capability id)' };
  if (!input.selectedAgentRef?.trim()) return { ok: false, reason: 'selectedAgentRef required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'agreement store unavailable' };

  const authorityBinding = input.authorityBinding ?? 'PERSONA';
  let principalRootDidCommitment: string | null = null;
  let principalDiDQubeCommitment: { value: string; version: 'v1' } | null = null;
  if (authorityBinding === 'ROOT_DID') {
    // Pinned ONCE, here, at formation — never re-derived at authorize time.
    // Fail closed: a forming persona that cannot resolve, through the
    // canonical DiDQube resolver, to a stable constitutional subject cannot
    // form a ROOT_DID-bound agreement at all, rather than forming one with a
    // null principal that would make every future authorize attempt refuse
    // for an unclear reason. Never falls back to personas.root_did.
    if (!callerAuthUserId) {
      return {
        ok: false,
        reason: 'authorityBinding "ROOT_DID" requires the forming persona\'s authenticated auth_user_id — none supplied',
      };
    }
    const resolution = await resolveDiDQube({ kind: 'auth_user_id', authUserId: callerAuthUserId });
    if (resolution.state !== 'resolved') {
      return {
        ok: false,
        reason: `authorityBinding "ROOT_DID" requires the forming persona to resolve, through the canonical DiDQube resolver, to a stable constitutional subject — resolution ${resolution.state}`,
      };
    }
    principalDiDQubeCommitment = { value: resolution.primitive.publicCommitment.value, version: resolution.primitive.publicCommitment.commitmentVersion };
    // Recorded for observability only — never the authority anchor. See the
    // DiDQube stable-container model note on AGREEMENT_AUTHORITY_BINDINGS.
    const currentDidUri = resolution.primitive.currentIdentityPrimitive?.didUri ?? null;
    principalRootDidCommitment = currentDidUri ? didPublicRef(currentDidUri) : null;
  }

  const ownerCommitment = agreementOwnerCommitment(personaId);
  const object = buildAgreementObject({ ...input, agreementId }, ownerCommitment, principalRootDidCommitment, principalDiDQubeCommitment);
  // T2 canary — a leak is a refusal, never a write.
  const leak = findForbiddenObjectKey(object);
  if (leak) return { ok: false, reason: `T0 identifier leak in agreement object at ${leak} — refused` };

  try {
    const { data: existing } = await admin
      .from('constitutional_agreements')
      .select('*')
      .eq('agreement_id', agreementId)
      .maybeSingle();
    if (existing) return { ok: true, agreement: rowToAgreement(existing), alreadyFormed: true };

    const { data, error } = await admin
      .from('constitutional_agreements')
      .insert({
        agreement_id: agreementId,
        display_label: input.displayLabel.trim(),
        object,
        status: 'proposed',
        capability_ref: input.capabilityRef.trim(),
        selected_agent_ref: input.selectedAgentRef.trim(),
        owner_commitment: ownerCommitment,
      })
      .select('*')
      .single();
    if (error) {
      softFail('form', error.message);
      return { ok: false, reason: error.message.includes(MISSING) ? 'constitutional_agreements table missing — apply migration 20260719000000' : error.message };
    }
    return { ok: true, agreement: rowToAgreement(data), alreadyFormed: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('form', msg);
    return { ok: false, reason: msg };
  }
}

export type AcceptResult =
  | { ok: true; agreement: ConstitutionalAgreementRow; receiptId: string | null; alreadyAccepted: boolean; receiptWarning?: string }
  | { ok: false; reason: string };

/**
 * Accept the agreement (proposed → accepted). The acceptance PROOF is produced
 * by the configured provider (local | x409); DVN anchors the agreement_formed
 * receipt (the constitutional anchor of record). Idempotent: a re-accept of an
 * already-accepted agreement returns it unchanged.
 */
export async function acceptAgreement(
  personaId: string,
  input: { agreementId: string; acceptorType: AcceptorType; acceptorId: string; provider?: string },
): Promise<AcceptResult> {
  const agreementId = input.agreementId?.trim();
  if (!agreementId) return { ok: false, reason: 'agreementId required' };
  if (!input.acceptorId?.trim()) return { ok: false, reason: 'acceptorId required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'agreement store unavailable' };

  const row = await getAgreement(agreementId);
  if (!row) return { ok: false, reason: `agreement "${agreementId}" not found — form it first` };
  if (row.status === 'accepted') {
    return {
      ok: true,
      agreement: row,
      receiptId: row.formedReceiptId,
      alreadyAccepted: true,
      receiptWarning: row.formedReceiptId ? undefined : 'agreement_formed receipt is still missing on this already-accepted agreement',
    };
  }
  if (!isLegalObjectTransition(AGREEMENT_LIFECYCLE, row.status, 'accepted')) {
    return { ok: false, reason: `cannot accept an agreement in status '${row.status}'` };
  }

  const provider = getAcceptanceProvider(input.provider);
  let acceptance: AcceptanceRecord;
  try {
    acceptance = await provider.requestAcceptance(
      {
        agreementId,
        agreementRef: row.object.identity.ref,
        termsCommitment: row.object.payload.termsCommitment,
        termsVersion: row.object.version.version,
        acceptorType: input.acceptorType,
        acceptorCommitment: acceptorCommitmentFor(input.acceptorType, input.acceptorId.trim()),
      },
      new Date().toISOString(),
    );
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'acceptance provider failed' };
  }

  const updatedObject: ConstitutionalObject<AgreementPayload> = {
    ...row.object,
    version: { ...row.object.version, status: 'published' },
    lifecycle: { ...row.object.lifecycle, state: 'accepted' },
    payload: { ...row.object.payload, acceptance },
  };

  let receiptId: string | null = null;
  let receiptWarning: string | undefined;
  try {
    const receipt = await createActivityReceipt({
      personaId,
      actionType: 'agreement_formed',
      activeCartridge: 'metame',
      summary:
        `Constitutional Agreement accepted: "${row.displayLabel}" [agr=${agreementId}] ` +
        `cap=${row.capabilityRef} agent=${row.selectedAgentRef} ` +
        `acceptor=${input.acceptorType} via ${acceptance.provider} ` +
        `commit=${acceptance.commitmentHash.slice(0, 16)}${acceptance.anchorRef ? ` anchor=${acceptance.anchorRef}` : ''}`,
      agentsInvoked: ['aigent-z'],
      contextShared: ['agreement_id', 'capability_ref', 'acceptance_commitment'],
      artifactsCreated: [agreementId],
    });
    receiptId = receipt?.id ?? null;
    // createActivityReceipt can resolve without throwing yet still return no
    // row (its own soft-fail path) — that is exactly as silent as a caught
    // exception, so both must produce the same visible warning.
    if (!receiptId) receiptWarning = 'agreement_formed receipt was not created — see server logs for [constitutional agreement]';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[constitutional agreement] agreement_formed receipt failed — acceptance stands:', e);
    receiptWarning = `agreement_formed receipt failed: ${msg}`;
  }

  const provenanceIds = receiptId ? [...updatedObject.provenance.receiptIds, receiptId] : updatedObject.provenance.receiptIds;
  const { data, error } = await admin
    .from('constitutional_agreements')
    .update({
      status: 'accepted',
      acceptance,
      object: { ...updatedObject, provenance: { ...updatedObject.provenance, receiptIds: provenanceIds } },
      formed_receipt_id: receiptId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) {
    softFail('accept', error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true, agreement: rowToAgreement(data), receiptId, alreadyAccepted: false, receiptWarning };
}

export type AuthorizeResult =
  | { ok: true; agreement: ConstitutionalAgreementRow; receiptId: string | null; alreadyAuthorized: boolean; receiptWarning?: string }
  | { ok: false; reason: string };

/**
 * Authorize delegated execution under an accepted agreement (accepted →
 * authorized). This is the step that OPENS the 409 gate. Only the requesting
 * operator (owner-commitment match) may authorize. Emits the DVN-anchorable
 * agreement_authorized receipt. Idempotent.
 */
export async function authorizeAgreement(
  personaId: string,
  input: { agreementId: string },
  callerAuthUserId: string | null = null,
): Promise<AuthorizeResult> {
  const agreementId = input.agreementId?.trim();
  if (!agreementId) return { ok: false, reason: 'agreementId required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'agreement store unavailable' };

  const row = await getAgreement(agreementId);
  if (!row) return { ok: false, reason: `agreement "${agreementId}" not found` };

  /*
   * AUTHORITY CHECK — branches on the agreement's OWN classification
   * (operator directive, 2026-08-08: "CFS agreements are RootDID-authority-
   * bound, not persona-authority-bound"). `authorityBinding` defaults to
   * 'PERSONA' for every row formed before this field existed — the exact
   * pre-existing owner-commitment check, byte-for-byte unchanged.
   *
   * 'ROOT_DID': the forming and authorizing personas need not be the same
   * persona — authorization succeeds when BOTH resolve, through the
   * canonical DiDQube resolver, to the SAME stable constitutional subject
   * (`agreementPrincipalMatches`, shared with the listing route). DiDQube
   * equivalence establishes WHO may exercise the principal's authority; it
   * does not by itself open the gate below — the verification-requirements
   * check that follows still runs against the AUTHORIZING persona, exactly
   * as before, so "same DiDQube but this specific human hasn't met the CFS
   * verification bar" still refuses.
   */
  const authorityBinding = row.object.payload.authorityBinding ?? 'PERSONA';
  let principalRootDidCommitment: string | null = null;
  if (authorityBinding === 'ROOT_DID') {
    principalRootDidCommitment = row.object.payload.principalRootDidCommitment ?? null;
    if (!callerAuthUserId) {
      return {
        ok: false,
        reason: 'authorizing a ROOT_DID-bound agreement requires the authorizing persona\'s authenticated auth_user_id — none supplied',
      };
    }
    const resolution = await resolveDiDQube({ kind: 'auth_user_id', authUserId: callerAuthUserId });
    // Fail closed on any resolver state other than 'resolved' — unresolved,
    // ambiguous, conflicted or unsupported is never treated as "matches" and
    // never treated as "safe to skip the check".
    if (resolution.state !== 'resolved') {
      return {
        ok: false,
        reason:
          `only a persona resolving, through the canonical DiDQube resolver, to the same stable constitutional ` +
          `subject as the agreement's principal may authorize this ROOT_DID-bound agreement — authorizer resolution ${resolution.state}`,
      };
    }
    const matches = await agreementPrincipalMatches(row, resolution.primitive);
    if (!matches) {
      return {
        ok: false,
        reason:
          'only a persona resolving to the same DiDQube as the agreement\'s principal may authorize this ' +
          'ROOT_DID-bound agreement',
      };
    }
  } else if (row.object.ownership.ownerCommitment !== agreementOwnerCommitment(personaId)) {
    // Only the requesting operator may authorize (owner-commitment match) — unchanged.
    return { ok: false, reason: 'only the requesting operator may authorize this agreement' };
  }
  if (row.status === 'authorized') {
    return {
      ok: true,
      agreement: row,
      receiptId: row.authorizedReceiptId,
      alreadyAuthorized: true,
      receiptWarning: row.authorizedReceiptId ? undefined : 'agreement_authorized receipt is still missing on this already-authorized agreement',
    };
  }
  if (row.status !== 'accepted') {
    return { ok: false, reason: `cannot authorize an agreement in status '${row.status}' — it must be accepted first` };
  }
  if (!row.acceptance) return { ok: false, reason: 'agreement has no acceptance record — accept it first' };

  // Graded proof-of-humanity (CFS-043 §6 / PRD-MPY-001 §7): the required grade
  // is a token ON THE CONTRACT (verificationRequirements), never a hard-coded
  // domain check — this is the ONE place delegated execution can be opened, so
  // it is the ONE place the grade is enforced. An agreement demanding
  // world-id-verified-authorizer (money-moving) cannot reach 'authorized'
  // unless the authorizing human holds a live, World-ID-verified Polity
  // Passport — the passport application's captcha-grade proof is insufficient
  // for money movement. Fail closed: a lookup error reads as unverified, never
  // as verified.
  const requirements = row.object.payload.verificationRequirements ?? [];
  const worldIdRequired = requirements.includes(PROOF_REQUIREMENT.world_id);
  let verified: boolean | null = null;
  if (worldIdRequired) {
    verified = await hasVerifiedWorldIdPassport(personaId);
    if (!verified) {
      return {
        ok: false,
        reason:
          'this agreement requires a World-ID-verified Polity Passport to authorize (money-moving grade) — ' +
          'verify World ID on your passport (Polity Passport → World ID upgrade) before authorizing',
      };
    }
  }

  const updatedObject: ConstitutionalObject<AgreementPayload> = {
    ...row.object,
    lifecycle: { ...row.object.lifecycle, state: 'authorized' },
  };

  let receiptId: string | null = null;
  let receiptWarning: string | undefined;
  try {
    const receipt = await createActivityReceipt({
      personaId,
      actionType: 'agreement_authorized',
      activeCartridge: 'metame',
      summary:
        `Constitutional Agreement authorized: "${row.displayLabel}" [agr=${agreementId}] ` +
        `cap=${row.capabilityRef} agent=${row.selectedAgentRef} — delegated execution may now proceed under band ` +
        `${row.object.payload.delegatedAuthority.band} (max ${row.object.payload.delegatedAuthority.maxActions} actions)`,
      agentsInvoked: ['aigent-z'],
      contextShared: ['agreement_id', 'delegated_authority'],
      policyEnvelopeId: agreementId,
      /*
       * THE RECEIPT IS THE CANONICAL GATEWAY TO CSA = AUTHORIZED (operator
       * directive, 2026-08-08) — every field the directive names, preserved
       * structurally rather than only in the free-text summary above.
       * `principalRootDidCommitment`/`actingPersonaCommitment` are ONE-WAY
       * commitments (never raw RootDID/personaId) — the acting persona
       * remains auditable without becoming the constitutional principal.
       */
      actionInput: {
        agreement: agreementId,
        termsCommitment: row.object.payload.termsCommitment,
        authorityClass: authorityBinding,
        principalRootDidCommitment: authorityBinding === 'ROOT_DID' ? principalRootDidCommitment : null,
        principalDiDQubeCommitment: authorityBinding === 'ROOT_DID' ? row.object.payload.principalDiDQubeCommitment ?? null : null,
        actingPersonaCommitment: agreementOwnerCommitment(personaId),
        verificationEvidence: { worldIdRequired, worldIdVerified: verified },
        verifiedAt: new Date().toISOString(),
        policyVersion: AGREEMENT_AUTHORIZATION_POLICY_VERSION,
      },
    });
    receiptId = receipt?.id ?? null;
    // See acceptAgreement's identical comment — a resolved-but-null receipt
    // (createActivityReceipt's own missing-table soft-fail) is exactly as
    // silent as a caught exception and must surface the same way.
    if (!receiptId) receiptWarning = 'agreement_authorized receipt was not created — see server logs for [constitutional agreement]';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[constitutional agreement] agreement_authorized receipt failed — authorization stands:', e);
    receiptWarning = `agreement_authorized receipt failed: ${msg}`;
  }

  const provenanceIds = receiptId ? [...updatedObject.provenance.receiptIds, receiptId] : updatedObject.provenance.receiptIds;
  const { data, error } = await admin
    .from('constitutional_agreements')
    .update({
      status: 'authorized',
      object: { ...updatedObject, provenance: { ...updatedObject.provenance, receiptIds: provenanceIds } },
      authorized_receipt_id: receiptId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) {
    softFail('authorize', error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true, agreement: rowToAgreement(data), receiptId, alreadyAuthorized: false, receiptWarning };
}

// ---------------------------------------------------------------------------
// The 409 gate — the canonical-service-pattern step-3 precondition
// ---------------------------------------------------------------------------

export type AgreementGateResult =
  | { ok: true; agreementId: string; status: AgreementStatus }
  | { ok: false; status: 409; reason: string; remediation: string };

/**
 * The Constitutional Agreement gate. Delegated execution of `capabilityRef` by
 * `selectedAgentRef` on behalf of the requesting operator REFUSES (HTTP 409)
 * unless an authorized agreement binds exactly that triple. This is the x409
 * idiom — "terms before transactions" — enforced as a constitutional
 * precondition, idempotent with this codebase's other 409 gates.
 *
 * Soft-fails OPEN=false: a missing store / migration yields a 409 (refuse), not
 * a silent allow — money-adjacent execution must never proceed on an
 * unverifiable gate.
 */
export async function requireAuthorizedAgreement(input: {
  capabilityRef: string;
  selectedAgentRef: string;
  requestingPersonaId: string;
}): Promise<AgreementGateResult> {
  const remediation =
    `Form + accept + authorize a Constitutional Agreement for capability "${input.capabilityRef}" ` +
    `with agent "${input.selectedAgentRef}" (POST /api/constitutional/agreement) before delegated execution.`;
  const refuse = (reason: string): AgreementGateResult => ({ ok: false, status: 409, reason, remediation });

  const admin = getSupabaseServer();
  if (!admin) return refuse('agreement store unavailable — cannot verify authorization');

  const ownerCommitment = agreementOwnerCommitment(input.requestingPersonaId);
  try {
    const { data, error } = await admin
      .from('constitutional_agreements')
      .select('agreement_id,status')
      .eq('capability_ref', input.capabilityRef)
      .eq('selected_agent_ref', input.selectedAgentRef)
      .eq('owner_commitment', ownerCommitment)
      .order('created_at', { ascending: false });
    if (error) {
      softFail('gate', error.message);
      return refuse('agreement lookup failed — refusing execution');
    }
    const authorized = (data ?? []).find((r) => GATE_OPEN_STATUSES.has(String(r.status) as AgreementStatus));
    if (!authorized) return refuse('no authorized Constitutional Agreement for this operator + capability + agent');
    return { ok: true, agreementId: String(authorized.agreement_id), status: String(authorized.status) as AgreementStatus };
  } catch (e) {
    softFail('gate', e instanceof Error ? e.message : String(e));
    return refuse('agreement gate error — refusing execution');
  }
}
