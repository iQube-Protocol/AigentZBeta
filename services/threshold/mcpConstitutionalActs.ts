/**
 * mcpConstitutionalActs.ts — MCP-completable constitutional rituals for the
 * OCSGA / Boundary Research Journey Spine (operator directive, 2026-08-26,
 * "IMPLEMENT NOW").
 *
 * THE FOUR INVARIANTS THIS FILE ENFORCES (verbatim from the directive):
 *
 *   1. Surface independence — a Journey Spine stage is satisfied by
 *      AUTHORITATIVE EVIDENCE, not by which UI produced it. Any authorized
 *      surface may originate a constitutional act if it establishes
 *      principal + declaration + consent + authority + evidence/receipt.
 *   2. No forced navigation — a stage whose `completionChannels` includes
 *      'mcp' must be completable here, in full, without sending the
 *      principal to IRL OS.
 *   3. Channel does not reduce evidentiary burden — every function below
 *      calls the EXACT SAME canonical service (services/research/
 *      reciprocalExchange.ts, services/delegation/delegationGrantStore.ts)
 *      a native-UI API route calls. Nothing here re-implements or shortcuts
 *      that service's own checks (actorType==='principal', membership,
 *      exchange status, freeze-before-sign, etc.) — those remain the real
 *      enforcement, unchanged, regardless of origin channel.
 *   4. Conversation alone is not evidence — every write below REQUIRES
 *      `declarationConfirmed: true` on the call. Claude must have shown the
 *      exact declaration text and obtained explicit assent BEFORE calling;
 *      this module has no way to infer consent from prose, and refuses
 *      (fails closed) when the flag is absent or false.
 *
 * WHAT THIS FILE IS NOT: it is not a second identity system, not a second
 * authorization framework, and not a parallel evidence store. Every T0
 * identifier it touches is resolved through the SAME seam
 * services/threshold/constitutionalNavigator.ts already established
 * (ScopedSession.principalPublicRef -> resolvePersonaIdByPublicRef ->
 * personaId -> resolveOwnerAuthProfileId -> authProfileId), used ONLY
 * inside each function's own scope, and never returned to the caller.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScopedSession } from '@/services/threshold/gatewaySession';
import { resolvePersonaIdByPublicRef } from '@/services/identity/personaReferences';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import {
  depositArtifact,
  declareFreeze,
  signInstrument,
  confirmOperatorAssistedArtifact,
  getExchangeView,
  listMyExchanges,
  type DepositArtifactInput,
} from '@/services/research/reciprocalExchange';
import { persistDelegationGrant } from '@/services/delegation/delegationGrantStore';
import { FREEZE_DECLARATION_TEXT, EXCHANGE_INSTRUMENT_CLAUSES } from '@/types/reciprocalExchange';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { AgentRoleId, HandoffPayload, PolicyEnvelope } from '@/types/orchestration';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';

// ── Shared principal resolution — the SAME T0<->T2 seam constitutionalNavigator.ts uses ──

type PrincipalResolution = { ok: true; personaId: string } | { ok: false; error: string };

async function resolveMcpPrincipal(admin: SupabaseClient, session: ScopedSession): Promise<PrincipalResolution> {
  const personaId = await resolvePersonaIdByPublicRef(admin, session.principalPublicRef);
  if (!personaId) {
    return { ok: false, error: 'Could not resolve the session principal to a real persona. Nothing can be written until this resolves.' };
  }
  return { ok: true, personaId };
}

/** The one active OCSGA exchange this principal participates in — the SAME
 *  resolution services/journey/ianJourneyState.ts and constitutionalNavigator.ts
 *  already use. A client-supplied exchangeId is never trusted as authority;
 *  this always re-derives it server-side from real membership. */
async function resolveActiveExchangeId(admin: SupabaseClient, personaId: string): Promise<{ ok: true; exchangeId: string } | { ok: false; error: string }> {
  const mine = await listMyExchanges(admin, personaId);
  if (!mine.ok) return { ok: false, error: `Could not read this principal's Reciprocal Artifact Exchange membership: ${mine.error}` };
  if (mine.exchanges.length === 0) {
    return { ok: false, error: 'No Reciprocal Artifact Exchange exists for this principal yet — nothing to deposit into, freeze, or sign.' };
  }
  return { ok: true, exchangeId: mine.exchanges[0].id };
}

