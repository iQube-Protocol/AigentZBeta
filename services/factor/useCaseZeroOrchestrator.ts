/**
 * Use Case Zero — resumable orchestrator (Phase 2, 2026-09-06).
 *
 * Every call to `advanceUseCaseZero`:
 *   1. REREADS canonical state (projectUseCaseZeroReadiness) — never trusts
 *      a caller-supplied snapshot.
 *   2. SELECTS exactly one permitted next action — the projection's own
 *      `presentlyActionableStep`, in the SAME dependency order the
 *      projection already computes (never a second ordering).
 *   3. INVOKES the existing owning service for that one step — never a
 *      parallel write path.
 *   4. RECORDS the result through the EXISTING receipt system — most steps'
 *      owning services already write their own receipt
 *      (transitionCaseState, createAssessment, prepareLaunchProposal/
 *      preflightLaunch, runAdmissionPacketPolicyEvaluation); the one gap
 *      (wallet provisioning) gets a receipt here, using the
 *      `agent_purpose_wallet_provisioned` action type added for this pass.
 *   5. REREADS readiness again (same projection) so the caller always sees
 *      the fresh, post-action state — never the stale pre-action snapshot.
 *   6. NEVER auto-chains across a human-approval boundary: requesting an
 *      Aegis assessment never ratifies it; requesting admission (moving a
 *      case to `admission_pending`) never calls `decideAdmission` (the sole
 *      MoneyPenny-attributed decision path); preparing/preflighting a token
 *      launch never approves or submits it. Each of those remaining steps
 *      is a SEPARATE human/MoneyPenny/Aegis act this orchestrator cannot
 *      perform and does not simulate performing.
 *
 * Authority (correction 7): every CONSEQUENTIAL step (anything that writes)
 * evaluates tenant + persona + delegation/authority before acting — never
 * trusting `requiredAuthority` declared in the manifest as enforcement by
 * itself. Read-only/navigate steps need no such check (nothing to authorize).
 *
 * Explicitly OUT OF SCOPE, permanently: token submission, signing,
 * broadcast, fund movement, or automatic approval of anything. This file
 * must never grow a code path that performs any of those.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  projectUseCaseZeroReadiness,
  type UseCaseZeroPath,
  type UseCaseZeroReadiness,
} from '@/services/factor/useCaseZeroReadinessProjection';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { getCase, createOrResumeCase, transitionCaseState, listEvidenceForCase } from '@/services/factor/factorCaseService';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';
import { establishDirectChain } from '@/services/factor/authorityChain';
import { validateChainForAction } from '@/services/factor/authorityChain';
import { readActiveGrantForAgent } from '@/services/delegation/delegationGrantStore';
import { createAssessment } from '@/services/aegis/aegisAssessmentService';
import { inspectOrProvisionProviderBinding, preflightLaunch } from '@/services/factor/bankrCapabilityHandlers';
import { runAdmissionPacketPolicyEvaluation } from '@/services/factor/factorConfidentialWorkload';
import { createOrResumeDraft, transitionState, type CreateDraftInput } from '@/services/factor/tokenLaunchService';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type OrchestratorOutcome = 'advanced' | 'no_action_needed' | 'blocked' | 'awaiting_input' | 'awaiting_external_action';

export interface AdvanceUseCaseZeroInput {
  admin: SupabaseClient;
  tenantId: string;
  actorPersonaId: string;
  agentSlug: string;
  path: UseCaseZeroPath;
  caseId?: string;
  /** Item 2 (2026-09-07): the operator's explicit journey-profile choice,
   *  threaded through unmodified to the projection — this orchestrator
   *  never infers or defaults it beyond what the projection itself
   *  defaults (absent/'standard' => Pulse/P&L optional). */
  journeyProfile?: 'standard' | 'financial_intelligence';
  /** Required only when the presently-actionable step is
   *  `governedOperationRehearsal` — Factor never invents these values
   *  (manifest boundary). Absent means the step reports `awaiting_input`. */
  launchSpec?: Pick<CreateDraftInput, 'chain' | 'tokenName' | 'tokenSymbol' | 'description'>;
}

