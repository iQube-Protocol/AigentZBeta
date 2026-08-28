/**
 * Reciprocal Artifact Exchange — service layer (PRD-IRL-AX-001).
 *
 * The generic IRL capability: a bilateral, receipted exchange of
 * independently frozen research artifacts between two collaborating
 * parties, gated by a reciprocal disclosure policy and a lightweight
 * signing ritual. IRL-AX-001 (CI/IRL × OCSGA) is the first dogfood
 * INSTANCE — nothing in this file names it or any architecture-specific
 * concept. See types/reciprocalExchange.ts for the full object model and
 * state machine, and the PRD for the ritual this composes.
 *
 * ── FAIL CLOSED, SERVER-SIDE ONLY ────────────────────────────────────────
 *
 * Every function here enforces membership/authorization itself — it is
 * never acceptable for a route or the UI to be the only gate. A caller who
 * is not `initiatorPersonaId` or `counterpartyPersonaId` on the exchange
 * gets `{ ok: false, reason: 'not-a-party' }` from every function that reads
 * or mutates exchange state, even before checking anything else.
 *
 * ── PRINCIPAL VS DELEGATED AGENT ─────────────────────────────────────────
 *
 * `actorType` is never trusted from client input — callers (API routes)
 * resolve it via `resolveConstitutionalContext(req)` (the SAME primitive
 * `services/delegation/delegationAuthorityGate.ts` uses to distinguish a
 * delegated Agent's action from the human default identity) and pass the
 * resolved value in. `freezeDeclaration` and `signInstrument` refuse
 * `actorType === 'delegated_agent'` — the ritual requires the PRINCIPAL's
 * own attestation, and an agent's action must never stand in for it.
 *
 * ── THE ISOLATION-CLAIM GUARD ─────────────────────────────────────────────
 *
 * `crossExchange` builds the one human-readable receipt summary this
 * capability ever generates automatically, and runs it through
 * `assertNoIsolationClaim` before writing it. This is a defensive backstop
 * (the template itself is written to satisfy PRD §2) rather than the
 * primary enforcement — the primary enforcement is that this template is
 * the ONLY place such a summary is generated at all.
 */

import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { createOrGetChannel } from '@/services/qubetalk/peerChannel';
import {
  type ExchangeStatus,
  type PartySlot,
  type DisclosurePolicy,
  type ArtifactSourceType,
  type ActorType,
  type ExchangeArtifactRecord,
  type ExchangeAttestationRecord,
  type ExchangeReceiptRecord,
  type ExchangeComparisonRecord,
  type ExchangeDerivativeRecord,
  type ReciprocalExchangeRecord,
  type ComparisonClassification,
  type CompatibilityKind,
  type EvidenceOriginChannel,
  isLegalExchangeTransition,
  hasCrossed,
  assertNoIsolationClaim,
  FREEZE_DECLARATION_TEXT,
  EXCHANGE_INSTRUMENT_CLAUSES,
} from '@/types/reciprocalExchange';

const T_EXCHANGES = 'reciprocal_exchanges';
const T_ARTIFACTS = 'exchange_artifacts';
const T_ATTESTATIONS = 'exchange_attestations';
const T_RECEIPTS = 'exchange_receipts';
const T_COMPARISONS = 'exchange_comparisons';
const T_DERIVATIVES = 'exchange_derivatives';

export const MIGRATION_HINT =
  'reciprocal_exchanges table missing — apply supabase/migrations/20260930020000_reciprocal_artifact_exchange.sql';

// ─── Row mapping ──────────────────────────────────────────────────────────

function rowToExchange(r: Record<string, unknown>): ReciprocalExchangeRecord {
  return {
    id: String(r.id),
    exchangeType: (r.exchange_type as ReciprocalExchangeRecord['exchangeType']) ?? 'independent-artifact-comparison',
    title: String(r.title),
    purpose: String(r.purpose),
    researchQuestion: (r.research_question as string | null) ?? null,
    initiatorPersonaId: String(r.initiator_persona_id),
    counterpartyPersonaId: (r.counterparty_persona_id as string | null) ?? null,
    researchSpaceId: (r.research_space_id as string | null) ?? null,
    cohortId: (r.cohort_id as string | null) ?? null,
    status: r.status as ExchangeStatus,
    disclosurePolicy: r.disclosure_policy as DisclosurePolicy,
    comparisonPolicy: (r.comparison_policy as string | null) ?? null,
    confidentialityClass: String(r.confidentiality_class),
    permittedPurpose: String(r.permitted_purpose),
    ownershipDeclaration: String(r.ownership_declaration),
    derivativeAnalysisPermitted: Boolean(r.derivative_analysis_permitted),
    publicationPermitted: Boolean(r.publication_permitted),
    retentionPolicy: (r.retention_policy as string | null) ?? null,
    agreementRef: (r.agreement_ref as string | null) ?? null,
    inviteCodeHash: (r.invite_code_hash as string | null) ?? null,
    inviteExpiresAt: (r.invite_expires_at as string | null) ?? null,
    qubetalkChannelId: (r.qubetalk_channel_id as string | null) ?? null,
    parentExperimentId: (r.parent_experiment_id as string | null) ?? null,
    derivedExperimentId: (r.derived_experiment_id as string | null) ?? null,
    createdAt: String(r.created_at),
    openedAt: (r.opened_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
  };
}

function rowToArtifact(r: Record<string, unknown>): ExchangeArtifactRecord {
  return {
    id: String(r.id),
    exchangeId: String(r.exchange_id),
    party: r.party as PartySlot,
    title: String(r.title),
    artifactClass: String(r.artifact_class),
    description: (r.description as string | null) ?? null,
    version: Number(r.version),
    sourceType: r.source_type as ArtifactSourceType,
    sourceReference: String(r.source_reference),
    contentHash: (r.content_hash as string | null) ?? null,
    repositoryCommit: (r.repository_commit as string | null) ?? null,
    storageReference: (r.storage_reference as string | null) ?? null,
    mimeType: (r.mime_type as string | null) ?? null,
    confidentialityClass: String(r.confidentiality_class),
    ownershipDeclaration: String(r.ownership_declaration),
    rightsForExchange: String(r.rights_for_exchange),
    supersedesArtifactId: (r.supersedes_artifact_id as string | null) ?? null,
    depositedAt: String(r.deposited_at),
    depositReceiptId: (r.deposit_receipt_id as string | null) ?? null,
    originChannel: (r.origin_channel as ExchangeArtifactRecord['originChannel'] | null) ?? 'native-ui',
    registeringOperatorPersonaId: (r.registering_operator_persona_id as string | null) ?? null,
    authorityBasis: (r.authority_basis as string | null) ?? null,
    pendingPrincipalAttestation: Boolean(r.pending_principal_attestation),
  };
}

function rowToAttestation(r: Record<string, unknown>): ExchangeAttestationRecord {
  return {
    id: String(r.id),
    exchangeId: String(r.exchange_id),
    party: r.party as PartySlot,
    actType: r.act_type as ExchangeAttestationRecord['actType'],
    artifactVersion: r.artifact_version === null || r.artifact_version === undefined ? null : Number(r.artifact_version),
    actorType: r.actor_type as ActorType,
    statementText: String(r.statement_text),
    attestedAt: String(r.attested_at),
    receiptId: (r.receipt_id as string | null) ?? null,
    originChannel: (r.origin_channel as ExchangeAttestationRecord['originChannel'] | null) ?? 'native-ui',
  };
}

function rowToReceipt(r: Record<string, unknown>): ExchangeReceiptRecord {
  return {
    id: String(r.id),
    exchangeId: String(r.exchange_id),
    activityReceiptId: (r.activity_receipt_id as string | null) ?? null,
    partyAArtifactId: String(r.party_a_artifact_id),
    partyBArtifactId: String(r.party_b_artifact_id),
    partyAArtifactVersion: Number(r.party_a_artifact_version),
    partyBArtifactVersion: Number(r.party_b_artifact_version),
    partyAFingerprint: (r.party_a_fingerprint as string | null) ?? null,
    partyBFingerprint: (r.party_b_fingerprint as string | null) ?? null,
    partyAFreezeAttestationId: String(r.party_a_freeze_attestation_id),
    partyBFreezeAttestationId: String(r.party_b_freeze_attestation_id),
    partyASignatureAttestationId: String(r.party_a_signature_attestation_id),
    partyBSignatureAttestationId: String(r.party_b_signature_attestation_id),
    disclosurePolicy: r.disclosure_policy as DisclosurePolicy,
    confidentialityClassRef: String(r.confidentiality_class_ref),
    purpose: String(r.purpose),
    crossedAt: String(r.crossed_at),
    humanReadableSummary: String(r.human_readable_summary),
  };
}

function rowToComparison(r: Record<string, unknown>): ExchangeComparisonRecord {
  return {
    id: String(r.id),
    exchangeId: String(r.exchange_id),
    partyAArtifactId: String(r.party_a_artifact_id),
    partyBArtifactId: String(r.party_b_artifact_id),
    openedAt: String(r.opened_at),
    openedByPersonaId: String(r.opened_by_persona_id),
    status: r.status as 'open' | 'closed',
  };
}

function rowToDerivative(r: Record<string, unknown>): ExchangeDerivativeRecord {
  return {
    id: String(r.id),
    comparisonId: String(r.comparison_id),
    exchangeId: String(r.exchange_id),
    title: String(r.title),
    description: String(r.description),
    sourceArtifactIds: Array.isArray(r.source_artifact_ids) ? (r.source_artifact_ids as string[]) : [],
    classification: (r.classification as ComparisonClassification | null) ?? null,
    compatibilityKind: (r.compatibility_kind as CompatibilityKind | null) ?? null,
    createdByPersonaId: String(r.created_by_persona_id),
    createdAt: String(r.created_at),
  };
}

function isMissingTable(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /does not exist/i.test(error.message));
}

