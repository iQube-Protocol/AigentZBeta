/**
 * Use Case Zero — provider-neutral constitutional financial-agent
 * establishment readiness projection (2026-09-06, corrected same day
 * following operator review — see the correction notes on each leg below).
 *
 * ONE canonical, READ-ONLY projection both entry paths ("Bring my own
 * agent" and "Create and establish an agent") converge on. Composes
 * EXISTING canonical services only — never a second Journey state machine,
 * service catalog, provider binding, wallet model, approval system or
 * receipt system. Every leg below names the exact service it reads and
 * reports an explicit `state` (never a lossy boolean) honestly; this
 * function never infers completion from prose or from Factor's own case
 * status alone, and never writes anything.
 *
 * ── Leg state model (correction 3) ─────────────────────────────────────
 * `verified: boolean` collapsed four genuinely different situations into
 * one bit: a fact that genuinely does not exist yet, a fact a real
 * DECISION has blocked (a refusal, a not-admissible ruling), a fact whose
 * canonical read itself FAILED (network/DB error — tells us nothing about
 * the fact), and a fact that only holds in simulated/test-transport mode.
 * `ReadinessLegState` makes these four distinct outcomes explicit:
 *   - 'established' — the canonical read succeeded and the fact holds.
 *   - 'missing'      — the canonical read succeeded; the fact does not
 *                       hold yet, but no decision blocks it — the next
 *                       action can establish it.
 *   - 'blocked'       — the canonical read succeeded; a real decision
 *                       (a refusal, an `insufficient_evidence`/
 *                       `not_admissible` Aegis ruling, a denied Passport
 *                       application) prevents establishing this fact
 *                       without first resolving that decision.
 *   - 'unreadable'    — the canonical read itself failed. This MUST NEVER
 *                       be reported as 'missing' (a failed read is not
 *                       evidence of absence) and the projection's `nextAction`
 *                       computation MUST NEVER recommend provisioning
 *                       something we simply failed to read.
 * `mode` ('simulated'|'live'|'n/a') is an orthogonal fact about HOW an
 * established/blocked leg was proven — never folded into `state` itself.
 * `verified: boolean` is kept only as a backward-compatible derived field
 * (`state === 'established'`) for any consumer not yet migrated to `state`.
 *
 * Composed sources (reuse, not duplication):
 *   - operator/aigentMe context   -> services/identity/getActivePersona.ts
 *   - agent shell / registrable   -> services/horizen/registrableAgents.ts
 *   - owner/control wallet        -> services/wallet/agentPurposeWalletService.ts
 *   - settlement/x402 wallet      -> services/wallet/agentPurposeWalletService.ts
 *   - Passport state              -> services/passport/passportStatusRead.ts
 *     (BOTH getPassportApplicationStatus AND getPassportRecordStatus —
 *     correction 1: an approved APPLICATION is not an issued PASSPORT;
 *     these are two different tables, per
 *     supabase/migrations/20260610000000_polity_passport_bureau.sql's own
 *     "Application-phase status (distinct from passport-phase status on
 *     records)" comment.)
 *   - delegation/authority chain  -> services/delegation/delegationGrantStore.ts
 *   - iQube Registry asset        -> services/registry/persistence.ts
 *   - Horizen/ERC-8004 registration -> services/horizen/agentRegistrationBinding.ts
 *   - Pulse/P&L status            -> services/horizen/pnlEvidenceRead.ts
 *   - Aegis assessment            -> services/aegis/aegisAssessmentService.ts
 *     (correction 2: `state === 'ratified'` alone is not positive —
 *     readiness requires `decision` to be `admissible` or
 *     `admissible_with_conditions`; `insufficient_evidence`/
 *     `not_admissible` are blockers; conditions are surfaced, never
 *     dropped.)
 *   - MoneyPenny admission        -> services/factor/factorCaseService.ts (case.state)
 *     + services/moneypenny/admissionAuthority.ts's own event trail for
 *     conditions (correction 5: `conditionally_admitted` is preserved as
 *     admitted-with-conditions, not collapsed into "not admitted";
 *     activation is blocked while a condition remains unmet).
 *   - Bankr/provider binding      -> services/financialServices/providers/bankr/bankrProviderAdapter.ts
 *     (getStatus()/getCapabilities() — correction 4: configured/live-vs-fake
 *     mode is DERIVED from the adapter, never hardcoded from binding
 *     presence) + services/financialServices/providers/providerWalletBinding.ts
 *     (binding-active, a separate fact from provider-configured and from
 *     operation-supported).
 *   - Vela confidential-compute   -> services/factor/factorConfidentialWorkload.ts (evidence items)
 *   - runtime activation          -> services/factor/factorCaseService.ts (case.state === 'active')
 *   - governed-operation rehearsal -> services/factor/tokenLaunchService.ts (capability boundary) —
 *     the only governed financial-request domain object that exists today
 *     (Bankr has no ordinary-transaction capability; see boundary note).
 *
 * Server-side only. Never persist confidential inputs. Never approve
 * anything itself — this is a read, not a decision. Authority/tenant/
 * delegation enforcement for CONSEQUENTIAL actions happens in the
 * orchestration handlers that ACT on a leg (Phase 2), never here — this
 * file only reads and reports.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { findAgentRootIdentityBySlug } from '@/services/agents/sponsorPolityAgent';
import { resolveDiDQube } from '@/services/identity/didQubeResolver';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';
import { getPassportApplicationStatus, getPassportRecordStatus } from '@/services/passport/passportStatusRead';
import { readActiveGrantForAgent } from '@/services/delegation/delegationGrantStore';
import { getAsset } from '@/services/registry/persistence';
import { resolvePnlEvidenceForAgent } from '@/services/horizen/pnlEvidenceRead';
import { getCurrentAssessment } from '@/services/aegis/aegisAssessmentService';
import { getCase, listEvidenceForCase, listCaseEvents, type FactorCaseRow } from '@/services/factor/factorCaseService';
import { assessIssuerReadiness } from '@/services/factor/bankrCapabilityHandlers';
import { findLatestTokenLaunchForCase } from '@/services/factor/tokenLaunchService';
import { discoverFinancialServicesForConsumer } from '@/services/financialServices/discovery';
import { FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND } from '@/services/factor/factorConfidentialWorkload';

export type UseCaseZeroPath = 'bring_own_agent' | 'create_and_establish';

export type ReadinessLegMode = 'simulated' | 'live' | 'n/a';

/** See the file-level doc comment's "Leg state model" section.
 *  'awaiting_external_action' (item 5, 2026-09-06 correction): a REQUIRED
 *  fact this codebase has no Factor-owned handler to advance — it resolves
 *  only as a side effect of a process outside Factor's control (registry
 *  ingestion, the Horizen registration ceremony). Distinct from 'missing'
 *  (which implies the next operator/orchestrator action CAN establish it)
 *  and from 'blocked' (which implies a ratified refusal) — this state is
 *  honest about there being no actor-to-act-on within this system at all. */
export type ReadinessLegState = 'established' | 'missing' | 'blocked' | 'unreadable' | 'awaiting_external_action';

export interface ReadinessLeg {
  /** Stable key, also the handler/action this leg's own next step maps to. */
  key: string;
  label: string;
  state: ReadinessLegState;
  mode: ReadinessLegMode;
  reason: string;
  evidenceRefs: string[];
  /** Which real service produced this leg — for provenance, never fabricated. */
  source: string;
  /**
   * Whether this leg gates overall Use Case Zero completion (correction
   * 2026-09-06, operator review: "Registry/Horizen/Pulse need explicit
   * required-versus-optional semantics"). `true` (the default) for every
   * leg that is a genuine prerequisite in the sequence. `false` only for
   * registryAsset/horizenRegistration/pulsePnl — real facts this codebase
   * observes but has no Factor-owned mutation for (they resolve as side
   * effects of OTHER processes: registry ingestion, the Horizen
   * registration ceremony, Pulse/P&L onboarding). An optional leg still
   * reports its true state honestly; it is simply never counted toward
   * `completedSteps`'s denominator for "is Use Case Zero done", and never
   * blocks the orchestrator or `nextAction` from progressing past it.
   */
  required: boolean;
  /** Conditions attached to an 'established'/'blocked' outcome that is
   *  conditional (Aegis `admissible_with_conditions`, MoneyPenny
   *  `conditionally_admitted`) — never silently dropped. Empty when the
   *  outcome carries no conditions. */
  conditions: string[];
  /** @deprecated derived as `state === 'established'` — for callers not yet
   *  migrated to `state`. Never the field new code branches on. */
  verified: boolean;
}

