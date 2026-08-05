/**
 * Agent Bench read model (2026-08-05 canonical Agent Bench plan, §5) — the
 * ONE join across Marketa's candidate model, the extended Access &
 * Invitations mechanism, the journey's admission-fact reader, and the
 * registry's publication/trust state. This module owns none of that
 * state — it only projects it. Every write still goes through its own
 * existing surface (the Journey, the Passport Review Queue, the Factory).
 *
 * ── The real constraint this respects ──────────────────────────────────────
 *
 * `resolveAgentAdmissionState` requires a `RegistrableAgentConfig`
 * (services/horizen/registrableAgents.ts) — a 2-entry, hand-maintained
 * config (MoneyPenny, Nakamoto), not a dynamic registry. A Marketa
 * candidate only resolves real admission facts once a steward has
 * explicitly set `runtimeAgentId` on it (linking it to that config) — this
 * is Phase E's "registry adapter standardization" territory, not assumed
 * solved here. A candidate with no `runtimeAgentId` reports
 * `admission: null` honestly — never a guessed or defaulted admission
 * state.
 *
 * ── Service Ready, computed against verifiable facts only ──────────────────
 *
 * Mirrors the plan's §5 corrected definition. Two of the eight listed
 * conditions (Standing eligibility; callable-runtime/policy check) have no
 * existing single-call reader this module could cite honestly yet — they
 * are surfaced as `unresolved` rather than assumed true or folded silently
 * into `serviceReady`. `serviceReady` here is therefore a LOWER BOUND
 * (necessary conditions verified are all true) — never asserted as the full
 * list until those two readers exist.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateAgent } from './types';
import { resolveAgentAdmissionState, type AgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { getAsset } from '@/services/registry/persistence';
import { listAgreements, type ConstitutionalAgreementRow } from '@/services/constitutional/constitutionalAgreement';

export type BenchLifecycleState = 'candidate' | 'invited' | 'in-admission' | 'service-ready' | 'engaged';

export interface AgentBenchRow {
  candidateId: string;
  name: string;
  registryProvider: CandidateAgent['registryProvider'];
  registryNetwork: CandidateAgent['registryNetwork'];
  onChainAgentId: CandidateAgent['onChainAgentId'];
  capabilities: string[];
  overallPriorityScore: number;
  pulseState: CandidateAgent['pulseState'];
  pnlState: CandidateAgent['pnlState'];
  lifecycleState: BenchLifecycleState;
  /** Null when this candidate has no `runtimeAgentId` link yet — genuinely unresolved, not "not started." */
  admission: AgentAdmissionState | null;
  registry: { publicationStatus: string; trustBand: string } | null;
  /** Lower bound only — see this module's header comment. */
  serviceReady: boolean;
  serviceReadyUnresolved: string[];
  /** A SEPARATE state from `serviceReady` — never folded into it (2026-08-05 correction). */
  fsVerified: boolean;
  agreements: ConstitutionalAgreementRow[];
}

function computeFsVerified(candidate: CandidateAgent): boolean {
  return candidate.pulseState === 'enabled' && candidate.pnlState === 'enabled';
}

function computeServiceReady(admission: AgentAdmissionState | null, registryPublished: boolean | null) {
  const unresolved: string[] = [];
  if (!admission) {
    unresolved.push('admission facts not resolvable — no runtimeAgentId link yet');
  } else {
    if (admission.sponsorshipRecorded === undefined) unresolved.push('sponsorship read failed');
    if (admission.delegatePassportIssued === undefined) unresolved.push('delegate-passport read failed');
    if (admission.delegationActive === undefined) unresolved.push('delegation read failed');
  }
  if (registryPublished === null) unresolved.push('registry publication state unread');
  unresolved.push('Standing eligibility check not yet wired to this read model');
  unresolved.push('callable-runtime / policy-requirements check not yet wired to this read model');

  const verifiedConditionsHold =
    admission?.sponsorshipRecorded === true &&
    admission?.delegatePassportIssued === true &&
    admission?.delegationActive === true &&
    registryPublished === true;

  return { serviceReady: verifiedConditionsHold, unresolved };
}

function deriveLifecycleState(args: {
  hasInvitation: boolean;
  admission: AgentAdmissionState | null;
  serviceReady: boolean;
  agreements: ConstitutionalAgreementRow[];
}): BenchLifecycleState {
  const engaged = args.agreements.some((a) => a.status === 'authorized' || a.status === 'executed' || a.status === 'settled');
  if (engaged) return 'engaged';
  if (args.serviceReady) return 'service-ready';
  const admissionStarted =
    args.admission &&
    (args.admission.sponsorshipRecorded === true || args.admission.delegatePassportIssued === true || args.admission.delegationActive === true);
  if (admissionStarted) return 'in-admission';
  if (args.hasInvitation) return 'invited';
  return 'candidate';
}

export async function buildAgentBenchRow(
  admin: SupabaseClient,
  candidate: CandidateAgent,
  opts: { hasInvitation: boolean },
): Promise<AgentBenchRow> {
  const registrableAgent = resolveRegistrableAgentByRuntimeId(candidate.runtimeAgentId);

  const [admission, registryAsset] = await Promise.all([
    registrableAgent
      ? resolveAgentAdmissionState(admin, registrableAgent).catch(() => null)
      : Promise.resolve(null),
    registrableAgent
      ? getAsset(registrableAgent.aigentQubeId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const registryPublished = registryAsset ? registryAsset.publicationStatus === 'published' : null;
  const { serviceReady, unresolved } = computeServiceReady(admission, registryPublished);

  const allAgreements = await listAgreements().catch(() => [] as ConstitutionalAgreementRow[]);
  const agreements = registrableAgent
    ? allAgreements.filter((a) => a.selectedAgentRef === registrableAgent.runtimeAgentId)
    : [];

  return {
    candidateId: candidate.id,
    name: candidate.name,
    registryProvider: candidate.registryProvider,
    registryNetwork: candidate.registryNetwork,
    onChainAgentId: candidate.onChainAgentId,
    capabilities: candidate.capabilities,
    overallPriorityScore: candidate.scores.overallPriorityScore,
    pulseState: candidate.pulseState,
    pnlState: candidate.pnlState,
    lifecycleState: deriveLifecycleState({ hasInvitation: opts.hasInvitation, admission, serviceReady, agreements }),
    admission,
    registry: registryAsset ? { publicationStatus: registryAsset.publicationStatus, trustBand: registryAsset.trustBand } : null,
    serviceReady,
    serviceReadyUnresolved: unresolved,
    fsVerified: computeFsVerified(candidate),
    agreements,
  };
}