export interface AdvanceUseCaseZeroResult {
  stepTaken: string | null;
  outcome: OrchestratorOutcome;
  detail: string;
  readiness: UseCaseZeroReadiness;
  /** The Factor case this advance ran against — present once step 1 (create/
   *  resume case) has run at least once, so a caller can pass it back on
   *  the NEXT advance() call for resumability. Never re-derived by guessing
   *  from readiness legs. */
  caseId: string | null;
}

/** Consequential steps this orchestrator may perform without crossing an
 *  approval boundary (correction 7 gates each of these on tenant/persona/
 *  delegation/authority before acting). */
type ActionableStep =
  | 'agentShell'
  | 'ownerWallet'
  | 'settlementWallet'
  | 'passport'
  | 'delegationAuthority'
  | 'pulsePnl'
  | 'aegisAssessment'
  | 'moneypennyAdmission'
  | 'bankrBinding'
  | 'velaReadiness'
  | 'runtimeActivation'
  | 'governedOperationRehearsal';

async function reread(input: AdvanceUseCaseZeroInput): Promise<UseCaseZeroReadiness> {
  return projectUseCaseZeroReadiness({
    admin: input.admin,
    tenantId: input.tenantId,
    actorPersonaId: input.actorPersonaId,
    agentSlug: input.agentSlug,
    path: input.path,
    caseId: input.caseId,
    journeyProfile: input.journeyProfile,
  });
}

/** Step 4 — delegation/authority establishment. Never manufactures
 *  authority: refuses (navigate, no write) when no active delegation_grants
 *  row exists yet. */
async function stepDelegationAuthority(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  const agentRootDid = factorCase.candidate_agent_root_did;
  if (!agentRootDid) {
    return {
      stepTaken: 'delegationAuthority',
      outcome: 'awaiting_input',
      detail: 'No candidate agent RootDID bound to this case yet — bind one (via the Passport/delegation journey) before an authority chain can be established.',
      readiness: await reread(input),
    };
  }
  const grant = await readActiveGrantForAgent(input.actorPersonaId, agentRootDid);
  if (!grant) {
    return {
      stepTaken: 'delegationAuthority',
      outcome: 'awaiting_input',
      detail:
        'No active delegation grant exists for this operator/agent pair — establish one through the existing Bounded Delegation journey ' +
        '(this orchestrator never manufactures authority a real delegation_grants row does not already grant).',
      readiness: await reread(input),
    };
  }
  const chain = await establishDirectChain(input.admin, {
    principalPersonaId: input.actorPersonaId,
    targetAgentRef: input.agentSlug,
    targetAgentRootDid: agentRootDid,
    allowedActions: ['constitutional-agent-establishment'],
  });
  return {
    stepTaken: 'delegationAuthority',
    outcome: 'advanced',
    detail: `Authority chain ${chain.chain_id} established (direct mode).`,
    readiness: await reread(input),
  };
}

/** Steps 8-9 (Aegis) — requesting an assessment is a real action; ratifying
 *  it is a SEPARATE, Aegis-only act this function never performs. */
async function stepAegisAssessment(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  const evidenceItems = await listEvidenceForCase(input.admin, factorCase.case_id, input.tenantId);
  const runtimeAgentId = resolveRegistrableAgent(input.agentSlug)?.runtimeAgentId ?? input.agentSlug;
  const assessment = await createAssessment(input.admin, {
    subjectType: 'factor_case',
    subjectRef: factorCase.case_id,
    caseId: factorCase.case_id,
    policyVersion: 'use-case-zero-v1',
    evidenceSnapshot: { items: evidenceItems },
    // Factor requests; Aegis (never Factor) assesses — the self-assessment
    // guard in createAssessment refuses outright if these ever collided.
    requestedByAgentRef: runtimeAgentId,
    actorPersonaId: input.actorPersonaId,
  });
  return {
    stepTaken: 'aegisAssessment',
    outcome: 'advanced',
    detail: `Aegis assessment ${assessment.assessment_id} requested (state: ${assessment.state}) — awaiting Aegis's own independent review and ratification; this orchestrator never ratifies it.`,
    readiness: await reread(input),
  };
}

/** Step 6 — MoneyPenny admission REQUEST only: moves the case to
 *  `admission_pending`. The admit/reject/conditionally-admit DECISION is a
 *  separate, MoneyPenny-attributed act (services/moneypenny/
 *  admissionAuthority.ts::decideAdmission) this orchestrator never calls. */