export interface UseCaseZeroReadinessInput {
  admin: SupabaseClient;
  tenantId: string;
  /** The accountable human/operator persona — T0, server-only, never returned in the clear. */
  actorPersonaId: string;
  agentSlug: string;
  path: UseCaseZeroPath;
  /** An existing Factor case, if the operator already has one. Absent means
   *  "no case yet" — case-dependent legs report accordingly; this function
   *  NEVER creates one itself (read-only). */
  caseId?: string;
  /** Item 5: an explicit operator-selected journey profile. Only
   *  'financial_intelligence' makes the Pulse/P&L leg required; any other
   *  value (including absent/undefined, the default) leaves it optional —
   *  never inferred, never defaulted to "on". */
  journeyProfile?: 'standard' | 'financial_intelligence';
}

export interface UseCaseZeroReadiness {
  path: UseCaseZeroPath;
  agentSlug: string;
  legs: ReadinessLeg[];
  completedSteps: string[];
  /** True once every REQUIRED leg is established — optional legs
   *  (registryAsset/horizenRegistration/pulsePnl) never block this. Use
   *  this, never `presentlyActionableStep === null` alone, to answer "is
   *  Use Case Zero done" — the latter can also be null while optional legs
   *  remain outstanding, which is a DIFFERENT, non-blocking state. */
  requiredStepsComplete: boolean;
  presentlyActionableStep: string | null;
  blockers: string[];
  /** The exact next action the operator can take — a handlerId from
   *  services/factor/factorActionHandlerRegistry.ts, never a bare label.
   *  Null once every leg is established, or when the presently-actionable
   *  leg is 'unreadable' (a read failure recommends nothing — see the
   *  state-model doc comment). */
  nextAction: { handlerId: string; label: string } | null;
  requiresApproval: boolean;
  requiredAuthority: string[];
}

function leg(
  partial: Omit<ReadinessLeg, 'evidenceRefs' | 'conditions' | 'verified' | 'required'> & {
    evidenceRefs?: string[];
    conditions?: string[];
    required?: boolean;
  },
): ReadinessLeg {
  return {
    evidenceRefs: [],
    conditions: [],
    required: true,
    ...partial,
    verified: partial.state === 'established',
  };
}

async function resolveOperatorContextLeg(input: UseCaseZeroReadinessInput): Promise<ReadinessLeg> {
  // The caller already resolved actorPersonaId via getActivePersona(request)
  // before invoking this projection — re-resolving it here would require a
  // request object this server-side composer does not have. This leg
  // verifies only that a persona id was actually bound, never that a
  // session exists (that is the caller's own auth boundary).
  return leg({
    key: 'operatorContext',
    label: 'Operator persona bound',
    state: input.actorPersonaId ? 'established' : 'missing',
    mode: 'live',
    reason: input.actorPersonaId
      ? 'An accountable operator persona is bound to this consultation.'
      : 'No operator persona is bound — this projection requires an authenticated caller.',
    source: 'services/identity/getActivePersona.ts (caller-resolved)',
  });
}

/**
 * Item (2026-09-06, RootDID minting primitive): agentShell now recognises
 * TWO distinct facts, never conflated —
 *   1. Is this slug a Horizen-registrable runtime agent (REGISTRABLE_AGENTS)?
 *      That allowlist is a real, deliberate code-level boundary (agent_keys
 *      custody wallet, health route, Agent Card route) — still not
 *      dynamically provisionable, and downstream legs that need a
 *      `runtimeAgentId` (wallets, Horizen registration, Pulse/P&L, Bankr)
 *      still report accordingly when it is absent.
 *   2. Does this slug have a minted RootDID at all
 *      (`agent_root_identity`, via the EXISTING `sponsorPolityAgent`
 *      primitive — `did:agent:root:<slug>`, no cost, no blockchain
 *      broadcast)? A citizen sponsoring a NEW agent's genesis (the
 *      'create_and_establish' path) satisfies THIS fact without needing to
 *      be Horizen-registrable — that is a separate, later readiness
 *      concern, not a precondition of having a constitutional identity at
 *      all. Re-use law: this reuses `sponsorPolityAgent` unchanged; it does
 *      not mint a second, disagreeing RootDID scheme.
 *
 * `sponsorPassportEstablished` reflects the OPERATOR's OWN passport leg,
 * resolved by the caller before this one so genesis is never attempted (or
 * offered as the presently-actionable step) before the sponsoring citizen
 * Passport actually exists — matching the operator's own stated sequence:
 * "creates a passport and then sponsors an agent."
 */
async function resolveAgentShellLeg(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig | null,
  agentSlug: string,
  path: UseCaseZeroPath,
  sponsorPassportEstablished: boolean,
): Promise<ReadinessLeg> {
  if (agent) {
    return leg({
      key: 'agentShell',
      label: 'Agent shell (registrable identity)',
      state: 'established',
      mode: 'live',
      reason: `'${agentSlug}' is a registered runtime agent (runtimeAgentId '${agent.runtimeAgentId}').`,
      source: 'services/horizen/registrableAgents.ts',
      evidenceRefs: [agent.runtimeAgentId],
    });
  }

  const rootIdentity = await findAgentRootIdentityBySlug(admin, agentSlug);
  if (rootIdentity) {
    return leg({
      key: 'agentShell',
      label: 'Agent shell (registrable identity)',
      state: 'established',
      mode: 'live',
      reason:
        `'${agentSlug}' has a minted RootDID (${rootIdentity.didUri}, via the existing sponsorPolityAgent ` +
        `primitive) — not yet a Horizen-registrable runtime agent (REGISTRABLE_AGENTS allowlist); later ` +
        `legs that need a runtime agent id (wallets, Horizen registration, Bankr binding) report that ` +
        `separately and honestly, rather than this leg papering over it.`,
      source: 'services/agents/sponsorPolityAgent.ts (agent_root_identity)',
      evidenceRefs: [rootIdentity.didUri],
    });
  }

  if (path === 'create_and_establish') {
    if (!sponsorPassportEstablished) {
      return leg({
        key: 'agentShell',
        label: 'Agent shell (registrable identity)',
        state: 'awaiting_external_action',
        mode: 'n/a',
        reason:
          `'${agentSlug}' has no RootDID yet, and sponsoring a NEW agent's genesis requires the operator's ` +
          `own citizen Passport to already be issued (sponsorPolityAgent's own ownership check). File or ` +
          `resume the Passport application first.`,
        source: 'services/agents/sponsorPolityAgent.ts',
      });
    }
    return leg({
      key: 'agentShell',
      label: 'Agent shell (registrable identity)',
      state: 'missing',
      mode: 'n/a',
      reason:
        `'${agentSlug}' has no RootDID yet. Sponsor its genesis (mints did:agent:root:${agentSlug} via the ` +
        `existing sponsorPolityAgent primitive — no cost, no blockchain broadcast) to establish the ` +
        `constitutional agent shell.`,
      source: 'services/agents/sponsorPolityAgent.ts',
    });
  }

  // 'bring_own_agent': neither a REGISTRABLE_AGENTS entry nor an
  // agent_root_identity row exists under this slug — there is genuinely no
  // existing agent to bring. Structural boundary, not a step-away-from-
  // established fact: 'blocked', not 'missing'.
  return leg({
    key: 'agentShell',
    label: 'Agent shell (registrable identity)',
    state: 'blocked',
    mode: 'n/a',
    reason:
      `'${agentSlug}' is neither a REGISTRABLE_AGENTS runtime agent nor a sponsored RootDID ` +
      `(agent_root_identity) — there is no existing agent under this slug to bring. Choose ` +
      `"Create and establish an agent" to sponsor its genesis instead.`,
    source: 'services/horizen/registrableAgents.ts',
  });
}