/** Stage eligibility gate (invariant 2/3): refuses BEFORE calling the
 *  canonical service if the journey definition itself does not declare
 *  this stage MCP-eligible. Reads types/journey.ts's `completionChannels`
 *  off the live journey definition — never a hand-copied allowlist that
 *  could drift from it. */
function requireMcpEligibleStage(stageId: string): { ok: true } | { ok: false; error: string } {
  const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === stageId);
  if (!stage) return { ok: false, error: `Unknown journey stage: ${stageId}` };
  if (!stage.completionChannels?.includes('mcp')) {
    return { ok: false, error: `Stage '${stageId}' (${stage.label}) has not been declared MCP-eligible. It can only be completed through its native surface.` };
  }
  return { ok: true };
}

/** Invariant 4, enforced structurally: no write function below will proceed
 *  without this literal flag on the call. There is no code path from
 *  conversational text to a write. */
function requireExplicitConsent(args: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  if (args.declarationConfirmed !== true) {
    return {
      ok: false,
      error:
        'declarationConfirmed must be explicitly true. Show your principal the exact declaration text for this act and obtain their explicit assent BEFORE calling this tool — never infer consent from the surrounding conversation.',
    };
  }
  return { ok: true };
}

// ── 1. Read: the exchange's current evidence state (no writes) ────────────

/**
 * Read-only. Also carries the CANONICAL declaration/instrument text
 * (services/research/reciprocalExchange.ts's FREEZE_DECLARATION_TEXT /
 * EXCHANGE_INSTRUMENT_CLAUSES — the exact same constants the native Exchange
 * workspace renders) on every response, so a calling agent always has the
 * REAL text on hand to present before calling declare_artifact_freeze or
 * sign_exchange_instrument — never a paraphrase, never invented, never
 * "assumed known" from training data. This is the explicit-consent
 * prerequisite made checkable: an agent that never called this tool has no
 * source for what it is about to ask the principal to confirm.
 */
export async function getExchangeStateForMcp(admin: SupabaseClient, session: ScopedSession) {
  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId);
  if (!active.ok) return active;
  const view = await getExchangeView(admin, { exchangeId: active.exchangeId, personaId: principal.personaId });
  if (!view.ok) return { ok: false as const, error: view.error };
  return {
    ok: true as const,
    exchangeId: active.exchangeId,
    view: view.view,
    freezeDeclarationText: FREEZE_DECLARATION_TEXT,
    exchangeInstrumentClauses: EXCHANGE_INSTRUMENT_CLAUSES,
  };
}

// ── 2. Section 3A — artifact submission (deposit) ──────────────────────────

export interface DepositArtifactMcpArgs {
  declarationConfirmed: boolean;
  title: string;
  artifactClass: string;
  description?: string;
  sourceType: DepositArtifactInput['sourceType'];
  sourceReference: string;
  contentHash: string;
  repositoryCommit?: string;
  storageReference?: string;
  mimeType?: string;
  ownershipDeclaration: string;
  rightsForExchange: string;
}

export async function depositExchangeArtifactViaMcp(admin: SupabaseClient, session: ScopedSession, args: DepositArtifactMcpArgs) {
  const eligible = requireMcpEligibleStage('create-deposit');
  if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>);
  if (!consent.ok) return consent;

  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId);
  if (!active.ok) return active;

  if (!args.title?.trim() || !args.artifactClass?.trim() || !args.sourceReference?.trim() || !args.contentHash?.trim()) {
    return { ok: false as const, error: 'title, artifactClass, sourceReference and contentHash are all required.' };
  }
  if (!args.ownershipDeclaration?.trim() || !args.rightsForExchange?.trim()) {
    return { ok: false as const, error: 'ownershipDeclaration and rightsForExchange are both required — the deposit is a constitutional declaration, not just a file upload.' };
  }

  const result = await depositArtifact(admin, {
    exchangeId: active.exchangeId,
    personaId: principal.personaId,
    title: args.title,
    artifactClass: args.artifactClass,
    description: args.description,
    sourceType: args.sourceType,
    sourceReference: args.sourceReference,
    contentHash: args.contentHash,
    repositoryCommit: args.repositoryCommit,
    storageReference: args.storageReference,
    mimeType: args.mimeType,
    ownershipDeclaration: args.ownershipDeclaration,
    rightsForExchange: args.rightsForExchange,
    originChannel: 'mcp',
    agentRef: session.agentAlias,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: active.exchangeId, artifact: result.artifact, replaced: result.replaced };
}