function hashCode(rawCode: string): string {
  return createHash('sha256').update(rawCode).digest('hex');
}

// ─── Loading + membership ────────────────────────────────────────────────

export type LoadResult =
  | { ok: true; exchange: ReciprocalExchangeRecord }
  | { ok: false; error: string };

export async function loadExchange(admin: SupabaseClient, exchangeId: string): Promise<LoadResult> {
  const { data, error } = await admin.from(T_EXCHANGES).select('*').eq('id', exchangeId).maybeSingle();
  if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error.message };
  if (!data) return { ok: false, error: 'exchange not found' };
  return { ok: true, exchange: rowToExchange(data as Record<string, unknown>) };
}

/** The caller's slot on this exchange, or null if they are not a party.
 *  FAIL CLOSED — every read/write path checks this before anything else. */
export function resolveMembership(exchange: ReciprocalExchangeRecord, personaId: string): PartySlot | null {
  if (exchange.initiatorPersonaId === personaId) return 'A';
  if (exchange.counterpartyPersonaId === personaId) return 'B';
  return null;
}

async function currentArtifact(
  admin: SupabaseClient,
  exchangeId: string,
  party: PartySlot,
): Promise<ExchangeArtifactRecord | null> {
  const { data, error } = await admin
    .from(T_ARTIFACTS)
    .select('*')
    .eq('exchange_id', exchangeId)
    .eq('party', party)
    .order('version', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return rowToArtifact(data[0] as Record<string, unknown>);
}

async function attestationsFor(
  admin: SupabaseClient,
  exchangeId: string,
  party: PartySlot,
): Promise<ExchangeAttestationRecord[]> {
  const { data, error } = await admin
    .from(T_ATTESTATIONS)
    .select('*')
    .eq('exchange_id', exchangeId)
    .eq('party', party)
    .order('attested_at', { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToAttestation);
}

/** The most recent attestation of `actType` for `party` that is CURRENT —
 *  i.e. pinned to the party's CURRENT artifact version. A stale attestation
 *  (pinned to a superseded version) is never returned here, which is what
 *  makes an ARTIFACT_REPLACEMENT invalidate a prior freeze/signature without
 *  deleting or editing the historical row. */
async function currentAttestation(
  admin: SupabaseClient,
  exchangeId: string,
  party: PartySlot,
  actType: ExchangeAttestationRecord['actType'],
  currentVersion: number | null,
): Promise<ExchangeAttestationRecord | null> {
  const all = await attestationsFor(admin, exchangeId, party);
  return (
    all.find(
      (a) =>
        a.actType === actType &&
        (actType === 'receipt_acknowledgment' ? true : a.artifactVersion === currentVersion),
    ) ?? null
  );
}

// ─── 1. Create ────────────────────────────────────────────────────────────

export interface CreateExchangeInput {
  initiatorPersonaId: string;
  title: string;
  purpose: string;
  permittedPurpose: string;
  researchQuestion?: string;
  disclosurePolicy?: DisclosurePolicy;
  comparisonPolicy?: string;
  confidentialityClass?: string;
  ownershipDeclaration?: string;
  derivativeAnalysisPermitted?: boolean;
  publicationPermitted?: boolean;
  retentionPolicy?: string;
  agreementRef?: string;
  parentExperimentId?: string;
}

export async function createExchange(
  admin: SupabaseClient,
  input: CreateExchangeInput,
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  if (!input.initiatorPersonaId) return { ok: false, error: 'initiatorPersonaId required' };
  if (!input.title.trim()) return { ok: false, error: 'title required' };
  if (!input.purpose.trim()) return { ok: false, error: 'purpose required' };
  if (!input.permittedPurpose.trim()) return { ok: false, error: 'permittedPurpose required' };

  const insertRow: Record<string, unknown> = {
    title: input.title.trim(),
    purpose: input.purpose.trim(),
    permitted_purpose: input.permittedPurpose.trim(),
    initiator_persona_id: input.initiatorPersonaId,
    status: 'DRAFT',
    ...(input.researchQuestion ? { research_question: input.researchQuestion.trim() } : {}),
    ...(input.disclosurePolicy ? { disclosure_policy: input.disclosurePolicy } : {}),
    ...(input.comparisonPolicy ? { comparison_policy: input.comparisonPolicy } : {}),
    ...(input.confidentialityClass ? { confidentiality_class: input.confidentialityClass } : {}),
    ...(input.ownershipDeclaration ? { ownership_declaration: input.ownershipDeclaration } : {}),
    ...(input.derivativeAnalysisPermitted !== undefined
      ? { derivative_analysis_permitted: input.derivativeAnalysisPermitted }
      : {}),
    ...(input.publicationPermitted !== undefined ? { publication_permitted: input.publicationPermitted } : {}),
    ...(input.retentionPolicy ? { retention_policy: input.retentionPolicy } : {}),
    ...(input.agreementRef ? { agreement_ref: input.agreementRef } : {}),
    ...(input.parentExperimentId ? { parent_experiment_id: input.parentExperimentId } : {}),
  };

  const { data, error } = await admin.from(T_EXCHANGES).insert(insertRow).select('*').single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'insert failed' };
  const exchange = rowToExchange(data as Record<string, unknown>);

  await createActivityReceipt({
    personaId: input.initiatorPersonaId,
    activeCartridge: 'irl',
    actionType: 'exchange_created',
    summary: `Reciprocal artifact exchange created: "${exchange.title}" [exchange=${exchange.id}] by ${personaPublicRef(
      input.initiatorPersonaId,
    )} — purpose: ${exchange.purpose.slice(0, 140)}`,
    contextShared: ['exchange_id', 'purpose'],
  }).catch(() => null);

  return { ok: true, exchange };
}

// ─── 2. Invite + join ────────────────────────────────────────────────────

export async function inviteCounterparty(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string; expiresInDays?: number },
): Promise<{ ok: true; rawCode: string } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  if (resolveMembership(exchange, input.personaId) !== 'A') {
    return { ok: false, error: 'only the initiator may invite a counterparty' };
  }
  if (!['A_DEPOSITED', 'INVITED'].includes(exchange.status)) {
    return {
      ok: false,
      error: `cannot invite while exchange is ${exchange.status} — deposit Party A's artifact first (A_DEPOSITED required)`,
    };
  }
  if (exchange.counterpartyPersonaId) {
    return { ok: false, error: 'a counterparty has already joined this exchange' };
  }

  const rawCode = `rax-${randomBytes(16).toString('hex')}`;
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;

  const { error } = await admin
    .from(T_EXCHANGES)
    .update({
      invite_code_hash: hashCode(rawCode),
      invite_expires_at: expiresAt,
      ...(exchange.status === 'A_DEPOSITED' ? { status: 'INVITED' } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.exchangeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rawCode };
}

/** Resolve which exchange a bearer invite code belongs to — the code itself
 *  is unguessable and globally unique (reciprocal_exchanges_invite_code_hash_idx),
 *  so a joining party need only know the code, never the exchangeId. */
export async function findExchangeByInviteCode(
  admin: SupabaseClient,
  rawCode: string,
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  const { data, error } = await admin.from(T_EXCHANGES).select('*').eq('invite_code_hash', hashCode(rawCode.trim())).maybeSingle();
  if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error.message };
  if (!data) return { ok: false, error: 'invalid invitation code' };
  return { ok: true, exchange: rowToExchange(data as Record<string, unknown>) };
}