/**
 * DiDQube Phase 4 item 1 (2026-09-07, execution plan): a distinct, REQUIRED
 * leg from `agentShell` itself — `agentShell` establishes the anchor
 * (`agent_root_identity`); this leg establishes that the anchor is bound
 * into its DiDQube constitutional container (Phase 1 supertype tables), via
 * the canonical, READ-ONLY `resolveDiDQube` resolver — never a second,
 * parallel identity walk. Classification: prepare-gating — a candidate whose
 * container is not yet bound may still be explored via this read-only
 * projection (every leg is always computed and reported, regardless of
 * order), but the orchestrator's own strict first-outstanding-required
 * sequencing refuses to progress PAST this leg into Aegis/Passport/wallet
 * provisioning until it resolves.
 *
 * Scoped ONLY to the `agent_root_identity`-anchored path (the same
 * `findAgentRootIdentityBySlug` lookup `agentShell`'s own 'missing RootDID'
 * branch already performs) — a REGISTRABLE_AGENTS platform runtime agent
 * (Aegis, MoneyPenny, Factor itself, etc.) is a separate identity model this
 * leg does not yet cover; reported honestly as not-yet-in-scope (optional,
 * never blocking) rather than guessed at.
 */
async function resolveDidqubeContainerLeg(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig | null,
  agentSlug: string,
): Promise<ReadinessLeg> {
  if (agent) {
    return leg({
      key: 'didqubeContainer',
      label: 'DiDQube constitutional container',
      state: 'established',
      required: false,
      mode: 'n/a',
      reason:
        `'${agentSlug}' is a REGISTRABLE_AGENTS platform runtime agent — DiDQube container binding ` +
        `for this identity class is not yet in scope; reported as satisfied so it never blocks this path.`,
      source: 'services/horizen/registrableAgents.ts',
    });
  }

  const rootIdentity = await findAgentRootIdentityBySlug(admin, agentSlug);
  if (!rootIdentity) {
    return leg({
      key: 'didqubeContainer',
      label: 'DiDQube constitutional container',
      state: 'missing',
      mode: 'n/a',
      reason: 'No agent RootDID exists yet to bind a DiDQube container to — resolve the agent shell first.',
      source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
    });
  }

  try {
    const resolution = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: rootIdentity.agentRootId });
    if (resolution.state === 'resolved') {
      return leg({
        key: 'didqubeContainer',
        label: 'DiDQube constitutional container',
        state: 'established',
        mode: 'live',
        reason: `DiDQube ${resolution.primitive.didqubeId} resolved (public commitment ${resolution.primitive.publicCommitment.commitmentVersion}:${resolution.primitive.publicCommitment.value}).`,
        source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
        evidenceRefs: [resolution.primitive.didqubeId],
      });
    }
    if (resolution.state === 'conflicted') {
      return leg({
        key: 'didqubeContainer',
        label: 'DiDQube constitutional container',
        state: 'blocked',
        mode: 'n/a',
        reason: `DiDQube resolution reports a data conflict: ${resolution.detail} — this requires operator/data reconciliation, not automatic binding.`,
        source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
      });
    }
    if (resolution.state === 'ambiguous') {
      return leg({
        key: 'didqubeContainer',
        label: 'DiDQube constitutional container',
        state: 'blocked',
        mode: 'n/a',
        reason: `DiDQube resolution reports ${resolution.candidateCount} ambiguous candidate bindings for this anchor — requires reconciliation, not automatic binding.`,
        source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
      });
    }
    if (resolution.state === 'unsupported_subject_class') {
      return leg({
        key: 'didqubeContainer',
        label: 'DiDQube constitutional container',
        state: 'blocked',
        mode: 'n/a',
        reason: `DiDQube resolution reports an unsupported subject class (${resolution.subjectClass}) — this leg does not apply.`,
        source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
      });
    }
    // 'unresolved' — the real, expected pre-binding state for an
    // agent_root_identity row that predates this leg's own wiring, or that
    // was minted through a path that hasn't yet called
    // ensureAgentDiDQubeBinding. Not a defect — the orchestrator's own
    // handler for this leg is exactly what resolves it.
    return leg({
      key: 'didqubeContainer',
      label: 'DiDQube constitutional container',
      state: 'missing',
      mode: 'n/a',
      reason: `DiDQube container not yet bound for this agent (resolver reason: ${resolution.reason}) — bind it to progress.`,
      source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
      evidenceRefs: [rootIdentity.didUri],
    });
  } catch (e) {
    return leg({
      key: 'didqubeContainer',
      label: 'DiDQube constitutional container',
      state: 'unreadable',
      mode: 'n/a',
      reason: `DiDQube resolution read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/identity/didQubeResolver.ts::resolveDiDQube',
    });
  }
}

async function resolveWalletLegs(runtimeAgentId: string): Promise<[ReadinessLeg, ReadinessLeg]> {
  const wallets = new AgentPurposeWalletService();
  let ownerAddress: string | null = null;
  let ownerErr: string | null = null;
  try {
    ownerAddress = await wallets.getOwnerWalletAddress(runtimeAgentId);
  } catch (e) {
    ownerErr = e instanceof Error ? e.message : String(e);
  }
  const ownerLeg = leg({
    key: 'ownerWallet',
    label: 'Owner/control wallet',
    state: ownerErr ? 'unreadable' : ownerAddress ? 'established' : 'missing',
    mode: ownerAddress ? 'live' : 'n/a',
    reason: ownerErr
      ? `Owner-wallet read failed: ${ownerErr}`
      : ownerAddress
        ? `Owner wallet provisioned (${ownerAddress}).`
        : 'No owner wallet provisioned yet for this agent.',
    source: 'services/wallet/agentPurposeWalletService.ts::getOwnerWalletAddress',
    evidenceRefs: ownerAddress ? [ownerAddress] : [],
  });

  let settlementBinding: Awaited<ReturnType<AgentPurposeWalletService['getBinding']>> = null;
  let settlementErr: string | null = null;
  try {
    settlementBinding = await wallets.getBinding(runtimeAgentId, 'settlement');
  } catch (e) {
    settlementErr = e instanceof Error ? e.message : String(e);
  }
  const settlementEstablished = Boolean(settlementBinding && settlementBinding.status === 'active');
  const settlementLeg = leg({
    key: 'settlementWallet',
    label: 'Settlement/x402 wallet',
    state: settlementErr ? 'unreadable' : settlementEstablished ? 'established' : 'missing',
    mode: settlementBinding ? 'live' : 'n/a',
    reason: settlementErr
      ? `Settlement-wallet read failed: ${settlementErr}`
      : settlementBinding
        ? `Settlement wallet bound (${settlementBinding.address}, status ${settlementBinding.status}).`
        : 'No settlement/x402 wallet bound yet for this agent.',
    source: 'services/wallet/agentPurposeWalletService.ts::getBinding',
    evidenceRefs: settlementBinding ? [settlementBinding.address] : [],
  });

  return [ownerLeg, settlementLeg];
}

/** Passport statuses that reflect a real, in-progress path toward issuance
 *  — never blocked, never established, just not there yet. */
const PASSPORT_APPLICATION_IN_PROGRESS = new Set(['draft', 'submitted', 'pending_approval', 'needs_more_information']);

async function resolvePassportLeg(admin: SupabaseClient, personaId: string): Promise<ReadinessLeg> {
  // Correction 1: an approved APPLICATION is never treated as an issued
  // PASSPORT — these are two different tables. Only a polity_passport_records
  // row (issued_at set) satisfies this leg.
  try {
    const [records, applications] = await Promise.all([
      getPassportRecordStatus(admin, personaId, 5),
      getPassportApplicationStatus(admin, personaId, 5),
    ]);
    const issuedRecord = records[0] ?? null;
    if (issuedRecord) {
      const status = issuedRecord.citizenStatus ?? issuedRecord.participantStatus ?? 'unknown';
      return leg({
        key: 'passport',
        label: 'Passport state',
        state: 'established',
        mode: 'live',
        reason: `Passport issued (${issuedRecord.passportClass}, status: ${status}, issued ${issuedRecord.issuedAt}).`,
        source: 'services/passport/passportStatusRead.ts::getPassportRecordStatus',
        evidenceRefs: [issuedRecord.passportId],
      });
    }

    const latestApp = applications[0] ?? null;
    if (!latestApp) {
      return leg({
        key: 'passport',
        label: 'Passport state',
        state: 'missing',
        mode: 'n/a',
        reason: 'No Passport application filed yet for this operator (not_applied).',
        source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
      });
    }
    if (latestApp.applicationStatus === 'denied') {
      return leg({
        key: 'passport',
        label: 'Passport state',
        state: 'blocked',
        mode: 'live',
        reason: `Passport application ${latestApp.applicationId} was denied — a new application or steward reversal is required, not automatic provisioning.`,
        source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
        evidenceRefs: [latestApp.applicationId],
      });
    }
    if (latestApp.applicationStatus === 'withdrawn') {
      return leg({
        key: 'passport',
        label: 'Passport state',
        state: 'missing',
        mode: 'live',
        reason: `Previous application ${latestApp.applicationId} was withdrawn — a new application can be filed.`,
        source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
        evidenceRefs: [latestApp.applicationId],
      });
    }
    if (latestApp.applicationStatus === 'approved') {
      // The intake DECISION is approved but no polity_passport_records row
      // exists yet — this is the exact "approved != issued" gap the
      // correction names. Still 'missing', never 'established'.
      return leg({
        key: 'passport',
        label: 'Passport state',
        state: 'missing',
        mode: 'live',
        reason: `Application ${latestApp.applicationId} is approved, but no passport has been ISSUED yet (no polity_passport_records row) — approved is not issued.`,
        source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
        evidenceRefs: [latestApp.applicationId],
      });
    }
    // draft/submitted/pending_approval/needs_more_information — a real,
    // in-progress path, not yet established, not blocked.
    const inProgress = PASSPORT_APPLICATION_IN_PROGRESS.has(latestApp.applicationStatus ?? '');
    return leg({
      key: 'passport',
      label: 'Passport state',
      state: 'missing',
      mode: 'live',
      reason: inProgress
        ? `Application ${latestApp.applicationId} is in progress (${latestApp.applicationStatus}).`
        : `Application ${latestApp.applicationId} has status '${latestApp.applicationStatus}'.`,
      source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
      evidenceRefs: [latestApp.applicationId],
    });
  } catch (e) {
    return leg({
      key: 'passport',
      label: 'Passport state',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Passport read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/passport/passportStatusRead.ts',
    });
  }
}

async function resolveDelegationLeg(personaId: string, agentRootDid: string | null): Promise<ReadinessLeg> {
  if (!agentRootDid) {
    return leg({
      key: 'delegationAuthority',
      label: 'Delegation / authority chain',
      state: 'missing',
      mode: 'n/a',
      reason: 'No agent RootDID available yet to check for an active delegation grant.',
      source: 'services/delegation/delegationGrantStore.ts::readActiveGrantForAgent',
    });
  }
  try {
    const grant = await readActiveGrantForAgent(personaId, agentRootDid);
    return leg({
      key: 'delegationAuthority',
      label: 'Delegation / authority chain',
      state: grant ? 'established' : 'missing',
      mode: grant ? 'live' : 'n/a',
      reason: grant
        ? `Active delegation grant found (grant ${(grant as { grant_id?: string }).grant_id ?? 'id unknown'}).`
        : 'No active delegation grant found for this operator/agent pair.',
      source: 'services/delegation/delegationGrantStore.ts::readActiveGrantForAgent',
      evidenceRefs: grant ? [String((grant as { grant_id?: string }).grant_id ?? '')].filter(Boolean) : [],
    });
  } catch (e) {
    return leg({
      key: 'delegationAuthority',
      label: 'Delegation / authority chain',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Delegation read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/delegation/delegationGrantStore.ts::readActiveGrantForAgent',
    });
  }
}

async function resolveRegistryAssetLeg(aigentQubeId: string | null): Promise<ReadinessLeg> {
  // Item 5 correction: restored as a REQUIRED, externally-completed stage.
  // No Factor-owned handler ingests a registry_assets row — this leg can
  // never be advanced by this orchestrator, only observed. That is exactly
  // what 'awaiting_external_action' means (see the state's own doc comment)
  // — never 'missing', which would wrongly imply a Factor action exists.
  if (!aigentQubeId) {
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      state: 'awaiting_external_action',
      mode: 'n/a',
      reason: 'This agent has no aigentQubeId — no registry_assets row can exist for it yet. Registry ingestion is an external process this orchestrator cannot perform.',
      source: 'services/registry/persistence.ts::getAsset',
    });
  }
  try {
    const asset = await getAsset(aigentQubeId);
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      state: asset ? 'established' : 'awaiting_external_action',
      mode: asset ? 'live' : 'n/a',
      reason: asset
        ? `Registry asset '${aigentQubeId}' exists.`
        : `No registry_assets row found for '${aigentQubeId}' — registry ingestion is an external process this orchestrator cannot perform.`,
      source: 'services/registry/persistence.ts::getAsset',
      evidenceRefs: asset ? [aigentQubeId] : [],
    });
  } catch (e) {
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Registry asset read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/registry/persistence.ts::getAsset',
    });
  }
}

async function resolveHorizenLeg(admin: SupabaseClient, agent: RegistrableAgentConfig): Promise<ReadinessLeg> {
  // Item 5 correction: restored as a REQUIRED, externally-completed stage —
  // the Horizen/ERC-8004 registration ceremony is not a Factor-owned
  // mutation; an outstanding registration is 'awaiting_external_action',
  // never 'missing'.
  try {
    const state = await resolveAgentRegistrationState(admin, agent);
    return leg({
      key: 'horizenRegistration',
      label: 'Horizen/ERC-8004 registration',
      state: state.registered ? 'established' : 'awaiting_external_action',
      mode: state.registered ? 'live' : 'n/a',
      reason: state.registered
        ? `Registered on ${state.network ?? 'an unspecified network'} (tokenId ${state.tokenId}).`
        : `Not yet registered (source: ${state.source}; audit gaps: ${state.auditGaps.join('; ') || 'none stated'}) — the Horizen registration ceremony is an external process this orchestrator cannot perform.`,
      source: 'services/horizen/agentRegistrationBinding.ts::resolveAgentRegistrationState',
      evidenceRefs: state.tokenId ? [state.tokenId] : state.evidenceRefs,
    });
  } catch (e) {
    return leg({
      key: 'horizenRegistration',
      label: 'Horizen/ERC-8004 registration',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Registration-state read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/horizen/agentRegistrationBinding.ts::resolveAgentRegistrationState',
    });
  }
}

/** Item 5 correction: Pulse/P&L is required ONLY under an operator-selected
 *  journey profile that declares financial-intelligence reporting in scope
 *  — by default (no profile, or 'standard') it stays optional/observed-only,
 *  exactly as before. This is never inferred or defaulted to "on" — the
 *  operator must explicitly select the profile. */
async function resolvePulsePnlLeg(runtimeAgentId: string, required: boolean): Promise<ReadinessLeg> {
  try {
    const evidence = await resolvePnlEvidenceForAgent(runtimeAgentId);
    const established = evidence.serviceRegistered && evidence.serviceVerified;
    return leg({
      key: 'pulsePnl',
      required,
      label: 'Pulse/P&L status',
      state: established ? 'established' : 'missing',
      mode: evidence.serviceRegistered ? 'live' : 'n/a',
      reason: `serviceRegistered=${evidence.serviceRegistered} (${evidence.serviceRegisteredDvnStatus ?? 'no DVN status'}); serviceVerified=${evidence.serviceVerified} (${evidence.serviceVerifiedDvnStatus ?? 'no DVN status'}).`,
      source: 'services/horizen/pnlEvidenceRead.ts::resolvePnlEvidenceForAgent',
    });
  } catch (e) {
    return leg({
      key: 'pulsePnl',
      required,
      label: 'Pulse/P&L status',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Pulse/P&L read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/horizen/pnlEvidenceRead.ts::resolvePnlEvidenceForAgent',
    });
  }
}

/** Aegis decisions that positively support proceeding — 'admissible' fully,
 *  'admissible_with_conditions' with conditions surfaced and carried
 *  forward (correction 2). */
const AEGIS_POSITIVE_DECISIONS = new Set(['admissible', 'admissible_with_conditions']);
const AEGIS_BLOCKING_DECISIONS = new Set(['insufficient_evidence', 'not_admissible']);

async function resolveAegisLeg(admin: SupabaseClient, caseId: string | undefined): Promise<ReadinessLeg> {
  if (!caseId) {
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      state: 'missing',
      mode: 'n/a',
      reason: 'No Factor case yet — Aegis assesses a case, not a bare agent slug.',
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
    });
  }
  try {
    const assessment = await getCurrentAssessment(admin, 'factor_case', caseId);
    if (!assessment) {
      return leg({
        key: 'aegisAssessment',
        label: 'Aegis assessment',
        state: 'missing',
        mode: 'n/a',
        reason: 'No Aegis assessment exists yet for this case.',
        source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
      });
    }
    // Correction 2: `state === 'ratified'` alone is NOT a positive result —
    // readiness requires the RATIFIED decision to be admissible or
    // admissible_with_conditions. A ratified 'not_admissible'/
    // 'insufficient_evidence' decision is a real, ratified BLOCKER, not "not
    // yet done".
    if (assessment.state !== 'ratified') {
      return leg({
        key: 'aegisAssessment',
        label: 'Aegis assessment',
        state: 'missing',
        mode: 'n/a',
        reason: `Assessment ${assessment.assessment_id} is in progress (state: ${assessment.state}) — not yet ratified.`,
        source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
        evidenceRefs: [assessment.assessment_id],
      });
    }
    const decision = assessment.decision;
    const conditions = (assessment.conditions ?? []).map((c) => (typeof c === 'string' ? c : JSON.stringify(c)));
    if (decision && AEGIS_POSITIVE_DECISIONS.has(decision)) {
      return leg({
        key: 'aegisAssessment',
        label: 'Aegis assessment',
        state: 'established',
        mode: 'live',
        reason: `Assessment ${assessment.assessment_id} ratified, decision: ${decision}${conditions.length ? ` (${conditions.length} condition(s))` : ''}.`,
        source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
        evidenceRefs: [assessment.assessment_id],
        conditions: decision === 'admissible_with_conditions' ? conditions : [],
      });
    }
    if (decision && AEGIS_BLOCKING_DECISIONS.has(decision)) {
      return leg({
        key: 'aegisAssessment',
        label: 'Aegis assessment',
        state: 'blocked',
        mode: 'live',
        reason: `Assessment ${assessment.assessment_id} ratified with decision '${decision}' — a new assessment (re-requested with better evidence) is required, this is not automatically retried.`,
        source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
        evidenceRefs: [assessment.assessment_id],
      });
    }
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Assessment ${assessment.assessment_id} is ratified with an unrecognized decision value ('${decision}') — refusing to classify rather than guess.`,
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
      evidenceRefs: [assessment.assessment_id],
    });
  } catch (e) {
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Aegis read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
    });
  }
}