// ── 2b. Confirmation of an operator-assisted custodial registration ───────
//
// SCOPE BOUNDARY (read before touching): operator-assisted registration
// (services/research/reciprocalExchange.ts's registerArtifactOperatorAssisted)
// solves custody ONLY — an authorized operator entering an artifact for a
// principal who could not themselves reach a deposit surface. Confirmation
// is the principal's OWN constitutional act of adopting that custodial entry
// as their own attested evidence, and — exactly like every other function in
// this file — is never inferred, never performed by an operator, and never
// completed by this tool without `declarationConfirmed: true`. This function
// calls the UNMODIFIED confirmOperatorAssistedArtifact() directly; it adds
// no logic of its own beyond the same four gates every sibling function
// here applies (stage eligibility, explicit consent, T0<->T2 principal
// resolution, active-exchange resolution).

export interface ConfirmOperatorAssistedArtifactMcpArgs {
  declarationConfirmed: boolean;
}

export async function confirmOperatorAssistedArtifactViaMcp(
  admin: SupabaseClient,
  session: ScopedSession,
  args: ConfirmOperatorAssistedArtifactMcpArgs,
) {
  const eligible = requireMcpEligibleStage('create-deposit');
  if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>);
  if (!consent.ok) return consent;

  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId);
  if (!active.ok) return active;

  const result = await confirmOperatorAssistedArtifact(admin, {
    exchangeId: active.exchangeId,
    personaId: principal.personaId,
    agentRef: session.agentAlias,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: active.exchangeId, artifact: result.artifact };
}

// ── 3. Section 3C — deterministic fingerprint (pure, no writes, no I/O) ────

export function fingerprintExchangeArtifact(args: { content?: string; contentBase64?: string }): { ok: true; contentHash: string } | { ok: false; error: string } {
  if ((args.content && args.contentBase64) || (!args.content && !args.contentBase64)) {
    return { ok: false, error: 'Provide exactly one of content or contentBase64.' };
  }
  const buf = args.contentBase64 ? Buffer.from(args.contentBase64, 'base64') : Buffer.from(String(args.content), 'utf8');
  return { ok: true, contentHash: createHash('sha256').update(buf).digest('hex') };
}

// ── 4. Sections 3B + 3D — freeze declaration AND attestation ──────────────
//
// The journey directive treats "declare the freeze" (B) and "write the
// freeze attestation" (D) as two conceptually distinct sub-steps. This
// codebase has exactly ONE canonical function for both —
// reciprocalExchange.ts's `declareFreeze` — which writes the single
// `freeze_declaration` attestation row that both sub-steps describe. There
// is no second, lower-level "declaration only" primitive to call
// separately; adding one would be a duplicate implementation of the same
// capability under a new name (inv.engineering.037), not a genuine second
// act. This function IS both B and D. See the closeout report.

export interface DeclareArtifactFreezeMcpArgs {
  declarationConfirmed: boolean;
}

export async function declareArtifactFreezeViaMcp(admin: SupabaseClient, session: ScopedSession, args: DeclareArtifactFreezeMcpArgs) {
  const eligible = requireMcpEligibleStage('freeze-attestation');
  if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>);
  if (!consent.ok) return consent;

  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId);
  if (!active.ok) return active;

  const result = await declareFreeze(admin, {
    exchangeId: active.exchangeId,
    personaId: principal.personaId,
    actorType: 'principal',
    originChannel: 'mcp',
    agentRef: session.agentAlias,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: active.exchangeId, attestation: result.attestation };
}