export async function joinExchange(
  admin: SupabaseClient,
  input: { exchangeId: string; rawCode: string; personaId: string },
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;

  if (exchange.counterpartyPersonaId) {
    if (exchange.counterpartyPersonaId === input.personaId) return { ok: true, exchange }; // idempotent re-join
    return { ok: false, error: 'this exchange already has a counterparty' };
  }
  if (!exchange.inviteCodeHash) return { ok: false, error: 'no invitation is open for this exchange' };
  if (exchange.inviteExpiresAt && new Date(exchange.inviteExpiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'invitation has expired' };
  }
  if (hashCode(input.rawCode.trim()) !== exchange.inviteCodeHash) {
    return { ok: false, error: 'invalid invitation code' };
  }
  if (input.personaId === exchange.initiatorPersonaId) {
    return { ok: false, error: 'the initiator cannot also join as the counterparty' };
  }

  const channel = await createOrGetChannel(exchange.initiatorPersonaId, personaPublicRef(input.personaId), 'research-lab').catch(
    () => null,
  );

  const { data, error } = await admin
    .from(T_EXCHANGES)
    .update({
      counterparty_persona_id: input.personaId,
      status: 'B_JOINED',
      ...(channel?.ok ? { qubetalk_channel_id: channel.value.id } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.exchangeId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'join failed' };

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_counterparty_joined',
    summary: `Counterparty joined exchange [exchange=${input.exchangeId}]: ${personaPublicRef(input.personaId)}`,
    contextShared: ['exchange_id'],
  }).catch(() => null);

  return { ok: true, exchange: rowToExchange(data as Record<string, unknown>) };
}

// ─── 3. Deposit / replace artifact ───────────────────────────────────────

export interface DepositArtifactInput {
  exchangeId: string;
  personaId: string;
  title: string;
  artifactClass: string;
  description?: string;
  sourceType: ArtifactSourceType;
  sourceReference: string;
  contentHash: string;
  repositoryCommit?: string;
  storageReference?: string;
  mimeType?: string;
  confidentialityClass?: string;
  ownershipDeclaration: string;
  rightsForExchange: string;
  /** Surface Independence, 2026-08-26 — defaults to 'native-ui', preserving
   *  every existing caller unchanged. Only an MCP write tool passes 'mcp'. */
  originChannel?: EvidenceOriginChannel;
}

export async function depositArtifact(
  admin: SupabaseClient,
  input: DepositArtifactInput,
): Promise<{ ok: true; artifact: ExchangeArtifactRecord; replaced: boolean } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (hasCrossed(exchange.status)) {
    return { ok: false, error: 'cannot deposit or replace an artifact after the exchange has crossed' };
  }
  if (['DECLINED', 'WITHDRAWN_PRE_EXCHANGE', 'DISPUTED'].includes(exchange.status)) {
    return { ok: false, error: `exchange is ${exchange.status} — no further deposits accepted` };
  }
  if (!input.title.trim() || !input.sourceReference.trim() || !input.contentHash.trim()) {
    return { ok: false, error: 'title, sourceReference and contentHash are required' };
  }
  if (input.sourceType === 'repository-commit' && !input.repositoryCommit?.trim()) {
    return { ok: false, error: 'repositoryCommit is required for a repository-commit artifact — never a mutable branch URL' };
  }

  const existing = await currentArtifact(admin, input.exchangeId, party);
  const nextVersion = existing ? existing.version + 1 : 1;

  const { data, error } = await admin
    .from(T_ARTIFACTS)
    .insert({
      exchange_id: input.exchangeId,
      party,
      title: input.title.trim(),
      artifact_class: input.artifactClass.trim(),
      description: input.description?.trim() || null,
      version: nextVersion,
      source_type: input.sourceType,
      source_reference: input.sourceReference.trim(),
      content_hash: input.contentHash.trim(),
      repository_commit: input.repositoryCommit?.trim() || null,
      storage_reference: input.storageReference?.trim() || null,
      mime_type: input.mimeType?.trim() || null,
      ...(input.confidentialityClass ? { confidentiality_class: input.confidentialityClass } : {}),
      ownership_declaration: input.ownershipDeclaration.trim(),
      rights_for_exchange: input.rightsForExchange.trim(),
      supersedes_artifact_id: existing?.id ?? null,
      origin_channel: input.originChannel ?? 'native-ui',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'deposit failed' };
  const artifact = rowToArtifact(data as Record<string, unknown>);

  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: existing ? 'exchange_artifact_replaced' : 'exchange_artifact_deposited',
    summary:
      `Artifact ${existing ? 'replaced' : 'deposited'} [exchange=${input.exchangeId}] party=${party} ` +
      `title="${artifact.title}" v${artifact.version} fingerprint=${artifact.contentHash?.slice(0, 16)}`,
    contextShared: ['exchange_id', 'artifact_class', 'version', 'content_hash'],
  }).catch(() => null);

  if (receipt?.id) {
    await admin.from(T_ARTIFACTS).update({ deposit_receipt_id: receipt.id }).eq('id', artifact.id);
  }

  await recomputeExchangeState(admin, input.exchangeId);
  return { ok: true, artifact, replaced: Boolean(existing) };
}

// ─── 3b. Operator-assisted custodial registration ─────────────────────────
//
// A SEPARATE primitive from depositArtifact — custodial registration, not
// principal impersonation. Used when the bound principal has explicitly
// authorized, out-of-band, an operator to enter their artifact on their
// behalf because they cannot themselves reach a deposit surface (e.g. a
// client-side bug blocking their own bridge crossing). The artifact is
// visible/usable immediately (comparison, disclosure) but is BLOCKED from
// freeze/signature until the bound principal confirms it themselves via
// confirmOperatorAssistedArtifact — see that function and the
// pendingPrincipalAttestation checks added to declareFreeze/signInstrument
// above. depositArtifact itself is untouched by this addition.

