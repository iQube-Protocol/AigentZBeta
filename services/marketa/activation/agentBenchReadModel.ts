/**
 * Agent Bench read model (2026-08-05 canonical Agent Bench plan, §5;
 * extended 2026-08-05 per the "Agent Bench — Canonical Agent Lifecycle
 * Brief" — Aigent Nakamoto as the golden-path reference) — the ONE join
 * across Marketa's candidate model, the extended Access & Invitations
 * mechanism, the journey's admission-fact reader, the Horizen registration
 * resolver, the receipt-based Pulse/P&L reader, and the registry's
 * publication/trust state. This module owns none of that state — it only
 * projects it. Every write still goes through its own existing surface
 * (the Journey, the Passport Review Queue, the Factory).
 *
 * ── Two subject kinds, one row shape (operator brief, 2026-08-05) ───────────
 *
 * A Bench row can originate from a Marketa candidate (discovered via the
 * activation pipeline) OR directly from a `RegistrableAgentConfig`
 * (services/horizen/registrableAgents.ts) when no Marketa candidate row
 * links to it yet. Aigent Nakamoto has NO Marketa candidate row today — she
 * predates Marketa's discovery pipeline — and the brief is explicit: do not
 * create synthetic Nakamoto data and do not run a second admission process.
 * So her row is built straight from the same real services every other row
 * uses (`resolveAgentAdmissionState`, `resolveAgentRegistrationState`,
 * `getAsset`, receipt-scoped Pulse/P&L, `listAgreements`) — never a
 * fabricated Marketa candidate. `AgentBenchRow.source` discloses which path
 * produced the row; nothing is hidden.
 *
 * ── Multi-runtime membership, not a single scalar (operator brief) ─────────
 *
 * `serviceReady`/`fsVerified` booleans are gone. An agent may apply to,
 * qualify for, or operate in more than one runtime — `runtimeMemberships`
 * is a collection so a second runtime is additive, never a second scalar to
 * reconcile. Only "Financial Services" has a real backing today (the only
 * runtime this codebase actually implements); a future runtime is a new
 * array entry, not a redesign.
 *
 * ── `lifecycleState` stays a single canonical value ─────────────────────────
 *
 * The six Bench tabs (Discover/Invite/Sponsor/Admit/Deploy/Operate) are
 * filtered VIEWS over one persistent set of rows — a row is never deleted
 * or excluded from the response; it simply reports whichever single
 * `lifecycleState` its real facts currently support, and moves between tabs
 * as those facts change. Nothing here removes a row once it advances.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateAgent, ExternalRegistryProvider } from './types';
import { resolveAgentAdmissionState, type AgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { resolveRegistrableAgentByRuntimeId, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { getAsset } from '@/services/registry/persistence';
import { findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import { listAgreements, type ConstitutionalAgreementRow } from '@/services/constitutional/constitutionalAgreement';
import type { CapabilityDescriptor } from '@/types/registryIngestion';

export type BenchLifecycleState = 'candidate' | 'invited' | 'in-admission' | 'service-ready' | 'engaged';

export type RuntimeMembershipStatus =
  | 'not-applied'
  | 'applying'
  | 'pending-review'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'revoked';

export interface RuntimeMembership {
  runtimeId: string;
  runtimeLabel: string;
  status: RuntimeMembershipStatus;
  eligibility: { satisfied: string[]; outstanding: string[] };
  approvedAt?: string;
  activatedAt?: string;
}

/** A Bench row's origin — disclosed, never hidden (operator brief). */
export type BenchRowSource = 'marketa' | 'registrable-agent';

/** Input to `buildAgentBenchRow` — one row, two possible real sources. */
export type BenchSubject =
  | { kind: 'marketa'; candidate: CandidateAgent }
  | { kind: 'registrable-agent'; agent: RegistrableAgentConfig };