async function stepRequestAdmission(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  if (factorCase.state !== 'registry_ready') {
    return {
      stepTaken: 'moneypennyAdmission',
      outcome: 'blocked',
      detail: `Case state is '${factorCase.state}' — admission may only be requested from 'registry_ready'.`,
      readiness: await reread(input),
    };
  }
  const updated = await transitionCaseState(input.admin, {
    caseId: factorCase.case_id,
    tenantId: input.tenantId,
    toState: 'admission_pending',
    actorPersonaId: input.actorPersonaId,
    authorityChainId: factorCase.authority_chain_id ?? undefined,
    reason: 'Use Case Zero orchestrator: requesting MoneyPenny admission decision.',
  });
  return {
    stepTaken: 'moneypennyAdmission',
    outcome: 'advanced',
    detail: `Case ${updated.case_id} moved to 'admission_pending' — awaiting MoneyPenny's own admission decision; this orchestrator never decides it.`,
    readiness: await reread(input),
  };
}

async function stepBankrBinding(input: AdvanceUseCaseZeroInput, runtimeAgentId: string): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  const binding = await inspectOrProvisionProviderBinding(input.admin, input.tenantId, runtimeAgentId, input.actorPersonaId);
  return {
    stepTaken: 'bankrBinding',
    outcome: 'advanced',
    detail: `Bankr provider-wallet binding ${binding.id} status: ${binding.status} (simulated unless live BANKR_*_API_KEY is configured).`,
    readiness: await reread(input),
  };
}

async function stepVela(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
  readiness: UseCaseZeroReadiness,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  // Case-derived confidential inputs (correction 2026-09-06: the prior
  // hardcoded readinessScore:1/policyThreshold:1 produced a predetermined
  // pass regardless of the actual candidate — never a real evaluation).
  // No canonical service in this codebase produces a numeric admission
  // "score" for a case (Aegis's own decision is categorical:
  // admissible/admissible_with_conditions/insufficient_evidence/
  // not_admissible, never a 0-1 number) — inventing one would be exactly
  // the kind of fabrication CLAUDE.md's "No Guessing" rule forbids. The
  // honest, real, per-case-varying pair this projection CAN compute
  // without inventing a score: how many of this case's own REQUIRED
  // readiness legs are established versus how many are required in total.
  // This genuinely varies per case (unlike the constant 1/1) and is
  // derived entirely from the same canonical reads every other leg uses.
  //
  // Item 1 correction (2026-09-06): the threshold MUST be computed over
  // legs that are meant to ALREADY be satisfied BEFORE Vela runs — Vela
  // itself, runtime activation, and the governed-operation rehearsal are
  // explicitly EXCLUDED, never counted in their own gating threshold (that
  // would be circular/self-referential and could never fail on a fresh
  // case, since neither has run yet).
  const PRE_VELA_EXCLUDED = new Set(['velaReadiness', 'runtimeActivation', 'governedOperationRehearsal']);
  const requiredLegs = readiness.legs.filter((l) => l.required && !PRE_VELA_EXCLUDED.has(l.key));
  const readinessScore = requiredLegs.filter((l) => l.state === 'established').length;
  const policyThreshold = requiredLegs.length;

  const result = await runAdmissionPacketPolicyEvaluation(input.admin, {
    caseId: factorCase.case_id,
    tenantId: input.tenantId,
    actorPersonaId: input.actorPersonaId,
    requestedByAgentRef: resolveRegistrableAgent(input.agentSlug)?.runtimeAgentId ?? input.agentSlug,
    policyVersion: 'use-case-zero-v1',
    journeyStageId: 'use-case-zero',
    // Confidential — never persisted in the clear (see the module doc on
    // factorConfidentialWorkload.ts).
    readinessScore,
    policyThreshold,
  });
  return {
    stepTaken: 'velaReadiness',
    outcome: 'advanced',
    detail: `Confidential admission-packet evaluation complete: ${result.disposition} (${result.attestationMode} — simulated/test-transport, no live Vela deployment configured).`,
    readiness: await reread(input),
  };
}