export interface RegisterArtifactOperatorAssistedInput {
  exchangeId: string;
  /** The persona this artifact is attributed to. MUST already be a bound
   *  party on this exchange (A or B) — resolved via resolveMembership, NEVER
   *  taken as a caller-supplied slot letter, so an operator cannot attribute
   *  an artifact to an unbound/arbitrary persona. */
  boundPrincipalPersonaId: string;
  /** Who is actually performing this write. MUST differ from
   *  boundPrincipalPersonaId (checked below) — the whole point of this
   *  primitive is that these are two different identities. Callers resolve
   *  this from the identity spine (the operator's own personaId), never from
   *  client input. */
  registeringOperatorPersonaId: string;
  /** The stated grounds for operator-assisted registration (e.g. "principal's
   *  explicit written authorization, out-of-band, <date/reference>").
   *  Recorded verbatim — never inferred, never defaulted. */
  authorityBasis: string;
  title: string;
  artifactClass: string;
  description?: string;
  sourceType: ArtifactSourceType;
  sourceReference: string;
  contentHash: string;
  repositoryCommit?: string;
  storageReference?: string;
  mimeType?: string;
  confidentialityClass?: string;
  ownershipDeclaration: string;
  rightsForExchange: string;
}

export async function registerArtifactOperatorAssisted(
  admin: SupabaseClient,
  input: RegisterArtifactOperatorAssistedInput,
): Promise<{ ok: true; artifact: ExchangeArtifactRecord } | { ok: false; error: string }> {
  if (!input.registeringOperatorPersonaId.trim()) return { ok: false, error: 'registeringOperatorPersonaId required' };
  if (!input.authorityBasis.trim()) return { ok: false, error: 'authorityBasis required' };
  if (input.registeringOperatorPersonaId === input.boundPrincipalPersonaId) {
    return { ok: false, error: 'registering-operator-must-differ-from-bound-principal' };
  }

  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;

  // The party slot is DERIVED from the bound principal's existing
  // membership on this exchange — never a caller-supplied 'A'/'B'. A persona
  // who is not already a party (e.g. not yet joined as counterparty) cannot
  // receive an operator-assisted registration; bind membership first (see
  // services/journey/boundaryResearchExchangeAdmission.ts's operator-assisted
  // admission wrapper).
  const party = resolveMembership(exchange, input.boundPrincipalPersonaId);
  if (!party) return { ok: false, error: 'not-a-party' };

  if (hasCrossed(exchange.status)) {
    return { ok: false, error: 'cannot register an artifact after the exchange has crossed' };
  }
  if (['DECLINED', 'WITHDRAWN_PRE_EXCHANGE', 'DISPUTED'].includes(exchange.status)) {
    return { ok: false, error: `exchange is ${exchange.status} — no further deposits accepted` };
  }

  // Custodial registration is a FIRST-DEPOSIT-ONLY act — never a replacement
  // of an already-deposited artifact, for EITHER party. This is what makes
  // "cannot overwrite Party A" (or any party that has already deposited)
  // true in general, not a hardcoded A-only rule.
  const existing = await currentArtifact(admin, input.exchangeId, party);
  if (existing) {
    return {
      ok: false,
      error:
        'party-already-has-a-deposited-artifact — operator-assisted registration is a first-deposit-only ' +
        'custodial act, never a replacement of an existing deposit',
    };
  }

  if (!input.title.trim() || !input.sourceReference.trim() || !input.contentHash.trim()) {
    return { ok: false, error: 'title, sourceReference and contentHash are required' };
  }
  if (input.sourceType === 'repository-commit' && !input.repositoryCommit?.trim()) {
    return { ok: false, error: 'repositoryCommit is required for a repository-commit artifact — never a mutable branch URL' };
  }

  const { data, error } = await admin
    .from(T_ARTIFACTS)
    .insert({
      exchange_id: input.exchangeId,
      party,
      title: input.title.trim(),
      artifact_class: input.artifactClass.trim(),
      description: input.description?.trim() || null,
      version: 1,
      source_type: input.sourceType,
      source_reference: input.sourceReference.trim(),
      content_hash: input.contentHash.trim(),
      repository_commit: input.repositoryCommit?.trim() || null,
      storage_reference: input.storageReference?.trim() || null,
      mime_type: input.mimeType?.trim() || null,
      ...(input.confidentialityClass ? { confidentiality_class: input.confidentialityClass } : {}),
      ownership_declaration: input.ownershipDeclaration.trim(),
      rights_for_exchange: input.rightsForExchange.trim(),
      supersedes_artifact_id: null,
      origin_channel: 'operator-assisted',
      registering_operator_persona_id: input.registeringOperatorPersonaId,
      authority_basis: input.authorityBasis.trim(),
      pending_principal_attestation: true,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'operator-assisted registration failed' };
  }
  const artifact = rowToArtifact(data as Record<string, unknown>);

  const receipt = await createActivityReceipt({
    personaId: input.registeringOperatorPersonaId,
    activeCartridge: 'irl',
    actionType: 'exchange_artifact_registered_operator_assisted',
    summary:
      `Artifact registered operator-assisted [exchange=${input.exchangeId}] party=${party} ` +
      `bound-principal=${personaPublicRef(input.boundPrincipalPersonaId)} operator=${personaPublicRef(input.registeringOperatorPersonaId)} ` +
      `title="${artifact.title}" v1 fingerprint=${artifact.contentHash?.slice(0, 16)} — pending principal attestation`,
    contextShared: ['exchange_id', 'artifact_class', 'content_hash', 'authority_basis'],
  }).catch(() => null);

  if (receipt?.id) {
    await admin.from(T_ARTIFACTS).update({ deposit_receipt_id: receipt.id }).eq('id', artifact.id);
  }

  await recomputeExchangeState(admin, input.exchangeId);
  return { ok: true, artifact };
}

/**
 * The ONLY way `pendingPrincipalAttestation` ever clears. Callable ONLY by
 * the exact bound Party B (or A) principal the pending artifact is
 * attributed to — never by the registering operator, never by the
 * counterparty, never by an admin. Enforced structurally, not by a role
 * check: `party` is derived from `resolveMembership(exchange, personaId)`
 * for the CALLER, and the artifact looked up is that SAME party's current
 * artifact — so a caller who resolves to a different party (or to no party
 * at all) can only ever reach their OWN slot's artifact, never someone
 * else's pending one. Identical access-control shape to depositArtifact/
 * declareFreeze/signInstrument above.
 *
 * Touches ONLY the pending flag — `content_hash` (and every other
 * evidentiary field) is left byte-for-byte unchanged, so a later
 * freeze/signature operates on the exact fingerprint that was registered.
 */
export async function confirmOperatorAssistedArtifact(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string },
): Promise<{ ok: true; artifact: ExchangeArtifactRecord } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };

  const artifact = await currentArtifact(admin, input.exchangeId, party);
  if (!artifact) return { ok: false, error: 'no artifact on record for this party' };
  if (!artifact.pendingPrincipalAttestation) {
    // Idempotent no-op — nothing pending to confirm (never registered
    // operator-assisted, or already confirmed).
    return { ok: true, artifact };
  }

  const { data, error } = await admin
    .from(T_ARTIFACTS)
    .update({ pending_principal_attestation: false })
    .eq('id', artifact.id)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'confirmation failed' };
  const confirmed = rowToArtifact(data as Record<string, unknown>);

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_operator_assisted_artifact_confirmed',
    summary:
      `Operator-assisted artifact registration confirmed by bound principal [exchange=${input.exchangeId}] party=${party} ` +
      `title="${confirmed.title}" v${confirmed.version} fingerprint=${confirmed.contentHash?.slice(0, 16)} — hash unchanged`,
    contextShared: ['exchange_id', 'artifact_version', 'content_hash'],
  }).catch(() => null);

  return { ok: true, artifact: confirmed };
}

// ─── 4. Freeze declaration ────────────────────────────────────────────────