export interface AgentBenchRow {
  candidateId: string;
  name: string;
  source: BenchRowSource;
  registryProvider: ExternalRegistryProvider | null;
  registryNetwork: string | null;
  onChainAgentId: string | null;
  capabilities: string[];
  /**
   * The same capabilities as full descriptors (name + tags), when a registry
   * asset backs this row — additive to `capabilities` (never breaking; that
   * field stays name-only for existing callers). Empty when there is no
   * registry asset yet. Feed this to `capabilitySignalFromDescriptors` +
   * `deriveCapabilityAction` (services/iqube/legibility/capabilityAction.ts)
   * to render a capability-derived action instead of a bare chip list.
   */
  capabilityDescriptors: CapabilityDescriptor[];
  /** Null when there is no Marketa candidate scoring for this row (e.g. a registrable-agent-only row like Nakamoto) — never fabricated. */
  overallPriorityScore: number | null;
  lifecycleState: BenchLifecycleState;
  /** Null when this candidate has no `runtimeAgentId` link yet — genuinely unresolved, not "not started." */
  admission: AgentAdmissionState | null;
  registry: { publicationStatus: string; trustBand: string } | null;
  pulseAuthorized: boolean;
  pnlEnabled: boolean;
  runtimeMemberships: RuntimeMembership[];
  agreements: ConstitutionalAgreementRow[];
}

async function resolvePulsePnl(runtimeAgentId: string): Promise<{ pulseAuthorized: boolean; pnlEnabled: boolean }> {
  const refs = await findAgentReceiptRefs(runtimeAgentId, ['horizen_pulse_authorized', 'horizen_pnl_transparency_enabled'], {
    limit: 50,
  }).catch(() => []);
  const seen = new Set(refs.map((r) => r.actionType));
  return {
    pulseAuthorized: seen.has('horizen_pulse_authorized'),
    pnlEnabled: seen.has('horizen_pnl_transparency_enabled'),
  };
}

/**
 * The ONE runtime this codebase actually implements today. A second
 * runtime (Research, Developer, …) is a second entry in this list, not a
 * redesign of the membership shape (operator brief) — none is added here
 * because none has a real backing to project honestly yet.
 */
function buildFinancialServicesMembership(args: {
  admission: AgentAdmissionState | null;
  registryPublished: boolean | null;
  pulseAuthorized: boolean;
  pnlEnabled: boolean;
  agreements: ConstitutionalAgreementRow[];
  registrationAuditGaps: string[];
}): RuntimeMembership {
  const satisfied: string[] = [];
  const outstanding: string[] = [];
  const checks: [string, boolean | undefined | null][] = [
    ['sponsorship recorded', args.admission?.sponsorshipRecorded],
    ['delegate passport issued', args.admission?.delegatePassportIssued],
    ['delegation active', args.admission?.delegationActive],
    ['registry asset published', args.registryPublished],
    ['Pulse authorized', args.pulseAuthorized],
    ['P&L transparency enabled', args.pnlEnabled],
  ];
  for (const [label, value] of checks) {
    if (value === true) satisfied.push(label);
    else outstanding.push(label);
  }
  outstanding.push(...args.registrationAuditGaps);

  const engagedAgreement = args.agreements.find((a) => a.status === 'authorized' || a.status === 'executed' || a.status === 'settled');
  const coreAdmissionHolds =
    args.admission?.sponsorshipRecorded === true &&
    args.admission?.delegatePassportIssued === true &&
    args.admission?.delegationActive === true;
  const fullyEligible = coreAdmissionHolds && args.registryPublished === true && args.pulseAuthorized && args.pnlEnabled;

  const status: RuntimeMembershipStatus = engagedAgreement
    ? 'active'
    : fullyEligible
      ? 'approved'
      : coreAdmissionHolds
        ? 'pending-review'
        : args.admission
          ? 'applying'
          : 'not-applied';

  return {
    runtimeId: 'financial-services',
    runtimeLabel: 'Financial Services',
    status,
    eligibility: { satisfied, outstanding },
    activatedAt: engagedAgreement?.createdAt,
  };
}