// ── 5. Section 3E — exchange instrument signing ───────────────────────────
//
// Equivalence, made explicit and testable (invariant 3): this writes to the
// exact same exchange_attestations table, via the exact same signInstrument
// service function, that native UI signing writes to — the ONLY difference
// is `originChannel: 'mcp'` on the row. This is NOT represented as, and
// never claims to be, a browser wallet signature — it is an authenticated-
// principal attestation, honestly labelled. `recomputeExchangeState` (called
// internally by `signInstrument`) treats a current attestation of this act
// type as sufficient regardless of origin_channel, so a native signature on
// one party's side and an MCP attestation on the other's both satisfy the
// same READY_TO_SIGN -> EXCHANGED transition.

export interface SignExchangeInstrumentMcpArgs {
  declarationConfirmed: boolean;
}

export async function signExchangeInstrumentViaMcp(admin: SupabaseClient, session: ScopedSession, args: SignExchangeInstrumentMcpArgs) {
  const eligible = requireMcpEligibleStage('exchange-ready');
  if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>);
  if (!consent.ok) return consent;

  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId);
  if (!active.ok) return active;

  const result = await signInstrument(admin, {
    exchangeId: active.exchangeId,
    personaId: principal.personaId,
    actorType: 'principal',
    originChannel: 'mcp',
    agentRef: session.agentAlias,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return {
    ok: true as const,
    exchangeId: active.exchangeId,
    attestation: result.attestation,
    exchangeStatus: result.exchange.status,
    originChannelNote:
      "This is an authenticated-principal MCP attestation, not a wallet signature — it satisfies the Exchange Instrument stage on the same terms a native browser signature would, labelled honestly as origin_channel='mcp'.",
  };
}

// ── 6. Section 5 — bounded delegation, established directly through MCP ───
//
// Reuses the SAME durable primitive the native Delegate ceremony writes to
// (services/delegation/delegationGrantStore.ts's persistDelegationGrant) —
// the same ledger services/journey/ianJourneyState.ts's `hasActiveDelegation`
// read already resolves the delegation-establish stage from. Deliberately
// NOT the full multi-agent/trust-band ceremony in
// app/api/codex/chat/agentiq-os/delegation/route.ts (reputation gates,
// delegate-standing ceilings, batch grants) — that route is untouched and
// remains the canonical path for anything beyond this pilot's bound. Per
// the operator's own scope discipline for this pilot ("this is a low-risk
// research exchange... sufficient"), this always grants at the safe floor:
// L1_EXPERIMENTAL, knowledge-retrieval-class actions only, scoped to the IRL
// research surface, capped TTL. A principal who wants a broader grant still
// uses the native Delegate ceremony — this tool only ever offers the floor.

const MCP_DELEGATION_TRUST_BAND = 'L1_EXPERIMENTAL';
const MCP_DELEGATION_ALLOWED_ACTIONS = ['knowledge_retrieval'];
const MCP_DELEGATION_ALLOWED_SURFACES = ['irl-cartridge'];
const MCP_DELEGATION_FORBIDDEN_ACTIONS = [
  'write_to_aigency_pack',
  'access_supabase_service_role',
  'push_to_registry_live',
  'read_wallet_credentials',
  'modify_other_persona',
  'read_sovereign_iqube',
];
const MCP_DELEGATION_TTL_HOURS = 8;
const MCP_DELEGATION_MAX_ACTIONS = 20;

export interface EstablishDelegationMcpArgs {
  declarationConfirmed: boolean;
  agentRootDid: string;
  purpose: string;
}

export async function establishDelegationViaMcp(admin: SupabaseClient, session: ScopedSession, args: EstablishDelegationMcpArgs) {
  const eligible = requireMcpEligibleStage('delegation-establish');
  if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>);
  if (!consent.ok) return consent;
  if (!args.agentRootDid?.trim()) return { ok: false as const, error: 'agentRootDid is required.' };
  if (!args.purpose?.trim()) return { ok: false as const, error: 'purpose is required — the delegation must name why authority is being delegated.' };

  const principal = await resolveMcpPrincipal(admin, session);
  if (!principal.ok) return principal;

  const agentRootDid = args.agentRootDid.trim();
  const expiresAt = new Date(Date.now() + MCP_DELEGATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const handoffId = `handoff_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const envelope: PolicyEnvelope = {
    tenant_id: 'default',
    persona_id: principal.personaId,
    allowed_surfaces: MCP_DELEGATION_ALLOWED_SURFACES,
    forbidden_actions: MCP_DELEGATION_FORBIDDEN_ACTIONS,
    disclosure_class: 'tenant',
    requires_guardian_approval: false,
    cartridge_scope: MCP_DELEGATION_ALLOWED_SURFACES[0],
  };
  const handoff: HandoffPayload = {
    handoff_id: handoffId,
    from_agent: 'aigent-z',
    // HandoffPayload.to_agent is typed AgentRoleId (a closed role set), but
    // the delegation ceremony consistently uses this field to carry the
    // actual delegated agent's DID — same pattern + same scope note as
    // app/api/codex/chat/agentiq-os/delegation/route.ts's own handoff build.
    to_agent: agentRootDid as AgentRoleId,
    reason: `Bounded delegation granted via Threshold MCP for OCSGA Boundary Research. Purpose: ${args.purpose}. Trust band: ${MCP_DELEGATION_TRUST_BAND}.`,
    user_context_summary: `Persona ${principal.personaId} granted MCP-originated delegation to ${agentRootDid}. Allowed: ${MCP_DELEGATION_ALLOWED_ACTIONS.join(', ')}. Expires: ${expiresAt}.`,
    journey_state_summary: {
      persona_id: principal.personaId,
      journey_stage: 'acolyte',
      experience_depth: 'codex',
      active_cartridge: 'irl-cartridge',
      active_codex: 'irl-cartridge',
      blocked_reasons: [],
      next_likely_step: null,
      session_id: handoffId,
    },
    policy_envelope: envelope,
    open_tasks: MCP_DELEGATION_ALLOWED_ACTIONS,
    return_conditions: ['task_complete', 'session_end', 'policy_escalation', 'user_exit'],
    timestamp: new Date().toISOString(),
  };

  await persistDelegationGrant({
    grantId: handoffId,
    personaId: principal.personaId,
    agentRootDid,
    tenantId: 'default',
    trustBand: MCP_DELEGATION_TRUST_BAND,
    allowedActions: MCP_DELEGATION_ALLOWED_ACTIONS,
    allowedSurfaces: MCP_DELEGATION_ALLOWED_SURFACES,
    forbiddenActions: MCP_DELEGATION_FORBIDDEN_ACTIONS,
    disclosureClass: 'tenant',
    maxActions: MCP_DELEGATION_MAX_ACTIONS,
    spendAutonomy: 'low',
    showReceipts: true,
    curatedSkillsOnly: true,
    explainBeforeActing: true,
    handoff,
    expiresAt,
  });

  await emitOrchestrationEvent({
    event_id: `delg_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    event_type: 'z_delegated',
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: `MCP-originated bounded delegation: ${args.purpose}`,
    journey_stage: 'acolyte',
    active_cartridge: 'irl-cartridge',
    active_codex: 'irl-cartridge',
    receipt_eligible: true,
    metadata: {
      persona_id: principal.personaId,
      agent_root_did: agentRootDid,
      trust_band: MCP_DELEGATION_TRUST_BAND,
      allowed_actions: MCP_DELEGATION_ALLOWED_ACTIONS,
      expires_at: expiresAt,
      origin_channel: 'mcp',
    },
  });

  const receipt = await createActivityReceipt({
    personaId: principal.personaId,
    activeCartridge: 'irl-cartridge',
    actionType: 'agent_delegated',
    summary: `Bounded delegation granted via Threshold MCP to ${agentRootDid} for OCSGA Boundary Research (trust band: ${MCP_DELEGATION_TRUST_BAND}, purpose: ${args.purpose})`,
    agentsInvoked: [agentRootDid],
    contextShared: ['agent_root_did', 'trust_band', 'purpose'],
  }).catch(() => null);

  return {
    ok: true as const,
    grantId: handoffId,
    agentRootDid,
    trustBand: MCP_DELEGATION_TRUST_BAND,
    allowedActions: MCP_DELEGATION_ALLOWED_ACTIONS,
    expiresAt,
    receiptId: receipt?.id ?? null,
    note: 'This is the safe-floor bound (L1_EXPERIMENTAL, knowledge_retrieval only). For a broader grant, use the native Delegate surface in IRL OS.',
  };
}