/** The conditions attached to a `conditionally_admitted` decision live in
 *  the `admission_decided` case-event's own metadata (correction 5) — never
 *  on the `factor_cases` row itself (it carries no conditions column). */
async function resolveAdmissionConditions(admin: SupabaseClient, caseId: string, tenantId: string): Promise<string[]> {
  try {
    const events = await listCaseEvents(admin, caseId, tenantId);
    const decided = [...events].reverse().find((e) => e.event_type === 'admission_decided');
    const raw = (decided?.metadata as { conditions?: unknown[] } | undefined)?.conditions ?? [];
    return raw.map((c) => (typeof c === 'string' ? c : JSON.stringify(c)));
  } catch {
    return [];
  }
}

async function resolveAdmissionLeg(admin: SupabaseClient, factorCase: FactorCaseRow | null, tenantId: string): Promise<ReadinessLeg> {
  if (!factorCase) {
    return leg({
      key: 'moneypennyAdmission',
      label: 'MoneyPenny admission',
      state: 'missing',
      mode: 'n/a',
      reason: 'No Factor case yet — nothing for MoneyPenny to admit.',
      source: 'services/factor/factorCaseService.ts (case.state)',
    });
  }
  // 'activation_pending'/'active' are only reachable via a PRIOR
  // admitted/conditionally_admitted transition (FORWARD_TRANSITIONS,
  // factorCaseService.ts) — a case that has progressed THAT far was, by
  // construction, already admitted. Treating only the literal
  // 'admitted'/'conditionally_admitted' strings as evidence would make this
  // leg regress to 'missing' the moment a case activates, which is wrong:
  // the FACT of admission does not un-happen when the case moves on.
  if (factorCase.state === 'admitted' || factorCase.state === 'activation_pending' || factorCase.state === 'active') {
    return leg({
      key: 'moneypennyAdmission',
      label: 'MoneyPenny admission',
      state: 'established',
      mode: 'live',
      reason: 'Case admitted, no conditions.',
      source: 'services/factor/factorCaseService.ts (case.state, via services/moneypenny/admissionAuthority.ts::decideAdmission)',
      evidenceRefs: [factorCase.case_id],
    });
  }
  if (factorCase.state === 'conditionally_admitted') {
    // Correction 5: conditionally_admitted is admitted-WITH-CONDITIONS, not
    // "not admitted" — surfaced as 'established' (the leg itself is
    // satisfied) but conditions travel forward so downstream legs
    // (runtime activation) can block on an unmet one.
    const conditions = await resolveAdmissionConditions(admin, factorCase.case_id, tenantId);
    return leg({
      key: 'moneypennyAdmission',
      label: 'MoneyPenny admission',
      state: 'established',
      mode: 'live',
      reason: `Case conditionally admitted${conditions.length ? ` with ${conditions.length} condition(s)` : ''}.`,
      source: 'services/factor/factorCaseService.ts (case.state, via services/moneypenny/admissionAuthority.ts::decideAdmission)',
      evidenceRefs: [factorCase.case_id],
      conditions,
    });
  }
  if (factorCase.state === 'rejected') {
    return leg({
      key: 'moneypennyAdmission',
      label: 'MoneyPenny admission',
      state: 'blocked',
      mode: 'live',
      reason: 'Case was rejected by MoneyPenny — a new case/assessment cycle is required, never automatic.',
      source: 'services/factor/factorCaseService.ts (case.state)',
      evidenceRefs: [factorCase.case_id],
    });
  }
  return leg({
    key: 'moneypennyAdmission',
    label: 'MoneyPenny admission',
    state: 'missing',
    mode: 'live',
    reason: `Case state: ${factorCase.state} — admission decision not yet made.`,
    source: 'services/factor/factorCaseService.ts (case.state)',
    evidenceRefs: [factorCase.case_id],
  });
}

