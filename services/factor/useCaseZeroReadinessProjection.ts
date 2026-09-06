/**
 * Use Case Zero — provider-neutral constitutional financial-agent
 * establishment readiness projection (2026-09-06).
 *
 * ONE canonical, READ-ONLY projection both entry paths ("Bring my own
 * agent" and "Create and establish an agent") converge on. Composes
 * EXISTING canonical services only — never a second Journey state machine,
 * service catalog, provider binding, wallet model, approval system or
 * receipt system. Every leg below names the exact service it reads and
 * reports `verified`/`reason`/`evidenceRefs` honestly; a leg that cannot be
 * read (missing row, unresolvable dependency) reports `verified: false`
 * with a stated reason — this function never infers completion from prose
 * or from Factor's own case status alone, and never writes anything.
 *
 * Composed sources (reuse, not duplication):
 *   - operator/aigentMe context   -> services/identity/getActivePersona.ts
 *   - agent shell / registrable   -> services/horizen/registrableAgents.ts
 *   - owner/control wallet        -> services/wallet/agentPurposeWalletService.ts
 *   - settlement/x402 wallet      -> services/wallet/agentPurposeWalletService.ts
 *   - Passport state              -> services/passport/passportStatusRead.ts
 *   - delegation/authority chain  -> services/delegation/delegationGrantStore.ts
 *                                    + services/factor/authorityChain.ts
 *   - iQube Registry asset        -> services/registry/persistence.ts
 *   - Horizen/ERC-8004 registration -> services/horizen/agentRegistrationBinding.ts
 *   - Pulse/P&L status            -> services/horizen/pnlEvidenceRead.ts
 *   - Aegis assessment            -> services/aegis/aegisAssessmentService.ts
 *   - MoneyPenny admission        -> services/factor/factorCaseService.ts (case.state)
 *   - Bankr/provider binding      -> services/financialServices/providers/providerWalletBinding.ts
 *   - Vela confidential-compute   -> services/factor/factorConfidentialWorkload.ts (evidence items)
 *   - runtime activation          -> services/factor/factorCaseService.ts (case.state === 'active')
 *   - governed-operation rehearsal -> services/factor/tokenLaunchService.ts (draft presence) —
 *     the only governed financial-request domain object that exists today
 *     (Bankr has no ordinary-transaction capability; see boundary note).
 *
 * Server-side only. Never persist confidential inputs. Never approve
 * anything itself — this is a read, not a decision.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';
import { getPassportApplicationStatus } from '@/services/passport/passportStatusRead';
import { readActiveGrantForAgent } from '@/services/delegation/delegationGrantStore';
import { getAsset } from '@/services/registry/persistence';
import { resolvePnlEvidenceForAgent } from '@/services/horizen/pnlEvidenceRead';
import { getCurrentAssessment } from '@/services/aegis/aegisAssessmentService';
import { getCase, listEvidenceForCase, type FactorCaseRow } from '@/services/factor/factorCaseService';
import { getProviderWalletBinding } from '@/services/financialServices/providers/providerWalletBinding';
import { FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND } from '@/services/factor/factorConfidentialWorkload';

export type UseCaseZeroPath = 'bring_own_agent' | 'create_and_establish';

export type ReadinessLegMode = 'simulated' | 'live' | 'n/a';

export interface ReadinessLeg {
  /** Stable key, also the handler/action this leg's own next step maps to. */
  key: string;
  label: string;
  verified: boolean;
  mode: ReadinessLegMode;
  reason: string;
  evidenceRefs: string[];
  /** Which real service produced this leg — for provenance, never fabricated. */
  source: string;
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
}

export interface UseCaseZeroReadiness {
  path: UseCaseZeroPath;
  agentSlug: string;
  legs: ReadinessLeg[];
  completedSteps: string[];
  presentlyActionableStep: string | null;
  blockers: string[];
  /** The exact next action the operator can take — a handlerId from
   *  services/factor/factorActionHandlerRegistry.ts, never a bare label. */
  nextAction: { handlerId: string; label: string } | null;
  requiresApproval: boolean;
  requiredAuthority: string[];
}

function leg(partial: Omit<ReadinessLeg, 'evidenceRefs'> & { evidenceRefs?: string[] }): ReadinessLeg {
  return { evidenceRefs: [], ...partial };
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
    verified: Boolean(input.actorPersonaId),
    mode: 'live',
    reason: input.actorPersonaId
      ? 'An accountable operator persona is bound to this consultation.'
      : 'No operator persona is bound — this projection requires an authenticated caller.',
    source: 'services/identity/getActivePersona.ts (caller-resolved)',
  });
}