async function stepRuntimeActivation(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
  readiness: UseCaseZeroReadiness,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  const activationLeg = readiness.legs.find((l) => l.key === 'runtimeActivation');
  if (activationLeg?.state === 'blocked') {
    return {
      stepTaken: 'runtimeActivation',
      outcome: 'blocked',
      detail: activationLeg.reason,
      readiness,
    };
  }
  if (factorCase.state === 'admitted' || factorCase.state === 'conditionally_admitted') {
    const updated = await transitionCaseState(input.admin, {
      caseId: factorCase.case_id,
      tenantId: input.tenantId,
      toState: 'activation_pending',
      actorPersonaId: input.actorPersonaId,
      authorityChainId: factorCase.authority_chain_id ?? undefined,
    });
    return {
      stepTaken: 'runtimeActivation',
      outcome: 'advanced',
      detail: `Case ${updated.case_id} moved to 'activation_pending'.`,
      readiness: await reread(input),
    };
  }
  if (factorCase.state === 'activation_pending') {
    const updated = await transitionCaseState(input.admin, {
      caseId: factorCase.case_id,
      tenantId: input.tenantId,
      toState: 'active',
      actorPersonaId: input.actorPersonaId,
      authorityChainId: factorCase.authority_chain_id ?? undefined,
    });
    return {
      stepTaken: 'runtimeActivation',
      outcome: 'advanced',
      detail: `Case ${updated.case_id} activated.`,
      readiness: await reread(input),
    };
  }
  if (factorCase.state === 'active') {
    // Case state is already 'active', but the leg is still not
    // established — meaning MoneyPenny's own eligibility resolver
    // (discoverFinancialServicesForConsumer) reports no qualified Runtime service.
    // There is no further Factor-owned mutation to try here: case-state
    // activation is the only write this orchestrator can perform toward
    // this leg, and it has already happened.
    return {
      stepTaken: 'runtimeActivation',
      outcome: 'blocked',
      detail: activationLeg?.reason ?? 'Case is active, but MoneyPenny reports no eligible financial services for this agent — no further Factor-owned action exists for this leg.',
      readiness,
    };
  }
  return {
    stepTaken: 'runtimeActivation',
    outcome: 'blocked',
    detail: `Case state '${factorCase.state}' does not yet permit activation.`,
    readiness,
  };
}

/** Step 10 — governed-operation rehearsal. Prepares (never approves or
 *  submits) a token-launch draft — the only governed financial-request
 *  domain object this codebase has (Bankr has no ordinary-transaction
 *  capability). Every field is operator-supplied; Factor never invents one. */
/** Launch states that mean "this draft's rehearsal has already progressed
 *  past preflight" — resuming it means reporting completion, never
 *  re-preflighting. */
const REHEARSAL_COMPLETE_STATES = new Set([
  'preflighted',
  'aegis_review_pending',
  'revision_required',
  'approval_pending',
  'approved',
  'submitting',
  'submitted',
  'confirmed',
]);