async function resolveBankrLeg(admin: SupabaseClient, tenantId: string, runtimeAgentId: string): Promise<ReadinessLeg> {
  // Correction 4: configured/live-vs-fake mode is DERIVED from the real
  // Bankr adapter's own status/capabilities — never hardcoded to
  // 'simulated' merely because a provider-wallet binding row exists.
  // Provider-configured, binding-active, and operation-supported are three
  // SEPARATE facts, never collapsed into one. Routed through
  // assessIssuerReadiness (services/factor/bankrCapabilityHandlers.ts) —
  // the ONE permitted call site for constructing a Bankr provider adapter
  // (tests/bankr-governance-invariants.test.ts enforces this structurally);
  // this function never constructs one itself.
  let readiness: Awaited<ReturnType<typeof assessIssuerReadiness>>;
  try {
    readiness = await assessIssuerReadiness(admin, tenantId, runtimeAgentId);
  } catch (e) {
    return leg({
      key: 'bankrBinding',
      label: 'Bankr/provider binding',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Bankr read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/factor/bankrCapabilityHandlers.ts::assessIssuerReadiness',
    });
  }

  const mode: ReadinessLegMode = readiness.bankrMode === 'live' ? 'live' : 'simulated';
  const established = readiness.hasProviderWalletBinding && readiness.tokenLaunchEnabled === true;
  // Effective-state display (2026-09-08 correction): never report the
  // binding by its bare lifecycle `status` alone — "active" reads as a
  // confirmed real provider relationship even when nothing was ever
  // verified. bindingEffectiveState (services/financialServices/providers/
  // providerWalletBinding.ts::deriveBindingEffectiveState) is the ONE
  // derived label every consumer must use instead.
  const bindingLabel =
    readiness.bindingEffectiveState === 'active-verified'
      ? 'Verified'
      : readiness.bindingEffectiveState === 'active-simulated'
        ? 'Simulated binding (never verified against a real Bankr account)'
        : readiness.bindingEffectiveState === 'revoked'
          ? 'Revoked'
          : 'None';
  return leg({
    key: 'bankrBinding',
    label: 'Bankr/provider binding',
    state: established ? 'established' : 'missing',
    mode,
    reason:
      `Provider configured=${readiness.bankrConfigured} (mode: ${readiness.bankrMode}); ` +
      `binding=${bindingLabel}; ` +
      `operation supported (token launch)=${readiness.tokenLaunchEnabled}.`,
    source: 'services/factor/bankrCapabilityHandlers.ts::assessIssuerReadiness',
    evidenceRefs: readiness.providerWalletBinding ? [readiness.providerWalletBinding.id ?? ''].filter(Boolean) : [],
  });
}

