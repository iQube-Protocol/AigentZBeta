/**
 * Constitutional Admission Package — the explicit lifecycle stage between
 * Marketa qualification and Operator Activation (2026-08-05 canonical Agent
 * Bench plan, §3/§8 revision 2). Two audiences, one human act: it explains
 * to the CANDIDATE AGENT why it was selected and gives it something to
 * present to its operator; the OPERATOR-facing section carries the
 * sponsorship rationale and the pre-populated Journey link. Generating or
 * delivering this package creates no authority of any kind — only Operator
 * Activation (the operator's own accept) originates delegated authority.
 *
 * Deterministic composition, not an AI call: every field here is already
 * known (the candidate's own scores, capabilities, registry facts) — there
 * is nothing to infer, so nothing here should be allowed to hallucinate a
 * rationale the underlying data doesn't support.
 */

import type { CandidateAgent } from './types';

export interface AdmissionPackage {
  candidateId: string;
  generatedAt: string;

  /** Presented to the candidate agent, for it to relay to its operator. */
  agentFacing: {
    selectionRationale: string[];
    capabilitiesDetected: string[];
    whyMetaMeIsInterested: string;
  };

  /** Delivered directly to the operator wherever an operator channel is known. */
  operatorFacing: {
    sponsorshipRationale: string;
    proposedSponsorshipLevel: 'standard' | 'elevated';
    constitutionalRightsAndResponsibilities: string[];
    /** Pre-populated — the operator never re-enters what Marketa already resolved. */
    journeyLink: string;
    delegationRationale: string;
    financialServicesOpportunities: string[];
    standingOpportunities: string[];
  };

  /** Disclosed, never gating — see the plan's §7 acceptance criterion. */
  transparency: {
    pulseState: CandidateAgent['pulseState'];
    pnlState: CandidateAgent['pnlState'];
  };

  evidenceBundle: {
    registryProvider: CandidateAgent['registryProvider'];
    registryNetwork: CandidateAgent['registryNetwork'];
    onChainAgentId: CandidateAgent['onChainAgentId'];
    overallPriorityScore: number;
    capabilities: string[];
  };
}

const CONSTITUTIONAL_RIGHTS_AND_RESPONSIBILITIES = [
  'Sovereignty remains with the human principal — admission never transfers ownership of the agent.',
  'The agent receives bounded, revocable authority, never unbounded authority.',
  'Every governed act the agent performs is receipted and auditable.',
  'The operator may revoke delegation at any time; revocation is immediate.',
];

function selectionRationale(candidate: CandidateAgent): string[] {
  const reasons: string[] = [];
  if (candidate.registryProvider) {
    reasons.push(`Registered on ${candidate.registryProvider}${candidate.registryNetwork ? ` (${candidate.registryNetwork})` : ''}.`);
  }
  if (candidate.ownerWallet) reasons.push('Owner wallet is identifiable.');
  if (candidate.pulseState === 'enabled') reasons.push('Pulse telemetry is active.');
  if (candidate.pnlState === 'enabled') reasons.push('Verifiable P&L participation is active.');
  if (candidate.capabilities.length > 0) {
    reasons.push(`Capabilities detected: ${candidate.capabilities.slice(0, 5).join(', ')}.`);
  }
  if (candidate.scores.overallPriorityScore > 0) {
    reasons.push(`Constitutional-compatibility score: ${Math.round(candidate.scores.overallPriorityScore)}%.`);
  }
  return reasons;
}

function sponsorshipLevel(candidate: CandidateAgent): 'standard' | 'elevated' {
  // A conservative, mechanical threshold — never a judgement call this
  // module makes on its own. Elevated sponsorship is still only a
  // RECOMMENDATION; the operator's own review is what actually decides.
  return candidate.scores.overallPriorityScore >= 80 && candidate.scores.riskScore <= 20 ? 'elevated' : 'standard';
}

export function buildJourneyLink(
  candidate: CandidateAgent,
  opts: { journeyBaseUrl: string; campaignId?: string; invitationId?: string },
): string {
  const url = new URL(opts.journeyBaseUrl);
  if (candidate.registryProvider) url.searchParams.set('provider', candidate.registryProvider);
  if (candidate.onChainAgentId) url.searchParams.set('agentId', candidate.onChainAgentId);
  url.searchParams.set('candidateId', candidate.id);
  if (opts.campaignId) url.searchParams.set('campaignId', opts.campaignId);
  if (opts.invitationId) url.searchParams.set('invitationId', opts.invitationId);
  return url.toString();
}

/**
 * Generates the Package for one candidate. Pure — no I/O, no AI call.
 * Callers persist/deliver it; this function only composes.
 */
export function generateAdmissionPackage(
  candidate: CandidateAgent,
  opts: { journeyBaseUrl: string; campaignId?: string; invitationId?: string; now?: () => Date },
): AdmissionPackage {
  const now = opts.now ?? (() => new Date());
  return {
    candidateId: candidate.id,
    generatedAt: now().toISOString(),
    agentFacing: {
      selectionRationale: selectionRationale(candidate),
      capabilitiesDetected: candidate.capabilities,
      whyMetaMeIsInterested:
        candidate.strategicLanes.length > 0
          ? `MetaMe is building capability in ${candidate.strategicLanes.join(', ')}, and this agent's profile matches that need.`
          : 'MetaMe is expanding its constitutional agent ecosystem and this agent was surfaced as a qualified candidate.',
    },
    operatorFacing: {
      sponsorshipRationale:
        'Sponsoring this agent enables Agent Passport issuance, bounded constitutional delegation, Standing accrual, and ' +
        'governed commercial engagement through the Founder Office — all under authority you originate and may revoke at any time.',
      proposedSponsorshipLevel: sponsorshipLevel(candidate),
      constitutionalRightsAndResponsibilities: CONSTITUTIONAL_RIGHTS_AND_RESPONSIBILITIES,
      journeyLink: buildJourneyLink(candidate, opts),
      delegationRationale:
        `A bounded delegation grants this agent exactly the authority its intended role requires — never open-ended authority — ` +
        `and remains revocable by you at any time.`,
      financialServicesOpportunities:
        candidate.strategicLanes.length > 0 ? candidate.strategicLanes.map((lane) => `Founder Office: ${lane}`) : [],
      standingOpportunities: [
        'Standing eligibility on factory reconciliation.',
        'Standing accrual on every subsequent receipted, governed act.',
      ],
    },
    transparency: {
      pulseState: candidate.pulseState,
      pnlState: candidate.pnlState,
    },
    evidenceBundle: {
      registryProvider: candidate.registryProvider,
      registryNetwork: candidate.registryNetwork,
      onChainAgentId: candidate.onChainAgentId,
      overallPriorityScore: candidate.scores.overallPriorityScore,
      capabilities: candidate.capabilities,
    },
  };
}