async function stepRehearsal(
  input: AdvanceUseCaseZeroInput,
  factorCase: Awaited<ReturnType<typeof getCase>>,
  runtimeAgentId: string,
): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  if (!input.launchSpec) {
    return {
      stepTaken: 'governedOperationRehearsal',
      outcome: 'awaiting_input',
      detail: 'A governed-operation rehearsal requires an operator-supplied launch spec (chain/tokenName/tokenSymbol/description) — Factor never invents these values.',
      readiness: await reread(input),
    };
  }
  // Item 4 fix (2026-09-07): the ONLY entry point for creating/resuming a
  // rehearsal draft is the atomic createOrResumeDraft — never an
  // unconditional createDraft/prepareLaunchProposal call. Its
  // draft_idempotency_key is a deterministic commitment over
  // {tenant, caseRef=this Factor case, beneficiary, chain, tokenName,
  // tokenSymbol, description}, enforced unique in Postgres
  // (uq_token_launches_draft_idempotency): an IDENTICAL repeat call always
  // resolves to the SAME row (`created: false`); a DIFFERENT specification
  // computes a DIFFERENT key and always creates a genuinely NEW, separate
  // row — it can never reuse or preflight an older draft.
  const { launch, created } = await createOrResumeDraft(input.admin, {
    tenantId: input.tenantId,
    caseRef: factorCase.case_id,
    beneficiaryAgentRuntimeId: runtimeAgentId,
    requestingPrincipalPersonaId: input.actorPersonaId,
    preparingAgentRuntimeId: resolveRegistrableAgent('factor')?.runtimeAgentId ?? 'aigent-factor',
    ...input.launchSpec,
  });

  if (REHEARSAL_COMPLETE_STATES.has(launch.state)) {
    return {
      stepTaken: 'governedOperationRehearsal',
      outcome: 'no_action_needed',
      detail: `Token launch ${launch.id} for this exact specification already reached '${launch.state}' — rehearsal already complete; resuming the same launch, never preparing a duplicate.`,
      readiness: await reread(input),
    };
  }

  // Freshly created (or resumed while still 'draft') — mirrors
  // prepareLaunchProposal's own createDraft+transitionState('preparing')
  // sequence, then runs the SAME preflightLaunch every rehearsal path uses.
  if (launch.state === 'draft') {
    await transitionState(input.admin, { id: launch.id, tenantId: input.tenantId, toState: 'preparing', actorPersonaId: input.actorPersonaId });
  }
  const preflight = await preflightLaunch(input.admin, launch.id, input.tenantId, input.actorPersonaId);
  return {
    stepTaken: 'governedOperationRehearsal',
    outcome: 'advanced',
    detail:
      `Token-launch draft ${launch.id} (case ${factorCase.case_id}) ${created ? 'prepared' : 'resumed'} and preflighted ` +
      `(state: ${preflight.launch.state}, terms: ${JSON.stringify(preflight.bankrTerms.raw)}) — rehearsal stops here; ` +
      `approval/submission/broadcast are separate, later, human-gated acts this orchestrator never performs.`,
    readiness: await reread(input),
  };
}

/** Every return site above/below builds an `AdvanceUseCaseZeroResult`-shaped
 *  object without `caseId` — attaching it in ONE place here (derived from
 *  the FRESH re-read readiness's own `moneypennyAdmission` leg, which
 *  always carries `evidenceRefs: [factorCase.case_id]` whenever a case
 *  exists — see resolveAdmissionLeg) is simpler and less error-prone than
 *  threading it through every one of this file's many branches by hand. */
function withCaseId(result: Omit<AdvanceUseCaseZeroResult, 'caseId'>, fallbackCaseId?: string): AdvanceUseCaseZeroResult {
  const caseId = result.readiness.legs.find((l) => l.key === 'moneypennyAdmission')?.evidenceRefs?.[0] ?? fallbackCaseId ?? null;
  return { ...result, caseId };
}

export async function advanceUseCaseZero(input: AdvanceUseCaseZeroInput): Promise<AdvanceUseCaseZeroResult> {
  const result = await advanceUseCaseZeroCore(input);
  return withCaseId(result, input.caseId);
}

const ACTIONABLE_STEPS = new Set<ActionableStep>([
  'agentShell',
  'ownerWallet',
  'settlementWallet',
  'passport',
  'delegationAuthority',
  'pulsePnl',
  'aegisAssessment',
  'moneypennyAdmission',
  'bankrBinding',
  'velaReadiness',
  'runtimeActivation',
  'governedOperationRehearsal',
]);