function resolveAgentShellLeg(agent: RegistrableAgentConfig | null, agentSlug: string): ReadinessLeg {
  if (agent) {
    return leg({
      key: 'agentShell',
      label: 'Agent shell (registrable identity)',
      verified: true,
      mode: 'live',
      reason: `'${agentSlug}' is a registered runtime agent (runtimeAgentId '${agent.runtimeAgentId}').`,
      source: 'services/horizen/registrableAgents.ts',
      evidenceRefs: [agent.runtimeAgentId],
    });
  }
  return leg({
    key: 'agentShell',
    label: 'Agent shell (registrable identity)',
    verified: false,
    mode: 'n/a',
    reason:
      `'${agentSlug}' is not in the REGISTRABLE_AGENTS allowlist. Creating a wholly new ` +
      `Horizen-registrable agent shell is a code-level allowlist change, not a runtime ` +
      `provisioning action — this capability boundary is reported honestly rather than papered over.`,
    source: 'services/horizen/registrableAgents.ts',
  });
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
    verified: Boolean(ownerAddress),
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
  const settlementLeg = leg({
    key: 'settlementWallet',
    label: 'Settlement/x402 wallet',
    verified: Boolean(settlementBinding && settlementBinding.status === 'active'),
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

async function resolvePassportLeg(admin: SupabaseClient, personaId: string): Promise<ReadinessLeg> {
  try {
    const applications = await getPassportApplicationStatus(admin, personaId, 5);
    const latest = applications[0] ?? null;
    const issued = latest?.applicationStatus === 'issued' || latest?.applicationStatus === 'approved';
    return leg({
      key: 'passport',
      label: 'Passport state',
      verified: issued,
      mode: latest ? 'live' : 'n/a',
      reason: latest
        ? `Latest application status: ${latest.applicationStatus}.`
        : 'No Passport application filed yet for this operator.',
      source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
      evidenceRefs: latest ? [latest.applicationId] : [],
    });
  } catch (e) {
    return leg({
      key: 'passport',
      label: 'Passport state',
      verified: false,
      mode: 'n/a',
      reason: `Passport read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/passport/passportStatusRead.ts::getPassportApplicationStatus',
    });
  }
}

async function resolveDelegationLeg(personaId: string, agentRootDid: string | null): Promise<ReadinessLeg> {
  if (!agentRootDid) {
    return leg({
      key: 'delegationAuthority',
      label: 'Delegation / authority chain',
      verified: false,
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
      verified: Boolean(grant),
      mode: grant ? 'live' : 'n/a',
      reason: grant
        ? `Active delegation grant found (grant ${grant.grant_id ?? 'id unknown'}).`
        : 'No active delegation grant found for this operator/agent pair.',
      source: 'services/delegation/delegationGrantStore.ts::readActiveGrantForAgent',
      evidenceRefs: grant ? [String((grant as { grant_id?: string }).grant_id ?? '')].filter(Boolean) : [],
    });
  } catch (e) {
    return leg({
      key: 'delegationAuthority',
      label: 'Delegation / authority chain',
      verified: false,
      mode: 'n/a',
      reason: `Delegation read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/delegation/delegationGrantStore.ts::readActiveGrantForAgent',
    });
  }
}

async function resolveRegistryAssetLeg(aigentQubeId: string | null): Promise<ReadinessLeg> {
  if (!aigentQubeId) {
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      verified: false,
      mode: 'n/a',
      reason: 'This agent has no aigentQubeId — no registry_assets row can exist for it yet.',
      source: 'services/registry/persistence.ts::getAsset',
    });
  }
  try {
    const asset = await getAsset(aigentQubeId);
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      verified: Boolean(asset),
      mode: asset ? 'live' : 'n/a',
      reason: asset ? `Registry asset '${aigentQubeId}' exists.` : `No registry_assets row found for '${aigentQubeId}'.`,
      source: 'services/registry/persistence.ts::getAsset',
      evidenceRefs: asset ? [aigentQubeId] : [],
    });
  } catch (e) {
    return leg({
      key: 'registryAsset',
      label: 'iQube Registry asset',
      verified: false,
      mode: 'n/a',
      reason: `Registry asset read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/registry/persistence.ts::getAsset',
    });
  }
}

async function resolveHorizenLeg(admin: SupabaseClient, agent: RegistrableAgentConfig): Promise<ReadinessLeg> {
  try {
    const state = await resolveAgentRegistrationState(admin, agent);
    return leg({
      key: 'horizenRegistration',
      label: 'Horizen/ERC-8004 registration',
      verified: state.registered,
      mode: state.registered ? 'live' : 'n/a',
      reason: state.registered
        ? `Registered on ${state.network ?? 'an unspecified network'} (tokenId ${state.tokenId}).`
        : `Not yet registered (source: ${state.source}; audit gaps: ${state.auditGaps.join('; ') || 'none stated'}).`,
      source: 'services/horizen/agentRegistrationBinding.ts::resolveAgentRegistrationState',
      evidenceRefs: state.tokenId ? [state.tokenId] : state.evidenceRefs,
    });
  } catch (e) {
    return leg({
      key: 'horizenRegistration',
      label: 'Horizen/ERC-8004 registration',
      verified: false,
      mode: 'n/a',
      reason: `Registration-state read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/horizen/agentRegistrationBinding.ts::resolveAgentRegistrationState',
    });
  }
}