async function resolveVelaLeg(admin: SupabaseClient, caseId: string | undefined, tenantId: string): Promise<ReadinessLeg> {
  if (!caseId) {
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      state: 'missing',
      mode: 'n/a',
      reason: 'No Factor case yet — the admission-packet confidential workload is bound to a case.',
      source: 'services/factor/factorConfidentialWorkload.ts',
    });
  }
  try {
    const evidenceItems = await listEvidenceForCase(admin, caseId, tenantId);
    const items = (evidenceItems ?? []) as Array<{
      kind: string;
      status: string;
      payload?: {
        disposition?: string;
        attestationMode?: 'NO_ATTESTATION_LOCAL' | 'NITRO_ATTESTED' | string;
        protocolExecutionVerified?: boolean;
        teeAttestationVerified?: boolean;
      };
    }>;
    const projectionEvidence = items.find((i) => i.kind === FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND);
    if (!projectionEvidence || projectionEvidence.status !== 'supplied') {
      return leg({
        key: 'velaReadiness',
        label: 'Vela confidential-compute readiness',
        state: 'missing',
        mode: 'n/a',
        reason: 'No confidential-compute evidence recorded yet for this case.',
        source: 'services/factor/factorConfidentialWorkload.ts (factor_evidence_items)',
      });
    }
    // Item 1/3 fix (behavioral, not extension): a Vela leg is established
    // ONLY when the recorded evidence's own disposition is ACCEPTABLE AND
    // the verification state appropriate to its OWN declared attestationMode
    // passed — never inferred from the other mode's boolean (see
    // types/confidentialProjection.ts's own doc: the two verification
    // booleans "are structurally separate and one may never be inferred
    // from the other"). NO_ATTESTATION_LOCAL requires protocolExecution
    // Verified. NITRO_ATTESTED requires BOTH protocolExecutionVerified AND
    // teeAttestationVerified (2026-09-07 correction: a live TEE attestation
    // does NOT by itself prove the protocol executed correctly inside it —
    // that would be inferring one boolean from the other, exactly what the
    // type's own doc comment forbids; both are checked independently, and
    // local (non-Nitro) execution is always reported as 'simulated', never
    // conflated with a live attestation). An UNACCEPTABLE/UNRESOLVED
    // disposition, or a disposition whose mode-appropriate verification did
    // not pass, remains 'blocked' — a real ratified refusal, not "not yet
    // done".
    const { disposition, attestationMode, protocolExecutionVerified, teeAttestationVerified } = projectionEvidence.payload ?? {};
    const verificationPassed =
      attestationMode === 'NITRO_ATTESTED'
        ? protocolExecutionVerified === true && teeAttestationVerified === true
        : attestationMode === 'NO_ATTESTATION_LOCAL'
          ? protocolExecutionVerified === true
          : false;
    const established = disposition === 'ACCEPTABLE' && verificationPassed;
    // `mode` is an orthogonal fact about HOW this was attempted (never
    // folded into `state`/established-ness) — NO_ATTESTATION_LOCAL is
    // ALWAYS visibly 'simulated' (never conflated with a live attestation);
    // NITRO_ATTESTED is 'live' regardless of whether verification passed —
    // a failed-verification NITRO attempt was still a live-mode attempt,
    // just a blocked one.
    const mode: ReadinessLegMode = attestationMode === 'NITRO_ATTESTED' ? 'live' : 'simulated';
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      state: established ? 'established' : 'blocked',
      mode,
      reason: established
        ? `Confidential admission-packet evaluation ACCEPTABLE and verified for attestationMode ${attestationMode} (protocolExecutionVerified=${protocolExecutionVerified}, teeAttestationVerified=${teeAttestationVerified}).`
        : `Confidential admission-packet evaluation recorded but NOT established: disposition=${disposition ?? 'unknown'}, attestationMode=${attestationMode ?? 'unknown'}, protocolExecutionVerified=${protocolExecutionVerified}, teeAttestationVerified=${teeAttestationVerified} — a new evaluation, not automatic retry, is required to change this verdict.`,
      source: 'services/factor/factorConfidentialWorkload.ts (factor_evidence_items)',
    });
  } catch (e) {
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Vela-evidence read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/factor/factorConfidentialWorkload.ts',
    });
  }
}