export async function declareFreeze(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string; actorType: ActorType; originChannel?: EvidenceOriginChannel },
): Promise<{ ok: true; attestation: ExchangeAttestationRecord } | { ok: false; error: string }> {
  if (input.actorType !== 'principal') {
    return { ok: false, error: 'freeze-declaration-requires-principal' };
  }
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (hasCrossed(exchange.status)) return { ok: false, error: 'exchange has already crossed' };

  const artifact = await currentArtifact(admin, input.exchangeId, party);
  if (!artifact) return { ok: false, error: 'deposit an artifact before declaring its freeze' };
  if (artifact.pendingPrincipalAttestation) {
    return {
      ok: false,
      error:
        'artifact-pending-principal-attestation — this artifact was registered operator-assisted and is not yet ' +
        'confirmed by the bound principal (see confirmOperatorAssistedArtifact); it cannot be frozen until then, ' +
        'by any caller including the registering operator',
    };
  }

  const existingCurrent = await currentAttestation(admin, input.exchangeId, party, 'freeze_declaration', artifact.version);
  if (existingCurrent) return { ok: true, attestation: existingCurrent };

  const { data, error } = await admin
    .from(T_ATTESTATIONS)
    .insert({
      exchange_id: input.exchangeId,
      party,
      act_type: 'freeze_declaration',
      artifact_version: artifact.version,
      actor_type: 'principal',
      statement_text: FREEZE_DECLARATION_TEXT,
      origin_channel: input.originChannel ?? 'native-ui',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'freeze declaration failed' };
  const attestation = rowToAttestation(data as Record<string, unknown>);

  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_freeze_declared',
    summary: `Freeze declared [exchange=${input.exchangeId}] party=${party} artifact-version=${artifact.version} — "${FREEZE_DECLARATION_TEXT}"`,
    contextShared: ['exchange_id', 'artifact_version'],
  }).catch(() => null);
  if (receipt?.id) await admin.from(T_ATTESTATIONS).update({ receipt_id: receipt.id }).eq('id', attestation.id);

  await recomputeExchangeState(admin, input.exchangeId);
  return { ok: true, attestation };
}

// ─── 5. Sign the Exchange Instrument ──────────────────────────────────────

export async function signInstrument(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string; actorType: ActorType; originChannel?: EvidenceOriginChannel },
): Promise<{ ok: true; attestation: ExchangeAttestationRecord; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  if (input.actorType !== 'principal') {
    return { ok: false, error: 'instrument-signature-requires-principal' };
  }
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (hasCrossed(exchange.status)) return { ok: false, error: 'exchange has already crossed' };
  if (!['READY_TO_SIGN', 'A_SIGNED', 'B_SIGNED'].includes(exchange.status)) {
    return { ok: false, error: `cannot sign while exchange is ${exchange.status} — both parties must deposit and freeze-declare first` };
  }

  const artifact = await currentArtifact(admin, input.exchangeId, party);
  if (!artifact) return { ok: false, error: 'no artifact on record for this party' };
  if (artifact.pendingPrincipalAttestation) {
    return {
      ok: false,
      error:
        'artifact-pending-principal-attestation — this artifact was registered operator-assisted and is not yet ' +
        'confirmed by the bound principal (see confirmOperatorAssistedArtifact); it cannot be signed until then, ' +
        'by any caller including the registering operator',
    };
  }
  const freeze = await currentAttestation(admin, input.exchangeId, party, 'freeze_declaration', artifact.version);
  if (!freeze) return { ok: false, error: 'declare the freeze before signing the Exchange Instrument' };

  const existingCurrent = await currentAttestation(admin, input.exchangeId, party, 'instrument_signature', artifact.version);
  if (existingCurrent) {
    const post = await loadExchange(admin, input.exchangeId);
    return { ok: true, attestation: existingCurrent, exchange: post.ok ? post.exchange : exchange };
  }

  const statementText =
    'I accept the Exchange Instrument, acknowledging: ' + EXCHANGE_INSTRUMENT_CLAUSES.map((c, i) => `(${i + 1}) ${c}`).join('; ') + '.';

  const { data, error } = await admin
    .from(T_ATTESTATIONS)
    .insert({
      exchange_id: input.exchangeId,
      party,
      act_type: 'instrument_signature',
      artifact_version: artifact.version,
      actor_type: 'principal',
      statement_text: statementText,
      origin_channel: input.originChannel ?? 'native-ui',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'signature failed' };
  const attestation = rowToAttestation(data as Record<string, unknown>);

  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_instrument_signed',
    summary: `Exchange Instrument signed [exchange=${input.exchangeId}] party=${party} artifact-version=${artifact.version}`,
    contextShared: ['exchange_id', 'artifact_version'],
  }).catch(() => null);
  if (receipt?.id) await admin.from(T_ATTESTATIONS).update({ receipt_id: receipt.id }).eq('id', attestation.id);

  const advanced = await recomputeExchangeState(admin, input.exchangeId);
  return { ok: true, attestation, exchange: advanced ?? exchange };
}

// ─── The natural-state recomputation + crossing ──────────────────────────

/**
 * Re-derive the exchange's status from the FACTS on record (deposits,
 * current freeze declarations, current signatures) and, if the derived
 * state differs from the stored one, advance (or — only pre-EXCHANGED, only
 * via an artifact replacement invalidating a prior signature — retreat to
 * ARTIFACT_REPLACEMENT_REQUIRED) to it. Deliberately order-independent (PRD
 * §11: "do not assume one fixed signature order") — this is the ONE place
 * status changes as a side effect of another action; every mutating
 * function above calls it last.
 *
 * Once EXCHANGED or any exception state, this is a no-op: forward crossing
 * only happens once, and post-exchange transitions (acknowledge, revoke,
 * comparison, derivative, dispute) are explicit calls, never inferred here.
 */
export async function recomputeExchangeState(
  admin: SupabaseClient,
  exchangeId: string,
): Promise<ReciprocalExchangeRecord | null> {
  const loaded = await loadExchange(admin, exchangeId);
  if (!loaded.ok) return null;
  const { exchange } = loaded;

  const PRE_EXCHANGE_AUTO_STATES: ExchangeStatus[] = [
    'DRAFT',
    'A_DEPOSITED',
    'INVITED',
    'B_JOINED',
    'B_DEPOSITED',
    'READY_TO_SIGN',
    'A_SIGNED',
    'B_SIGNED',
    'ARTIFACT_REPLACEMENT_REQUIRED',
  ];
  if (!PRE_EXCHANGE_AUTO_STATES.includes(exchange.status)) return exchange;

  const artifactA = await currentArtifact(admin, exchangeId, 'A');
  const artifactB = exchange.counterpartyPersonaId ? await currentArtifact(admin, exchangeId, 'B') : null;
  const freezeA = artifactA ? await currentAttestation(admin, exchangeId, 'A', 'freeze_declaration', artifactA.version) : null;
  const freezeB = artifactB ? await currentAttestation(admin, exchangeId, 'B', 'freeze_declaration', artifactB.version) : null;
  const signA = artifactA ? await currentAttestation(admin, exchangeId, 'A', 'instrument_signature', artifactA.version) : null;
  const signB = artifactB ? await currentAttestation(admin, exchangeId, 'B', 'instrument_signature', artifactB.version) : null;

  let natural: ExchangeStatus;
  if (!exchange.counterpartyPersonaId) {
    if (!artifactA) natural = 'DRAFT';
    else natural = exchange.inviteCodeHash ? 'INVITED' : 'A_DEPOSITED';
  } else if (!artifactB) {
    natural = 'B_JOINED';
  } else if (!freezeA || !freezeB) {
    natural = 'B_DEPOSITED';
  } else if (!signA && !signB) {
    natural = 'READY_TO_SIGN';
  } else if (signA && !signB) {
    natural = 'A_SIGNED';
  } else if (!signA && signB) {
    natural = 'B_SIGNED';
  } else {
    natural = 'EXCHANGED';
  }

  if (natural === exchange.status) return exchange;

  // Forward advance along a legal edge.
  if (isLegalExchangeTransition(exchange.status, natural)) {
    if (natural === 'EXCHANGED') {
      return crossExchange(admin, exchangeId, artifactA!, artifactB!, freezeA!, freezeB!, signA!, signB!);
    }
    const { data } = await admin
      .from(T_EXCHANGES)
      .update({ status: natural, updated_at: new Date().toISOString() })
      .eq('id', exchangeId)
      .select('*')
      .single();
    return data ? rowToExchange(data as Record<string, unknown>) : exchange;
  }

  // Retreat: only possible via an artifact replacement invalidating a
  // signature that was already on record — never for any other reason.
  if (isLegalExchangeTransition(exchange.status, 'ARTIFACT_REPLACEMENT_REQUIRED')) {
    const { data } = await admin
      .from(T_EXCHANGES)
      .update({ status: 'ARTIFACT_REPLACEMENT_REQUIRED', updated_at: new Date().toISOString() })
      .eq('id', exchangeId)
      .select('*')
      .single();
    return data ? rowToExchange(data as Record<string, unknown>) : exchange;
  }

  return exchange;
}

