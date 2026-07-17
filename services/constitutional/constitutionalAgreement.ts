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
}

/** PURE — build the agreement's ConstitutionalObject. No I/O, no receipts. */
export function buildAgreementObject(
  input: FormAgreementInput,
  ownerCommitment: string,
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
export async function formAgreement(personaId: string, input: FormAgreementInput): Promise<FormResult> {
  const agreementId = input.agreementId?.trim();
  if (!agreementId) return { ok: false, reason: 'agreementId required' };
  if (!input.displayLabel?.trim()) return { ok: false, reason: 'displayLabel required' };
  if (!input.capabilityRef?.trim()) return { ok: false, reason: 'capabilityRef required (a registered capability id)' };
  if (!input.selectedAgentRef?.trim()) return { ok: false, reason: 'selectedAgentRef required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'agreement store unavailable' };

  const ownerCommitment = agreementOwnerCommitment(personaId);
  const object = buildAgreementObject({ ...input, agreementId }, ownerCommitment);
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
  | { ok: true; agreement: ConstitutionalAgreementRow; receiptId: string | null; alreadyAccepted: boolean }
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
  if (row.status === 'accepted') return { ok: true, agreement: row, receiptId: row.formedReceiptId, alreadyAccepted: true };
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
  } catch (e) {
    console.error('[constitutional agreement] agreement_formed receipt failed — acceptance stands:', e);
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
  return { ok: true, agreement: rowToAgreement(data), receiptId, alreadyAccepted: false };
}

export type AuthorizeResult =
  | { ok: true; agreement: ConstitutionalAgreementRow; receiptId: string | null; alreadyAuthorized: boolean }
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
): Promise<AuthorizeResult> {
  const agreementId = input.agreementId?.trim();
  if (!agreementId) return { ok: false, reason: 'agreementId required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'agreement store unavailable' };

  const row = await getAgreement(agreementId);
  if (!row) return { ok: false, reason: `agreement "${agreementId}" not found` };
  // Only the requesting operator may authorize (owner-commitment match).
  if (row.object.ownership.ownerCommitment !== agreementOwnerCommitment(personaId)) {
    return { ok: false, reason: 'only the requesting operator may authorize this agreement' };
  }
  if (row.status === 'authorized') return { ok: true, agreement: row, receiptId: row.authorizedReceiptId, alreadyAuthorized: true };
  if (row.status !== 'accepted') {
    return { ok: false, reason: `cannot authorize an agreement in status '${row.status}' — it must be accepted first` };
  }
  if (!row.acceptance) return { ok: false, reason: 'agreement has no acceptance record — accept it first' };

  const updatedObject: ConstitutionalObject<AgreementPayload> = {
    ...row.object,
    lifecycle: { ...row.object.lifecycle, state: 'authorized' },
  };

  let receiptId: string | null = null;
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
    });
    receiptId = receipt?.id ?? null;
  } catch (e) {
    console.error('[constitutional agreement] agreement_authorized receipt failed — authorization stands:', e);
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
  return { ok: true, agreement: rowToAgreement(data), receiptId, alreadyAuthorized: false };
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