async function resolveRuntimeActivationLeg(
  admin: SupabaseClient,
  actorPersonaId: string,
  runtimeAgentId: string | null,
  factorCase: FactorCaseRow | null,
  admissionConditions: string[],
): Promise<ReadinessLeg> {
  // Correction 5: activation is BLOCKED while an admission condition
  // remains unmet — this projection has no mechanism to know a condition
  // was individually resolved (no per-condition tracking exists anywhere in
  // this codebase today), so ANY outstanding condition on a
  // conditionally_admitted case blocks activation rather than silently
  // treating conditional admission as equivalent to unconditional.
  if (factorCase?.state === 'conditionally_admitted' && admissionConditions.length > 0) {
    return leg({
      key: 'runtimeActivation',
      label: 'MoneyPenny runtime activation',
      state: 'blocked',
      mode: 'n/a',
      reason: `${admissionConditions.length} unmet admission condition(s) block activation: ${admissionConditions.join('; ')}.`,
      source: 'services/factor/factorCaseService.ts (case.state) + admission_decided event conditions',
      evidenceRefs: [factorCase.case_id],
      conditions: admissionConditions,
    });
  }
  if (factorCase?.state !== 'active') {
    return leg({
      key: 'runtimeActivation',
      label: 'MoneyPenny runtime activation',
      state: 'missing',
      mode: factorCase ? 'live' : 'n/a',
      reason: factorCase ? `Case state: ${factorCase.state}.` : 'No Factor case yet — nothing to activate.',
      source: 'services/factor/factorCaseService.ts (case.state)',
      evidenceRefs: factorCase ? [factorCase.case_id] : [],
    });
  }
  // Correction (operator review, 2026-09-06): Factor's own case.state
  // label is NECESSARY but was being treated as SUFFICIENT proof the agent
  // is operationally admitted into MoneyPenny's financial runtime — it is
  // Factor's internal bookkeeping, not MoneyPenny's own authority. Cross-
  // checked here against discoverEligibleFinancialServices (services/
  // financialServices/discovery.ts) — MoneyPenny's own real eligibility
  // resolver (constitutional-authority-state-backed), never a second
  // eligibility mechanism. 'active' + at least one MoneyPenny-eligible
  // service is genuine proof; 'active' alone is not.
  if (!runtimeAgentId) {
    return leg({
      key: 'runtimeActivation',
      label: 'MoneyPenny runtime activation',
      state: 'unreadable',
      mode: 'n/a',
      reason: 'Case state is active, but no runtime agent id could be resolved to check MoneyPenny service eligibility against.',
      source: 'services/factor/factorCaseService.ts (case.state) + services/financialServices/discovery.ts',
      evidenceRefs: [factorCase.case_id],
    });
  }
  try {
    const discovered = await discoverFinancialServicesForConsumer(runtimeAgentId, admin, { actorPersonaId });
    if (!discovered.ok) {
      return leg({
        key: 'runtimeActivation',
        label: 'MoneyPenny runtime activation',
        state: 'unreadable',
        mode: 'n/a',
        reason: `MoneyPenny discovery refused: ${discovered.error}`,
        source: 'services/financialServices/discovery.ts::discoverFinancialServicesForConsumer',
        evidenceRefs: [factorCase.case_id],
      });
    }
    // Item 2 fix (behavioral, not extension): `discoverEligibleFinancialServices`
    // discards `authority`/`readiness` and reports mere catalog `eligible`ness —
    // per that module's own header, "a service can be eligible while still
    // lacking current CONSEQUENTIAL authority". Runtime activation requires an
    // execution-reachable (Runtime-class) service whose authority prerequisite
    // is actually met AND whose derived runtime-readiness projection reports
    // the system/eligibility/standing facts as ready — eligibility alone is
    // insufficient. `confidentialExecution` is deliberately excluded here: it
    // is the Vela leg's own concern (resolveVelaLeg, tracked as a separate
    // readiness leg above) — folding it in here would make this leg circular
    // with Vela's and permanently unsatisfiable pre-Vela-live for reasons this
    // leg does not itself own.
    const runtimeServices = discovered.services.filter((s) => s.definition.executionPolicy.executionReachable);
    const qualified = runtimeServices.find((s) => {
      if (!s.authority?.met || !s.readiness) return false;
      const standingOk = s.readiness.standing === 'ready' || s.readiness.standing === 'not-required';
      return s.readiness.systemReady === 'ready' && s.readiness.eligibility === 'ready' && standingOk;
    });
    const established = Boolean(qualified);
    return leg({
      key: 'runtimeActivation',
      label: 'MoneyPenny runtime activation',
      state: established ? 'established' : 'missing',
      mode: 'live',
      reason: established
        ? `Case active AND an execution-reachable Runtime service ('${qualified!.definition.serviceId}') reports satisfied authority and runtime readiness (systemReady=${qualified!.readiness!.systemReady}, eligibility=${qualified!.readiness!.eligibility}, standing=${qualified!.readiness!.standing}, authority=${qualified!.readiness!.authority}).`
        : runtimeServices.length === 0
          ? 'Case state is active, but MoneyPenny reports no execution-reachable Runtime service for this agent at all — case-state activation alone is not proof of runtime admission.'
          : `Case state is active, but no execution-reachable Runtime service has both satisfied authority and satisfied runtime readiness yet: ${runtimeServices.map((s) => `${s.definition.serviceId} (authority=${s.authority?.state ?? 'n/a'}, readiness.eligibility=${s.readiness?.eligibility ?? 'n/a'}, readiness.standing=${s.readiness?.standing ?? 'n/a'})`).join('; ')}.`,
      source: 'services/factor/factorCaseService.ts (case.state) + services/financialServices/discovery.ts::discoverFinancialServicesForConsumer',
      evidenceRefs: [factorCase.case_id, ...(qualified ? [qualified.definition.serviceId] : [])],
    });
  } catch (e) {
    return leg({
      key: 'runtimeActivation',
      label: 'MoneyPenny runtime activation',
      state: 'unreadable',
      mode: 'n/a',
      reason: `MoneyPenny service-eligibility read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/financialServices/discovery.ts::discoverFinancialServicesForConsumer',
      evidenceRefs: [factorCase.case_id],
    });
  }
}

/** Mirrors useCaseZeroOrchestrator.ts's own REHEARSAL_COMPLETE_STATES — kept
 *  as a second literal set (not imported) to avoid a projection->orchestrator
 *  dependency; both lists are short and change only if the token-launch
 *  state machine itself changes (tokenLaunchService.ts's own FORWARD_
 *  TRANSITIONS), which would need reviewing here regardless. */
const REHEARSAL_LEG_COMPLETE_STATES = new Set([
  'preflighted', 'aegis_review_pending', 'revision_required', 'approval_pending',
  'approved', 'submitting', 'submitted', 'confirmed',
]);

async function resolveRehearsalLeg(
  admin: SupabaseClient,
  tenantId: string,
  runtimeAgentId: string | null,
  factorCase: FactorCaseRow | null,
): Promise<ReadinessLeg> {
  // No ordinary-transaction domain object exists anywhere in this codebase
  // (types/financialServices.ts's own boundary statement) — the only real
  // governed-financial-request object today is a token-launch draft
  // (services/factor/tokenLaunchService.ts). This leg reports that
  // boundary honestly rather than claiming a general rehearsal capability.
  //
  // Correction (2026-09-08, operator directive): this leg previously required
  // `factorCase.state === 'active'` (full runtime activation, itself gated
  // behind the case's own Aegis ratification + MoneyPenny admission decision)
  // before a rehearsal could even be attempted. That conflated an
  // evidence-producing, non-consequential act (preparing a launch spec and
  // running Bankr's deterministic preflight — services/factor/tokenLaunchService.ts's
  // own `createOrResumeDraft`/`claimDraftForPreflight`/`preflightLaunch` never
  // check case state at all) with the case's genuinely consequential admission
  // decision. The only real requirement is a case to bind the draft to
  // (`case_ref`) and a resolved runtime agent id — nothing about admission.
  if (!factorCase || !runtimeAgentId) {
    return leg({
      key: 'governedOperationRehearsal',
      label: 'Governed financial-operation rehearsal',
      state: 'missing',
      mode: 'n/a',
      reason: 'A Factor case and a resolved runtime agent id are required before a governed-operation rehearsal can be prepared.',
      source: 'services/factor/tokenLaunchService.ts (capability boundary)',
    });
  }
  // Item 4 fix (2026-09-07): this leg's OWN state reflects the canonical
  // token-launch aggregate looked up by CASE (findLatestTokenLaunchForCase),
  // never by beneficiary alone — a preflighted-or-later launch bound to
  // THIS case IS the established fact. `mode` is DERIVED from the recorded
  // Bankr terms' own `simulated` flag (bankrProviderAdapter.ts's real quote
  // response), never hardcoded.
  try {
    const launch = await findLatestTokenLaunchForCase(admin, tenantId, factorCase!.case_id);
    if (launch && REHEARSAL_LEG_COMPLETE_STATES.has(launch.state)) {
      const simulated = (launch.bankr_terms as { simulated?: boolean } | null)?.simulated !== false;
      return leg({
        key: 'governedOperationRehearsal',
        label: 'Governed financial-operation rehearsal',
        state: 'established',
        mode: simulated ? 'simulated' : 'live',
        reason: `Token launch ${launch.id} reached '${launch.state}' — a Bankr token-launch preflight/rehearsal has been completed for this case (${simulated ? 'simulated' : 'live'} Bankr terms).`,
        source: 'services/factor/tokenLaunchService.ts::findLatestTokenLaunchForCase',
        evidenceRefs: [launch.id],
      });
    }
    return leg({
      key: 'governedOperationRehearsal',
      label: 'Governed financial-operation rehearsal',
      state: 'missing',
      mode: 'n/a',
      reason: launch
        ? `Existing token launch ${launch.id} is '${launch.state}' — not yet preflighted. The only governed financial-request rehearsal available today is a Bankr token-launch preparation (no ordinary transfer/payment capability exists in this codebase) — resume it via the Bankr readiness/preflight actions.`
        : 'Runtime is activated. The only governed financial-request rehearsal available today is a Bankr token-launch preparation (no ordinary transfer/payment capability exists in this codebase) — run the Bankr readiness/preflight actions to rehearse.',
      source: 'services/factor/tokenLaunchService.ts (capability boundary)',
      evidenceRefs: launch ? [launch.id] : [],
    });
  } catch (e) {
    return leg({
      key: 'governedOperationRehearsal',
      label: 'Governed financial-operation rehearsal',
      state: 'unreadable',
      mode: 'n/a',
      reason: `Token-launch read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/factor/tokenLaunchService.ts::findLatestTokenLaunchForCase',
    });
  }
}