function deriveLifecycleState(args: {
  hasInvitation: boolean;
  admission: AgentAdmissionState | null;
  runtimeMemberships: RuntimeMembership[];
}): BenchLifecycleState {
  if (args.runtimeMemberships.some((m) => m.status === 'active')) return 'engaged';
  if (args.runtimeMemberships.some((m) => m.status === 'approved')) return 'service-ready';
  const admissionStarted =
    args.admission &&
    (args.admission.sponsorshipRecorded === true || args.admission.delegatePassportIssued === true || args.admission.delegationActive === true);
  if (admissionStarted) return 'in-admission';
  if (args.hasInvitation) return 'invited';
  return 'candidate';
}

export async function buildAgentBenchRow(
  admin: SupabaseClient,
  subject: BenchSubject,
  opts: { hasInvitation: boolean },
): Promise<AgentBenchRow> {
  const registrableAgent: RegistrableAgentConfig | null =
    subject.kind === 'registrable-agent' ? subject.agent : resolveRegistrableAgentByRuntimeId(subject.candidate.runtimeAgentId);

  const [admission, registryAsset, registrationState] = await Promise.all([
    registrableAgent ? resolveAgentAdmissionState(admin, registrableAgent).catch(() => null) : Promise.resolve(null),
    registrableAgent ? getAsset(registrableAgent.aigentQubeId).catch(() => null) : Promise.resolve(null),
    registrableAgent ? resolveAgentRegistrationState(admin, registrableAgent).catch(() => null) : Promise.resolve(null),
  ]);

  const { pulseAuthorized, pnlEnabled } = registrableAgent
    ? await resolvePulsePnl(registrableAgent.runtimeAgentId)
    : { pulseAuthorized: false, pnlEnabled: false };

  const registryPublished = registryAsset ? registryAsset.publicationStatus === 'published' : null;

  const allAgreements = await listAgreements().catch(() => [] as ConstitutionalAgreementRow[]);
  const agreements = registrableAgent
    ? allAgreements.filter((a) => a.selectedAgentRef === registrableAgent.runtimeAgentId)
    : [];

  const financialServices = buildFinancialServicesMembership({
    admission,
    registryPublished,
    pulseAuthorized,
    pnlEnabled,
    agreements,
    registrationAuditGaps: registrationState?.auditGaps ?? [],
  });
  const runtimeMemberships = registrableAgent ? [financialServices] : [];

  // Real registrable-agent-derived identity wins over a Marketa candidate's
  // own (steward-entered) fields wherever a real answer exists — the Factory
  // and the Horizen registration resolver are more authoritative than a
  // discovery-time guess. A candidate with no registrableAgent link falls
  // back to its own fields, which is the only source it has.
  const registryProvider: ExternalRegistryProvider | null = registrationState?.registered
    ? 'horizen'
    : subject.kind === 'marketa'
      ? subject.candidate.registryProvider
      : null;
  const registryNetwork = registrationState?.network ?? (subject.kind === 'marketa' ? subject.candidate.registryNetwork : null);
  const onChainAgentId = registrationState?.tokenId ?? (subject.kind === 'marketa' ? subject.candidate.onChainAgentId : null);
  const capabilities =
    registryAsset && registryAsset.capabilities.length > 0
      ? registryAsset.capabilities.map((c) => c.name)
      : subject.kind === 'marketa'
        ? subject.candidate.capabilities
        : [];

  return {
    candidateId: subject.kind === 'registrable-agent' ? subject.agent.runtimeAgentId : subject.candidate.id,
    name: subject.kind === 'registrable-agent' ? subject.agent.displayName : subject.candidate.name,
    source: subject.kind,
    registryProvider,
    registryNetwork,
    onChainAgentId,
    capabilities,
    capabilityDescriptors: registryAsset?.capabilities ?? [],
    overallPriorityScore: subject.kind === 'marketa' ? subject.candidate.scores.overallPriorityScore : null,
    lifecycleState: deriveLifecycleState({ hasInvitation: opts.hasInvitation, admission, runtimeMemberships }),
    admission,
    registry: registryAsset ? { publicationStatus: registryAsset.publicationStatus, trustBand: registryAsset.trustBand } : null,
    pulseAuthorized,
    pnlEnabled,
    runtimeMemberships,
    agreements,
  };
}