/** PRD §10's human-readable compression, generated ONCE at crossing. The
 *  ONLY place this capability auto-generates prose describing the exchange —
 *  guarded by assertNoIsolationClaim before it is ever persisted. */
function buildReceiptSummary(input: {
  exchange: ReciprocalExchangeRecord;
  artifactA: ExchangeArtifactRecord;
  artifactB: ExchangeArtifactRecord;
  crossedAt: string;
}): string {
  const { exchange, artifactA, artifactB, crossedAt } = input;
  const summary =
    `Party A deposited and attested "${artifactA.title}" v${artifactA.version}. ` +
    `Party B deposited and attested "${artifactB.title}" v${artifactB.version}. ` +
    `Both declared their artifacts independently frozen before formal exchange. ` +
    `Both accepted the Exchange Instrument. ` +
    `The IRL disclosed the frozen artifacts reciprocally at ${crossedAt} and issued this receipt ` +
    `for exchange "${exchange.title}".`;
  assertNoIsolationClaim(summary);
  return summary;
}

async function crossExchange(
  admin: SupabaseClient,
  exchangeId: string,
  artifactA: ExchangeArtifactRecord,
  artifactB: ExchangeArtifactRecord,
  freezeA: ExchangeAttestationRecord,
  freezeB: ExchangeAttestationRecord,
  signA: ExchangeAttestationRecord,
  signB: ExchangeAttestationRecord,
): Promise<ReciprocalExchangeRecord> {
  const loaded = await loadExchange(admin, exchangeId);
  const exchange = loaded.ok ? loaded.exchange : null;
  const crossedAt = new Date().toISOString();

  const activityReceipt = exchange
    ? await createActivityReceipt({
        personaId: exchange.initiatorPersonaId,
        activeCartridge: 'irl',
        actionType: 'exchange_crossed',
        summary:
          `Reciprocal exchange crossed [exchange=${exchangeId}] "${exchange.title}" — ` +
          `A=${personaPublicRef(exchange.initiatorPersonaId)}(v${artifactA.version}) ` +
          `B=${personaPublicRef(exchange.counterpartyPersonaId ?? '')}(v${artifactB.version}) ` +
          `fingerprints A=${artifactA.contentHash?.slice(0, 16)} B=${artifactB.contentHash?.slice(0, 16)} — ` +
          `both artifacts independently frozen before formal exchange`,
        contextShared: ['exchange_id', 'both_fingerprints', 'disclosure_policy'],
      }).catch(() => null)
    : null;

  const humanReadableSummary = exchange
    ? buildReceiptSummary({ exchange, artifactA, artifactB, crossedAt })
    : 'Reciprocal exchange crossed.';

  if (exchange) {
    await admin.from(T_RECEIPTS).insert({
      exchange_id: exchangeId,
      activity_receipt_id: activityReceipt?.id ?? null,
      party_a_artifact_id: artifactA.id,
      party_b_artifact_id: artifactB.id,
      party_a_artifact_version: artifactA.version,
      party_b_artifact_version: artifactB.version,
      party_a_fingerprint: artifactA.contentHash,
      party_b_fingerprint: artifactB.contentHash,
      party_a_freeze_attestation_id: freezeA.id,
      party_b_freeze_attestation_id: freezeB.id,
      party_a_signature_attestation_id: signA.id,
      party_b_signature_attestation_id: signB.id,
      disclosure_policy: exchange.disclosurePolicy,
      confidentiality_class_ref: exchange.confidentialityClass,
      purpose: exchange.purpose,
      crossed_at: crossedAt,
      human_readable_summary: humanReadableSummary,
    });
  }

  const { data } = await admin
    .from(T_EXCHANGES)
    .update({ status: 'EXCHANGED', opened_at: crossedAt, updated_at: crossedAt })
    .eq('id', exchangeId)
    .select('*')
    .single();
  return data ? rowToExchange(data as Record<string, unknown>) : (exchange as ReciprocalExchangeRecord);
}

// ─── 6. Receipt acknowledgment ────────────────────────────────────────────

export async function acknowledgeReceipt(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string },
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (!hasCrossed(exchange.status)) return { ok: false, error: 'exchange has not crossed yet — nothing to acknowledge' };

  const already = await attestationsFor(admin, input.exchangeId, party);
  if (!already.some((a) => a.actType === 'receipt_acknowledgment')) {
    const { data: attRow } = await admin
      .from(T_ATTESTATIONS)
      .insert({
        exchange_id: input.exchangeId,
        party,
        act_type: 'receipt_acknowledgment',
        artifact_version: null,
        actor_type: 'principal',
        statement_text: 'I acknowledge receipt of the counterparty artifact. This confirms delivery/access only — it is not a transfer of rights.',
      })
      .select('*')
      .single();
    const receipt = await createActivityReceipt({
      personaId: input.personaId,
      activeCartridge: 'irl',
      actionType: 'exchange_receipt_acknowledged',
      summary: `Receipt acknowledged [exchange=${input.exchangeId}] party=${party} — evidence of access, not a transfer of rights`,
      contextShared: ['exchange_id'],
    }).catch(() => null);
    if (attRow && receipt?.id) await admin.from(T_ATTESTATIONS).update({ receipt_id: receipt.id }).eq('id', (attRow as { id: string }).id);
  }

  const bothAckd =
    (await attestationsFor(admin, input.exchangeId, 'A')).some((a) => a.actType === 'receipt_acknowledgment') &&
    (await attestationsFor(admin, input.exchangeId, 'B')).some((a) => a.actType === 'receipt_acknowledgment');

  if (bothAckd && exchange.status === 'EXCHANGED') {
    const { data } = await admin
      .from(T_EXCHANGES)
      .update({ status: 'RECEIPT_ACKNOWLEDGED', updated_at: new Date().toISOString() })
      .eq('id', input.exchangeId)
      .select('*')
      .single();
    return { ok: true, exchange: data ? rowToExchange(data as Record<string, unknown>) : exchange };
  }
  const refreshed = await loadExchange(admin, input.exchangeId);
  return { ok: true, exchange: refreshed.ok ? refreshed.exchange : exchange };
}

// ─── 7. Comparison workspace shell ────────────────────────────────────────