export async function projectUseCaseZeroReadiness(input: UseCaseZeroReadinessInput): Promise<UseCaseZeroReadiness> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  const runtimeAgentId = agent?.runtimeAgentId ?? null;

  let factorCase: FactorCaseRow | null = null;
  let factorCaseUnreadable = false;
  if (input.caseId) {
    try {
      factorCase = await getCase(input.admin, input.caseId, input.tenantId);
    } catch {
      factorCase = null;
      factorCaseUnreadable = true;
    }
  }

  const admissionConditions =
    factorCase?.state === 'conditionally_admitted'
      ? await resolveAdmissionConditions(input.admin, factorCase.case_id, input.tenantId)
      : [];

  // Hoisted ahead of agentShell (rather than left in its display position)
  // because agentShell's own 'create_and_establish' resolution needs to know
  // whether the OPERATOR's sponsoring Passport already exists — matching the
  // operator's stated sequence: "creates a passport and then sponsors an
  // agent." The leg is still rendered in its usual array position below.
  const passportLeg = await resolvePassportLeg(input.admin, input.actorPersonaId);

  const legs: ReadinessLeg[] = [
    await resolveOperatorContextLeg(input),
    await resolveAgentShellLeg(input.admin, agent, input.agentSlug, input.path, passportLeg.state === 'established'),
    await resolveDidqubeContainerLeg(input.admin, agent, input.agentSlug),
    ...(runtimeAgentId
      ? await resolveWalletLegs(runtimeAgentId)
      : ([
          leg({ key: 'ownerWallet', label: 'Owner/control wallet', state: 'missing', mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/wallet/agentPurposeWalletService.ts' }),
          leg({ key: 'settlementWallet', label: 'Settlement/x402 wallet', state: 'missing', mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/wallet/agentPurposeWalletService.ts' }),
        ] as [ReadinessLeg, ReadinessLeg])),
    passportLeg,
    await resolveDelegationLeg(input.actorPersonaId, factorCase?.candidate_agent_root_did ?? null),
    await resolveRegistryAssetLeg(agent?.aigentQubeId ?? null),
    agent
      ? await resolveHorizenLeg(input.admin, agent)
      : leg({ key: 'horizenRegistration', label: 'Horizen/ERC-8004 registration', state: 'awaiting_external_action', mode: 'n/a', reason: 'No registrable agent resolved yet.', source: 'services/horizen/agentRegistrationBinding.ts' }),
    runtimeAgentId
      ? await resolvePulsePnlLeg(runtimeAgentId, input.journeyProfile === 'financial_intelligence')
      : leg({ key: 'pulsePnl', label: 'Pulse/P&L status', state: 'missing', mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/horizen/pnlEvidenceRead.ts', required: input.journeyProfile === 'financial_intelligence' }),
    // Correction (2026-09-08, operator directive): bankrBinding and
    // governedOperationRehearsal moved AHEAD of the case-level aegisAssessment/
    // moneypennyAdmission legs below. Launch-spec preparation and provider
    // preflight are evidence-producing, non-consequential acts (they write a
    // draft/preflight row, never ratify anything or move money) — they must
    // never be gated behind the CASE's own admission decision, which is a
    // separate, later, genuinely consequential act. The hard stop this
    // orchestrator preserves is still real: it sits at launch-specific Aegis
    // ratification / MoneyPenny approval / signing / submission / broadcast,
    // never here.
    runtimeAgentId
      ? await resolveBankrLeg(input.admin, input.tenantId, runtimeAgentId)
      : leg({ key: 'bankrBinding', label: 'Bankr/provider binding', state: 'missing', mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/financialServices/providers/providerWalletBinding.ts' }),
    await resolveRehearsalLeg(input.admin, input.tenantId, runtimeAgentId, factorCase),
    await resolveAegisLeg(input.admin, input.caseId),
    factorCaseUnreadable
      ? leg({ key: 'moneypennyAdmission', label: 'MoneyPenny admission', state: 'unreadable', mode: 'n/a', reason: 'Factor case read failed.', source: 'services/factor/factorCaseService.ts' })
      : await resolveAdmissionLeg(input.admin, factorCase, input.tenantId),
    await resolveVelaLeg(input.admin, input.caseId, input.tenantId),
    await resolveRuntimeActivationLeg(input.admin, input.actorPersonaId, runtimeAgentId, factorCase, admissionConditions),
  ];

  const completedSteps = legs.filter((l) => l.state === 'established').map((l) => l.key);
  // The presently-actionable step is the first REQUIRED leg that is NOT
  // established — required/optional (correction: "Registry/Horizen/Pulse
  // need explicit required-versus-optional semantics"). An optional leg
  // (registryAsset/horizenRegistration/pulsePnl) never blocks progress or
  // completion; its true state is still reported in `legs`, just never
  // consulted here. 'unreadable' legs are surfaced as blockers but never
  // recommended a provisioning next action (a failed read is not evidence
  // of absence).
  const firstOutstanding = legs.find((l) => l.required && l.state !== 'established') ?? null;

  const nextActionByKey: Record<string, { handlerId: string; label: string }> = {
    operatorContext: { handlerId: 'factor:explain', label: 'Sign in as the accountable operator persona' },
    agentShell: { handlerId: 'factor:case-service', label: 'Inspect or create the constitutional agent shell (Factor case)' },
    didqubeContainer: { handlerId: 'factor:ensure-didqube-container', label: "Bind the agent's DiDQube constitutional container" },
    ownerWallet: { handlerId: 'factor:ucz-provision-wallets', label: 'Provision the owner/control wallet' },
    settlementWallet: { handlerId: 'factor:ucz-provision-wallets', label: 'Provision the settlement/x402 wallet' },
    passport: { handlerId: 'factor:ucz-navigate-journey', label: 'File or resume the Passport application' },
    delegationAuthority: { handlerId: 'factor:authority-chain', label: 'Establish an authority chain / delegation grant' },
    registryAsset: { handlerId: 'factor:case-service', label: 'Await registry asset ingestion' },
    horizenRegistration: { handlerId: 'factor:horizen-registration-binding', label: 'Check or advance Horizen registration' },
    pulsePnl: { handlerId: 'factor:ucz-navigate-journey', label: 'Register Pulse/P&L reporting' },
    aegisAssessment: { handlerId: 'factor:ucz-request-aegis', label: 'Request an independent Aegis assessment' },
    moneypennyAdmission: { handlerId: 'factor:ucz-request-admission', label: 'Await MoneyPenny admission decision' },
    bankrBinding: { handlerId: 'factor:ucz-bankr-binding', label: 'Inspect or provision the Bankr provider-wallet binding' },
    velaReadiness: { handlerId: 'factor:vela-admission-projection', label: 'Run the admission-packet confidential policy evaluation' },
    runtimeActivation: { handlerId: 'factor:ucz-runtime-activation', label: 'Activate the MoneyPenny runtime for this agent' },
    governedOperationRehearsal: { handlerId: 'factor:ucz-rehearse-governed-operation', label: 'Rehearse a governed token-launch preparation' },
  };

  const presentlyActionableStep = firstOutstanding?.key ?? null;
  const nextAction = firstOutstanding && firstOutstanding.state !== 'unreadable' ? nextActionByKey[firstOutstanding.key] ?? null : null;
  const blockers = firstOutstanding ? [firstOutstanding.reason] : [];

  return {
    path: input.path,
    agentSlug: input.agentSlug,
    legs,
    completedSteps,
    requiredStepsComplete: !firstOutstanding,
    presentlyActionableStep,
    blockers,
    nextAction,
    requiresApproval: Boolean(
      firstOutstanding &&
        ['moneypennyAdmission', 'aegisAssessment', 'governedOperationRehearsal'].includes(firstOutstanding.key),
    ),
    requiredAuthority: ['constitutional-agent-establishment-readiness'],
  };
}