async function resolvePulsePnlLeg(runtimeAgentId: string): Promise<ReadinessLeg> {
  try {
    const evidence = await resolvePnlEvidenceForAgent(runtimeAgentId);
    return leg({
      key: 'pulsePnl',
      label: 'Pulse/P&L status',
      verified: evidence.serviceRegistered && evidence.serviceVerified,
      mode: evidence.serviceRegistered ? 'live' : 'n/a',
      reason: `serviceRegistered=${evidence.serviceRegistered} (${evidence.serviceRegisteredDvnStatus ?? 'no DVN status'}); serviceVerified=${evidence.serviceVerified} (${evidence.serviceVerifiedDvnStatus ?? 'no DVN status'}).`,
      source: 'services/horizen/pnlEvidenceRead.ts::resolvePnlEvidenceForAgent',
    });
  } catch (e) {
    return leg({
      key: 'pulsePnl',
      label: 'Pulse/P&L status',
      verified: false,
      mode: 'n/a',
      reason: `Pulse/P&L read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/horizen/pnlEvidenceRead.ts::resolvePnlEvidenceForAgent',
    });
  }
}

async function resolveAegisLeg(admin: SupabaseClient, caseId: string | undefined): Promise<ReadinessLeg> {
  if (!caseId) {
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      verified: false,
      mode: 'n/a',
      reason: 'No Factor case yet — Aegis assesses a case, not a bare agent slug.',
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
    });
  }
  try {
    const assessment = await getCurrentAssessment(admin, 'factor_case', caseId);
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      verified: assessment?.state === 'ratified',
      mode: assessment ? 'live' : 'n/a',
      reason: assessment
        ? `Assessment ${assessment.assessment_id} state: ${assessment.state}${assessment.decision ? `, decision: ${assessment.decision}` : ''}.`
        : 'No Aegis assessment exists yet for this case.',
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
      evidenceRefs: assessment ? [assessment.assessment_id] : [],
    });
  } catch (e) {
    return leg({
      key: 'aegisAssessment',
      label: 'Aegis assessment',
      verified: false,
      mode: 'n/a',
      reason: `Aegis read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/aegis/aegisAssessmentService.ts::getCurrentAssessment',
    });
  }
}

function resolveAdmissionLeg(factorCase: FactorCaseRow | null): ReadinessLeg {
  const admitted = factorCase?.state === 'admitted' || factorCase?.state === 'conditionally_admitted';
  return leg({
    key: 'moneypennyAdmission',
    label: 'MoneyPenny admission',
    verified: admitted,
    mode: factorCase ? 'live' : 'n/a',
    reason: factorCase
      ? `Case state: ${factorCase.state}.`
      : 'No Factor case yet — nothing for MoneyPenny to admit.',
    source: 'services/factor/factorCaseService.ts (case.state, via services/moneypenny/admissionAuthority.ts::decideAdmission)',
    evidenceRefs: factorCase ? [factorCase.case_id] : [],
  });
}