export async function openComparison(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string },
): Promise<{ ok: true; comparison: ExchangeComparisonRecord } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (!hasCrossed(exchange.status)) return { ok: false, error: 'comparison can only open after the exchange has crossed' };

  const { data: existing } = await admin.from(T_COMPARISONS).select('*').eq('exchange_id', input.exchangeId).maybeSingle();
  if (existing) return { ok: true, comparison: rowToComparison(existing as Record<string, unknown>) };

  const receiptRow = await admin.from(T_RECEIPTS).select('*').eq('exchange_id', input.exchangeId).maybeSingle();
  if (!receiptRow.data) return { ok: false, error: 'no exchange receipt on record — cannot open comparison' };
  const receipt = rowToReceipt(receiptRow.data as Record<string, unknown>);

  const { data, error } = await admin
    .from(T_COMPARISONS)
    .insert({
      exchange_id: input.exchangeId,
      party_a_artifact_id: receipt.partyAArtifactId,
      party_b_artifact_id: receipt.partyBArtifactId,
      opened_by_persona_id: input.personaId,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'open comparison failed' };
  const comparison = rowToComparison(data as Record<string, unknown>);

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_comparison_opened',
    summary: `Comparison workspace opened [exchange=${input.exchangeId}] linked to both frozen artifacts — read-only, never mutates sources`,
    contextShared: ['exchange_id'],
  }).catch(() => null);

  if (['EXCHANGED', 'RECEIPT_ACKNOWLEDGED'].includes(exchange.status)) {
    await admin.from(T_EXCHANGES).update({ status: 'COMPARISON_OPEN', updated_at: new Date().toISOString() }).eq('id', input.exchangeId);
  }

  return { ok: true, comparison };
}

// ─── 8. Derivative lineage ─────────────────────────────────────────────────

export async function createDerivative(
  admin: SupabaseClient,
  input: {
    comparisonId: string;
    personaId: string;
    title: string;
    description: string;
    sourceArtifactIds: string[];
    classification?: ComparisonClassification;
    compatibilityKind?: CompatibilityKind;
  },
): Promise<{ ok: true; derivative: ExchangeDerivativeRecord } | { ok: false; error: string }> {
  const { data: comparisonRow, error: cErr } = await admin.from(T_COMPARISONS).select('*').eq('id', input.comparisonId).maybeSingle();
  if (cErr) return { ok: false, error: isMissingTable(cErr) ? MIGRATION_HINT : cErr.message };
  if (!comparisonRow) return { ok: false, error: 'comparison not found' };
  const comparison = rowToComparison(comparisonRow as Record<string, unknown>);

  const loaded = await loadExchange(admin, comparison.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (!resolveMembership(loaded.exchange, input.personaId)) return { ok: false, error: 'not-a-party' };

  const validSources = new Set([comparison.partyAArtifactId, comparison.partyBArtifactId]);
  if (input.sourceArtifactIds.length === 0 || input.sourceArtifactIds.some((id) => !validSources.has(id))) {
    return { ok: false, error: 'sourceArtifactIds must reference this comparison\'s frozen artifacts — never an untracked or edited id' };
  }
  if (!input.title.trim() || !input.description.trim()) return { ok: false, error: 'title and description required' };

  const { data, error } = await admin
    .from(T_DERIVATIVES)
    .insert({
      comparison_id: input.comparisonId,
      exchange_id: comparison.exchangeId,
      title: input.title.trim(),
      description: input.description.trim(),
      source_artifact_ids: input.sourceArtifactIds,
      classification: input.classification ?? null,
      compatibility_kind: input.compatibilityKind ?? null,
      created_by_persona_id: input.personaId,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error?.message ?? 'derivative creation failed' };
  const derivative = rowToDerivative(data as Record<string, unknown>);

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_derivative_created',
    summary: `Derivative artifact created [exchange=${comparison.exchangeId}, comparison=${input.comparisonId}] "${derivative.title}" — lineage to ${input.sourceArtifactIds.length} frozen source(s), sources unmodified`,
    contextShared: ['exchange_id', 'comparison_id', 'source_artifact_ids'],
  }).catch(() => null);

  return { ok: true, derivative };
}

// ─── 9. Withdraw / revoke ──────────────────────────────────────────────────

export async function withdrawPreExchange(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string; actorType: ActorType; reason: string },
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  if (input.actorType !== 'principal') return { ok: false, error: 'withdrawal-requires-principal' };
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (hasCrossed(exchange.status)) return { ok: false, error: 'cannot withdraw after the exchange has crossed — use access revocation instead' };
  if (!input.reason.trim()) return { ok: false, error: 'a withdrawal reason is required' };

  const { data, error } = await admin
    .from(T_EXCHANGES)
    .update({ status: 'WITHDRAWN_PRE_EXCHANGE', updated_at: new Date().toISOString() })
    .eq('id', input.exchangeId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'withdrawal failed' };

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_withdrawn',
    summary: `Exchange withdrawn pre-exchange [exchange=${input.exchangeId}] party=${party} — ${input.reason.slice(0, 200)}`,
    contextShared: ['exchange_id'],
  }).catch(() => null);

  return { ok: true, exchange: rowToExchange(data as Record<string, unknown>) };
}

export async function revokeAccessPostExchange(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string; actorType: ActorType; reason: string },
): Promise<{ ok: true; exchange: ReciprocalExchangeRecord } | { ok: false; error: string }> {
  if (input.actorType !== 'principal') return { ok: false, error: 'revocation-requires-principal' };
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const party = resolveMembership(exchange, input.personaId);
  if (!party) return { ok: false, error: 'not-a-party' };
  if (!hasCrossed(exchange.status)) return { ok: false, error: 'nothing to revoke — the exchange has not crossed' };
  if (!input.reason.trim()) return { ok: false, error: 'a revocation reason is required' };

  // Historical evidence (exchange_receipts, exchange_attestations) is NEVER
  // touched here — only the forward-looking status changes (PRD §17).
  const { data, error } = await admin
    .from(T_EXCHANGES)
    .update({ status: 'REVOKED_ACCESS_POST_EXCHANGE', updated_at: new Date().toISOString() })
    .eq('id', input.exchangeId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'revocation failed' };

  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'irl',
    actionType: 'exchange_access_revoked',
    summary: `Post-exchange access revoked [exchange=${input.exchangeId}] party=${party} — future runtime access only; the historical Exchange Receipt is unaffected — ${input.reason.slice(0, 200)}`,
    contextShared: ['exchange_id'],
  }).catch(() => null);

  return { ok: true, exchange: rowToExchange(data as Record<string, unknown>) };
}

// ─── 10. The gated view projection ────────────────────────────────────────

export interface ExchangeArtifactView {
  id: string | null;
  title: string | null;
  artifactClass: string | null;
  version: number | null;
  contentHash: string | null;
  sourceReference: string | null;
  storageReference: string | null;
  repositoryCommit: string | null;
  mimeType: string | null;
  depositedAt: string | null;
  frozen: boolean;
  signed: boolean;
  locked: boolean;
  lockedReason: string | null;
  /** True while this artifact was registered operator-assisted and the bound
   *  principal has not yet confirmed it (confirmOperatorAssistedArtifact).
   *  Read-visibility is unaffected by this flag — only freeze/signature are
   *  gated on it (services/research/reciprocalExchange.ts). */
  pendingPrincipalAttestation: boolean;
}

export interface ExchangeView {
  exchange: Omit<ReciprocalExchangeRecord, 'initiatorPersonaId' | 'counterpartyPersonaId' | 'inviteCodeHash'> & {
    initiatorRef: string;
    counterpartyRef: string | null;
  };
  viewerParty: PartySlot;
  yourArtifact: ExchangeArtifactView | null;
  counterpartyArtifact: ExchangeArtifactView | null;
  receipt: ExchangeReceiptRecord | null;
  comparison: ExchangeComparisonRecord | null;
  derivatives: ExchangeDerivativeRecord[];
}