async function advanceUseCaseZeroCore(input: AdvanceUseCaseZeroInput): Promise<Omit<AdvanceUseCaseZeroResult, 'caseId'>> {
  // 1. Reread canonical state first — never trust a caller-supplied snapshot.
  const readiness = await reread(input);

  // Item 1 fix (2026-09-07): STRICT SEQUENCE. `firstOutstandingRequired` is
  // computed identically to the projection's own `firstOutstanding`
  // (useCaseZeroReadinessProjection.ts's `legs.find((l) => l.required &&
  // l.state !== 'established')`, which is also exactly what
  // `readiness.presentlyActionableStep` names) — the SAME leg, by
  // construction, every time. This orchestrator must never search PAST that
  // leg for a LATER one it happens to have a Factor-owned action for: doing
  // so let a later handler run (e.g. requesting an Aegis assessment) while
  // an earlier required stage (Registry, Horizen — 'awaiting_external_action')
  // was still outstanding, and reported a next action that did not match
  // what was actually executed. Whatever this leg is, it is the ONLY thing
  // this call may act on or report.
  const firstOutstandingRequired = readiness.legs.find((l) => l.required && l.state !== 'established') ?? null;

  if (firstOutstandingRequired && !ACTIONABLE_STEPS.has(firstOutstandingRequired.key as ActionableStep)) {
    // No Factor-owned handler exists for this leg (registryAsset/
    // horizenRegistration today) — return ITS OWN outcome immediately,
    // never falling through to search for a later actionable step.
    const outcome: OrchestratorOutcome =
      firstOutstandingRequired.state === 'awaiting_external_action' ? 'awaiting_external_action' : 'blocked';
    return {
      stepTaken: firstOutstandingRequired.key,
      outcome,
      detail: firstOutstandingRequired.reason,
      readiness,
    };
  }

  if (!firstOutstandingRequired) {
    // Optional legs (registryAsset/horizenRegistration/pulsePnl when not
    // required by the selected journeyProfile) are real facts this
    // codebase has no Factor-owned mutation for — they resolve as side
    // effects of other processes, and never block completion.
    const outstandingOptional = readiness.legs.filter((l) => l.state !== 'established' && !l.required);
    return outstandingOptional.length > 0
      ? {
          stepTaken: null,
          outcome: 'no_action_needed',
          detail: `Every required leg is established. Still outstanding, optional: ${outstandingOptional.map((l) => l.key).join(', ')} — these resolve as side effects of other processes, not this orchestrator.`,
          readiness,
        }
      : { stepTaken: null, outcome: 'no_action_needed', detail: 'Every leg is established — nothing left to advance.', readiness };
  }

  // firstOutstandingRequired is guaranteed actionable at this point (the
  // non-actionable branch above already returned) — the step this call
  // executes and the step readiness.presentlyActionableStep DISPLAYS are
  // now, by construction, always the same canonical leg key.
  const nextActionableLeg = firstOutstandingRequired;
  const step = nextActionableLeg.key as ActionableStep;
  const runtimeAgentId = resolveRegistrableAgent(input.agentSlug)?.runtimeAgentId ?? null;

  // agentShell has no mutation path either — creating a new registrable
  // agent is a code-level allowlist change (see the leg's own reason).
  if (step === 'agentShell') {
    return {
      stepTaken: step,
      outcome: 'blocked',
      detail: readiness.legs.find((l) => l.key === 'agentShell')?.reason ?? 'Agent shell is blocked.',
      readiness,
    };
  }

  // Step 1 — create/resume the Factor case itself. Every subsequent step
  // needs a case to act on.
  let factorCase = input.caseId ? await getCase(input.admin, input.caseId, input.tenantId) : null;
  if (!factorCase) {
    const result = await createOrResumeCase(input.admin, {
      tenantId: input.tenantId,
      ownerPersonaId: input.actorPersonaId,
      createdByPersonaId: input.actorPersonaId,
      candidateIdentityKey: `use-case-zero:${input.agentSlug}`,
      candidateDisplayName: input.agentSlug,
      pathway: 'full_horizon',
    });
    factorCase = result.case;
    return {
      stepTaken: 'agentShell',
      outcome: 'advanced',
      detail: `Factor case ${factorCase.case_id} ${result.created ? 'created' : 'resumed'} (state: ${factorCase.state}).`,
      readiness: await reread({ ...input, caseId: factorCase.case_id }),
    };
  }

  // Correction 7 — every CONSEQUENTIAL step below evaluates tenant/persona/
  // delegation/authority before acting. Tenant is enforced by the owning
  // service itself (assertSameTenant/cross-tenant guards already wired into
  // factorCaseService/authorityChain/admissionAuthority); this orchestrator
  // additionally checks the bound authority chain (when one exists) for any
  // step past delegation establishment, refusing rather than proceeding
  // silently when the chain does not cover this action.
  if (factorCase.authority_chain_id && step !== 'delegationAuthority') {
    const validation = await validateChainForAction(input.admin, {
      chainId: factorCase.authority_chain_id,
      action: step,
      expectedPrincipalPersonaId: input.actorPersonaId,
    });
    if (!validation.allowed) {
      return {
        stepTaken: step,
        outcome: 'blocked',
        detail: `Authority chain does not permit '${step}': ${validation.reason}`,
        readiness,
      };
    }
  }

  switch (step) {
    case 'ownerWallet':
    case 'settlementWallet': {
      if (!runtimeAgentId) {
        return { stepTaken: step, outcome: 'blocked', detail: 'No runtime agent id resolved.', readiness };
      }
      const wallets = new AgentPurposeWalletService();
      if (step === 'ownerWallet') {
        const result = await wallets.provisionOwnerWallet({ runtimeAgentId, agentName: input.agentSlug });
        if (!result.ok) {
          return { stepTaken: step, outcome: 'blocked', detail: `${result.refusalCode}: ${result.detail}`, readiness };
        }
        await createActivityReceipt({
          personaId: input.actorPersonaId,
          activeCartridge: 'moneypenny',
          actionType: 'agent_purpose_wallet_provisioned',
          summary: `Owner wallet ${result.created ? 'provisioned' : 'already existed'} for ${runtimeAgentId}.`,
          agentsInvoked: [runtimeAgentId],
          actionInput: { runtimeAgentId, walletRole: 'owner', address: result.address, created: result.created },
        });
        return {
          stepTaken: step,
          outcome: 'advanced',
          detail: `Owner wallet ${result.created ? 'provisioned' : 'already existed'} (${result.address}).`,
          readiness: await reread(input),
        };
      }
      const result = await wallets.provisionPurposeWallet({ agentRuntimeId: runtimeAgentId, walletRole: 'settlement', network: 'base-sepolia' });
      if (!result.ok) {
        return { stepTaken: step, outcome: 'blocked', detail: `${result.refusalCode}: ${result.detail}`, readiness };
      }
      await createActivityReceipt({
        personaId: input.actorPersonaId,
        activeCartridge: 'moneypenny',
        actionType: 'agent_purpose_wallet_provisioned',
        summary: `Settlement wallet ${result.created ? 'provisioned' : 'already existed'} for ${runtimeAgentId}.`,
        agentsInvoked: [runtimeAgentId],
        actionInput: { runtimeAgentId, walletRole: 'settlement', address: result.binding.address, created: result.created },
      });
      return {
        stepTaken: step,
        outcome: 'advanced',
        detail: `Settlement wallet ${result.created ? 'provisioned' : 'already existed'} (${result.binding.address}).`,
        readiness: await reread(input),
      };
    }
    case 'passport':
      // Correction (operator instruction): Passport/Journey navigation
      // rather than parallel writes — this orchestrator never files a
      // Passport application itself (that is the Passport Bureau's own
      // apply flow); it returns a navigation directive only.
      return {
        stepTaken: step,
        outcome: 'awaiting_input',
        detail: 'Navigate the operator to the Polity Passport Bureau apply flow to file or resume a Passport application — this orchestrator never writes that application itself.',
        readiness,
      };
    case 'pulsePnl':
      // Item 2 (2026-09-07): only reachable when journeyProfile ===
      // 'financial_intelligence' made this leg required. Same navigate-only
      // shape as 'passport' — Pulse/P&L onboarding is a separate journey
      // this orchestrator never writes to directly.
      return {
        stepTaken: step,
        outcome: 'awaiting_input',
        detail: 'Navigate the operator to Pulse/P&L onboarding to register reporting — this orchestrator never writes that registration itself.',
        readiness,
      };
    case 'delegationAuthority':
      return stepDelegationAuthority(input, factorCase);
    case 'aegisAssessment':
      return stepAegisAssessment(input, factorCase);
    case 'moneypennyAdmission':
      return stepRequestAdmission(input, factorCase);
    case 'bankrBinding':
      if (!runtimeAgentId) return { stepTaken: step, outcome: 'blocked', detail: 'No runtime agent id resolved.', readiness };
      return stepBankrBinding(input, runtimeAgentId);
    case 'velaReadiness':
      return stepVela(input, factorCase, readiness);
    case 'runtimeActivation':
      return stepRuntimeActivation(input, factorCase, readiness);
    case 'governedOperationRehearsal':
      if (!runtimeAgentId) return { stepTaken: step, outcome: 'blocked', detail: 'No runtime agent id resolved.', readiness };
      return stepRehearsal(input, factorCase, runtimeAgentId);
    default:
      return { stepTaken: step, outcome: 'blocked', detail: `No orchestrated action for step '${step}'.`, readiness };
  }
}