async function resolveBankrLeg(admin: SupabaseClient, tenantId: string, runtimeAgentId: string): Promise<ReadinessLeg> {
  try {
    const binding = await getProviderWalletBinding(admin, tenantId, runtimeAgentId, 'bankr');
    return leg({
      key: 'bankrBinding',
      label: 'Bankr/provider binding',
      verified: binding?.status === 'active',
      mode: binding ? 'simulated' : 'n/a',
      reason: binding
        ? `Provider-wallet binding status: ${binding.status} (Bankr's deterministic fake transport — no live BANKR_*_API_KEY configured).`
        : 'No Bankr provider-wallet binding yet for this agent.',
      source: 'services/financialServices/providers/providerWalletBinding.ts::getProviderWalletBinding',
      evidenceRefs: binding ? [binding.id ?? ''].filter(Boolean) : [],
    });
  } catch (e) {
    return leg({
      key: 'bankrBinding',
      label: 'Bankr/provider binding',
      verified: false,
      mode: 'n/a',
      reason: `Bankr-binding read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/financialServices/providers/providerWalletBinding.ts::getProviderWalletBinding',
    });
  }
}

async function resolveVelaLeg(admin: SupabaseClient, caseId: string | undefined, tenantId: string): Promise<ReadinessLeg> {
  if (!caseId) {
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      verified: false,
      mode: 'n/a',
      reason: 'No Factor case yet — the admission-packet confidential workload is bound to a case.',
      source: 'services/factor/factorConfidentialWorkload.ts',
    });
  }
  try {
    const evidenceItems = await listEvidenceForCase(admin, caseId, tenantId);
    const items = (evidenceItems ?? []) as Array<{ kind: string; status: string; payload?: { attestationMode?: string } }>;
    const projectionEvidence = items.find((i) => i.kind === FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND);
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      verified: projectionEvidence?.status === 'supplied',
      mode: projectionEvidence ? 'simulated' : 'n/a',
      reason: projectionEvidence
        ? `Confidential admission-packet evaluation recorded (attestationMode: ${projectionEvidence.payload?.attestationMode ?? 'unknown'} — no live Vela deployment configured; this is Vela's deterministic test transport, never asserted as live).`
        : 'No confidential-compute evidence recorded yet for this case.',
      source: 'services/factor/factorConfidentialWorkload.ts (factor_evidence_items)',
    });
  } catch (e) {
    return leg({
      key: 'velaReadiness',
      label: 'Vela confidential-compute readiness',
      verified: false,
      mode: 'n/a',
      reason: `Vela-evidence read failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'services/factor/factorConfidentialWorkload.ts',
    });
  }
}

function resolveRuntimeActivationLeg(factorCase: FactorCaseRow | null): ReadinessLeg {
  return leg({
    key: 'runtimeActivation',
    label: 'MoneyPenny runtime activation',
    verified: factorCase?.state === 'active',
    mode: factorCase ? 'live' : 'n/a',
    reason: factorCase
      ? `Case state: ${factorCase.state}.`
      : 'No Factor case yet — nothing to activate.',
    source: 'services/factor/factorCaseService.ts (case.state)',
    evidenceRefs: factorCase ? [factorCase.case_id] : [],
  });
}

function resolveRehearsalLeg(factorCase: FactorCaseRow | null): ReadinessLeg {
  // No ordinary-transaction domain object exists anywhere in this codebase
  // (types/financialServices.ts's own boundary statement) — the only real
  // governed-financial-request object today is a token-launch draft
  // (services/factor/tokenLaunchService.ts). This leg reports that
  // boundary honestly rather than claiming a general rehearsal capability.
  const activated = factorCase?.state === 'active';
  return leg({
    key: 'governedOperationRehearsal',
    label: 'Governed financial-operation rehearsal',
    verified: false,
    mode: 'n/a',
    reason: activated
      ? 'Runtime is activated. The only governed financial-request rehearsal available today is a Bankr token-launch preparation (no ordinary transfer/payment capability exists in this codebase) — run the Bankr readiness/preflight actions to rehearse.'
      : 'Runtime activation must complete before a governed-operation rehearsal can be prepared.',
    source: 'services/factor/tokenLaunchService.ts (capability boundary)',
  });
}

export async function projectUseCaseZeroReadiness(input: UseCaseZeroReadinessInput): Promise<UseCaseZeroReadiness> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  const runtimeAgentId = agent?.runtimeAgentId ?? null;

  let factorCase: FactorCaseRow | null = null;
  if (input.caseId) {
    try {
      factorCase = await getCase(input.admin, input.caseId, input.tenantId);
    } catch {
      factorCase = null;
    }
  }

  const legs: ReadinessLeg[] = [
    await resolveOperatorContextLeg(input),
    resolveAgentShellLeg(agent, input.agentSlug),
    ...(runtimeAgentId ? await resolveWalletLegs(runtimeAgentId) : [
      leg({ key: 'ownerWallet', label: 'Owner/control wallet', verified: false, mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/wallet/agentPurposeWalletService.ts' }),
      leg({ key: 'settlementWallet', label: 'Settlement/x402 wallet', verified: false, mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/wallet/agentPurposeWalletService.ts' }),
    ]),
    await resolvePassportLeg(input.admin, input.actorPersonaId),
    await resolveDelegationLeg(input.actorPersonaId, factorCase?.candidate_agent_root_did ?? null),
    await resolveRegistryAssetLeg(agent?.aigentQubeId ?? null),
    agent
      ? await resolveHorizenLeg(input.admin, agent)
      : leg({ key: 'horizenRegistration', label: 'Horizen/ERC-8004 registration', verified: false, mode: 'n/a', reason: 'No registrable agent resolved yet.', source: 'services/horizen/agentRegistrationBinding.ts' }),
    runtimeAgentId
      ? await resolvePulsePnlLeg(runtimeAgentId)
      : leg({ key: 'pulsePnl', label: 'Pulse/P&L status', verified: false, mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/horizen/pnlEvidenceRead.ts' }),
    await resolveAegisLeg(input.admin, input.caseId),
    resolveAdmissionLeg(factorCase),
    runtimeAgentId
      ? await resolveBankrLeg(input.admin, input.tenantId, runtimeAgentId)
      : leg({ key: 'bankrBinding', label: 'Bankr/provider binding', verified: false, mode: 'n/a', reason: 'No runtime agent id resolved yet.', source: 'services/financialServices/providers/providerWalletBinding.ts' }),
    await resolveVelaLeg(input.admin, input.caseId, input.tenantId),
    resolveRuntimeActivationLeg(factorCase),
    resolveRehearsalLeg(factorCase),
  ];

  const completedSteps = legs.filter((l) => l.verified).map((l) => l.key);
  const firstUnverified = legs.find((l) => !l.verified) ?? null;

  const nextActionByKey: Record<string, { handlerId: string; label: string }> = {
    operatorContext: { handlerId: 'factor:explain', label: 'Sign in as the accountable operator persona' },
    agentShell: { handlerId: 'factor:case-service', label: 'Inspect or create the constitutional agent shell (Factor case)' },
    ownerWallet: { handlerId: 'factor:ucz-bring-own-agent', label: 'Provision the owner/control wallet' },
    settlementWallet: { handlerId: 'factor:ucz-bring-own-agent', label: 'Provision the settlement/x402 wallet' },
    passport: { handlerId: 'factor:ucz-bring-own-agent', label: 'File or resume the Passport application' },
    delegationAuthority: { handlerId: 'factor:authority-chain', label: 'Establish an authority chain / delegation grant' },
    registryAsset: { handlerId: 'factor:case-service', label: 'Await registry asset ingestion' },
    horizenRegistration: { handlerId: 'factor:horizen-registration-binding', label: 'Check or advance Horizen registration' },
    pulsePnl: { handlerId: 'factor:ucz-bring-own-agent', label: 'Register Pulse/P&L reporting' },
    aegisAssessment: { handlerId: 'factor:aegis-referral-navigation', label: 'Request an independent Aegis assessment' },
    moneypennyAdmission: { handlerId: 'factor:case-service', label: 'Await MoneyPenny admission decision' },
    bankrBinding: { handlerId: 'factor:bankr-binding', label: 'Inspect or provision the Bankr provider-wallet binding' },
    velaReadiness: { handlerId: 'factor:vela-admission-projection', label: 'Run the admission-packet confidential policy evaluation' },
    runtimeActivation: { handlerId: 'factor:case-service', label: 'Activate the MoneyPenny runtime for this agent' },
    governedOperationRehearsal: { handlerId: 'factor:bankr-preflight', label: 'Rehearse a governed token-launch preparation' },
  };

  const presentlyActionableStep = firstUnverified?.key ?? null;
  const nextAction = firstUnverified ? nextActionByKey[firstUnverified.key] ?? null : null;
  const blockers = firstUnverified
    ? [firstUnverified.reason]
    : [];

  return {
    path: input.path,
    agentSlug: input.agentSlug,
    legs,
    completedSteps,
    presentlyActionableStep,
    blockers,
    nextAction,
    requiresApproval: Boolean(
      firstUnverified &&
        ['moneypennyAdmission', 'aegisAssessment', 'governedOperationRehearsal'].includes(firstUnverified.key),
    ),
    requiredAuthority: ['constitutional-agent-establishment-readiness'],
  };
}