function toArtifactView(
  artifact: ExchangeArtifactRecord | null,
  frozen: boolean,
  signed: boolean,
  disclosed: boolean,
  lockedReason: string | null,
): ExchangeArtifactView | null {
  if (!artifact) return null;
  if (!disclosed) {
    return {
      id: artifact.id,
      title: artifact.title,
      artifactClass: artifact.artifactClass,
      version: artifact.version,
      contentHash: null,
      sourceReference: null,
      storageReference: null,
      repositoryCommit: null,
      mimeType: null,
      depositedAt: artifact.depositedAt,
      frozen,
      signed,
      locked: true,
      lockedReason,
      pendingPrincipalAttestation: artifact.pendingPrincipalAttestation,
    };
  }
  return {
    id: artifact.id,
    title: artifact.title,
    artifactClass: artifact.artifactClass,
    version: artifact.version,
    contentHash: artifact.contentHash,
    sourceReference: artifact.sourceReference,
    storageReference: artifact.storageReference,
    repositoryCommit: artifact.repositoryCommit,
    mimeType: artifact.mimeType,
    depositedAt: artifact.depositedAt,
    frozen,
    signed,
    locked: false,
    lockedReason: null,
    pendingPrincipalAttestation: artifact.pendingPrincipalAttestation,
  };
}

/**
 * Server-side gated projection — the ONLY function that decides whether the
 * counterparty's artifact content is visible to this viewer. Fails CLOSED:
 * a non-party gets `{ ok: false, error: 'not-a-party' }`, never a redacted
 * view of someone else's exchange.
 */
export async function getExchangeView(
  admin: SupabaseClient,
  input: { exchangeId: string; personaId: string },
): Promise<{ ok: true; view: ExchangeView } | { ok: false; error: string }> {
  const loaded = await loadExchange(admin, input.exchangeId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { exchange } = loaded;
  const viewerParty = resolveMembership(exchange, input.personaId);
  if (!viewerParty) return { ok: false, error: 'not-a-party' };
  const counterpartyParty: PartySlot = viewerParty === 'A' ? 'B' : 'A';

  const [yourArtifactRaw, counterpartyArtifactRaw] = await Promise.all([
    currentArtifact(admin, input.exchangeId, viewerParty),
    currentArtifact(admin, input.exchangeId, counterpartyParty),
  ]);

  const yourFreeze = yourArtifactRaw
    ? await currentAttestation(admin, input.exchangeId, viewerParty, 'freeze_declaration', yourArtifactRaw.version)
    : null;
  const yourSign = yourArtifactRaw
    ? await currentAttestation(admin, input.exchangeId, viewerParty, 'instrument_signature', yourArtifactRaw.version)
    : null;
  const cpFreeze = counterpartyArtifactRaw
    ? await currentAttestation(admin, input.exchangeId, counterpartyParty, 'freeze_declaration', counterpartyArtifactRaw.version)
    : null;
  const cpSign = counterpartyArtifactRaw
    ? await currentAttestation(admin, input.exchangeId, counterpartyParty, 'instrument_signature', counterpartyArtifactRaw.version)
    : null;

  const crossed = hasCrossed(exchange.status);
  const revoked = exchange.status === 'REVOKED_ACCESS_POST_EXCHANGE';

  let counterpartyDisclosed: boolean;
  if (revoked) {
    counterpartyDisclosed = false;
  } else if (exchange.disclosurePolicy === 'IMMEDIATE_ON_DEPOSIT') {
    counterpartyDisclosed = Boolean(counterpartyArtifactRaw);
  } else {
    // RECIPROCAL_AFTER_BOTH_DEPOSIT and MANIFEST_BEFORE_CONTENT both gate
    // full content on crossing — MANIFEST_BEFORE_CONTENT differs only in
    // that metadata (handled by toArtifactView always returning metadata
    // regardless of `disclosed`) is visible earlier; this service treats
    // "content" as gated identically for both until a future policy needs
    // to differ in the metadata-timing dimension, which IRL-AX-001 does not.
    counterpartyDisclosed = crossed;
  }

  const lockedReason = revoked
    ? 'Access to this artifact was revoked after exchange. The historical receipt remains on record.'
    : counterpartyDisclosed
      ? null
      : 'Locked until both parties have deposited, frozen and signed — reciprocal disclosure has not yet occurred.';

  const [receiptRow, comparisonRow] = await Promise.all([
    admin.from(T_RECEIPTS).select('*').eq('exchange_id', input.exchangeId).maybeSingle(),
    admin.from(T_COMPARISONS).select('*').eq('exchange_id', input.exchangeId).maybeSingle(),
  ]);
  const receipt = receiptRow.data ? rowToReceipt(receiptRow.data as Record<string, unknown>) : null;
  const comparison = comparisonRow.data ? rowToComparison(comparisonRow.data as Record<string, unknown>) : null;

  let derivatives: ExchangeDerivativeRecord[] = [];
  if (comparison) {
    const { data } = await admin.from(T_DERIVATIVES).select('*').eq('comparison_id', comparison.id).order('created_at', { ascending: true });
    derivatives = (data ?? []).map((r) => rowToDerivative(r as Record<string, unknown>));
  }

  const view: ExchangeView = {
    exchange: {
      ...exchange,
      initiatorRef: personaPublicRef(exchange.initiatorPersonaId),
      counterpartyRef: exchange.counterpartyPersonaId ? personaPublicRef(exchange.counterpartyPersonaId) : null,
    } as ExchangeView['exchange'],
    viewerParty,
    yourArtifact: toArtifactView(yourArtifactRaw, Boolean(yourFreeze), Boolean(yourSign), true, null),
    counterpartyArtifact: toArtifactView(
      counterpartyArtifactRaw,
      Boolean(cpFreeze),
      Boolean(cpSign),
      counterpartyDisclosed,
      lockedReason,
    ),
    receipt,
    comparison,
    derivatives,
  };
  // initiatorPersonaId/counterpartyPersonaId/inviteCodeHash are T0 — strip
  // them from the exchange projection even though `exchange` above still
  // carries them via the spread (TS shape says they're omitted; delete for
  // real at runtime so no T0 value leaks into a JSON response).
  delete (view.exchange as Record<string, unknown>).initiatorPersonaId;
  delete (view.exchange as Record<string, unknown>).counterpartyPersonaId;
  delete (view.exchange as Record<string, unknown>).inviteCodeHash;

  return { ok: true, view };
}

export async function listMyExchanges(
  admin: SupabaseClient,
  personaId: string,
): Promise<{ ok: true; exchanges: ReciprocalExchangeRecord[] } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from(T_EXCHANGES)
    .select('*')
    .or(`initiator_persona_id.eq.${personaId},counterparty_persona_id.eq.${personaId}`)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error.message };
  return { ok: true, exchanges: (data ?? []).map((r) => rowToExchange(r as Record<string, unknown>)) };
}

/**
 * Every exchange tagged to a given workspace/programme via `parentExperimentId`
 * (services/journey/boundaryResearchExchangeAdmission.ts's discovery key for
 * "the canonical exchange(s) for this Research Lab workspace") — oldest
 * first, so a caller picking "the" canonical one picks deterministically.
 * `parent_experiment_id` is a free-text field already used for
 * EXPERIMENT_REGISTRY ids elsewhere in this file; a research-workspace id
 * (e.g. 'ocsga-boundary-research') is the same kind of stable text key, not
 * a new column or a second tagging mechanism.
 */
export async function listExchangesByParentExperiment(
  admin: SupabaseClient,
  parentExperimentId: string,
): Promise<{ ok: true; exchanges: ReciprocalExchangeRecord[] } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from(T_EXCHANGES)
    .select('*')
    .eq('parent_experiment_id', parentExperimentId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_HINT : error.message };
  return { ok: true, exchanges: (data ?? []).map((r) => rowToExchange(r as Record<string, unknown>)) };
}
