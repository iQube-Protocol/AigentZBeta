/**
 * Constitutional Admission Package generator (2026-08-05 canonical Agent
 * Bench plan, §3). Deterministic composition — pins: two distinct
 * audiences, the Journey link is pre-populated from the candidate's own
 * registry facts, transparency is disclosed but carries no gating
 * semantics, and nothing here fabricates a rationale the candidate's data
 * doesn't support.
 */
import { describe, expect, it } from 'vitest';
import { buildJourneyLink, generateAdmissionPackage } from '@/services/marketa/activation/admissionPackage';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import type { CandidateAgent } from '@/services/marketa/activation/types';

function nakamotoCandidate(overrides: Partial<Record<string, unknown>> = {}): CandidateAgent {
  return dbToCandidate({
    id: 'cand-nakamoto',
    name: 'Aigent Nakamoto',
    capabilities: ['bitcoin', 'decentralised technologies', 'qripto protocols'],
    strategic_lanes: ['financial_services'],
    scores: { overallPriorityScore: 91, riskScore: 5 },
    registry_provider: 'horizen',
    registry_network: 'base-sepolia',
    on_chain_agent_id: '8798',
    owner_wallet: '0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9',
    pulse_state: 'enabled',
    pnl_state: 'enabled',
    ...overrides,
  });
}

describe('buildJourneyLink', () => {
  it('carries the registry provider and on-chain agent id, never re-asking the operator for what Marketa already resolved', () => {
    const link = buildJourneyLink(nakamotoCandidate(), { journeyBaseUrl: 'https://dev-beta.aigentz.me/journey/external-agent-admission' });
    const url = new URL(link);
    expect(url.searchParams.get('provider')).toBe('horizen');
    expect(url.searchParams.get('agentId')).toBe('8798');
    expect(url.searchParams.get('candidateId')).toBe('cand-nakamoto');
  });

  it('includes campaignId and invitationId only when supplied', () => {
    const withoutCampaign = new URL(buildJourneyLink(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey' }));
    expect(withoutCampaign.searchParams.has('campaignId')).toBe(false);
    const withCampaign = new URL(
      buildJourneyLink(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey', campaignId: 'pilot-01', invitationId: 'inv-1' }),
    );
    expect(withCampaign.searchParams.get('campaignId')).toBe('pilot-01');
    expect(withCampaign.searchParams.get('invitationId')).toBe('inv-1');
  });
});

describe('generateAdmissionPackage', () => {
  const NOW = () => new Date('2026-08-05T12:00:00.000Z');

  it('has two distinct audiences — agent-facing and operator-facing are never merged', () => {
    const pkg = generateAdmissionPackage(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey', now: NOW });
    expect(pkg.agentFacing).toBeDefined();
    expect(pkg.operatorFacing).toBeDefined();
    expect(pkg.agentFacing).not.toHaveProperty('journeyLink');
    expect(pkg.operatorFacing.journeyLink).toContain('agentId=8798');
  });

  it('discloses transparency state without it affecting the sponsorship recommendation', () => {
    const enabled = generateAdmissionPackage(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey', now: NOW });
    const unknown = generateAdmissionPackage(
      nakamotoCandidate({ pulse_state: 'unknown', pnl_state: 'unknown' }),
      { journeyBaseUrl: 'https://x.example/journey', now: NOW },
    );
    expect(enabled.transparency.pulseState).toBe('enabled');
    expect(unknown.transparency.pulseState).toBe('unknown');
    // Same score/risk in both fixtures -> same sponsorship level, regardless of transparency state.
    expect(enabled.operatorFacing.proposedSponsorshipLevel).toBe(unknown.operatorFacing.proposedSponsorshipLevel);
  });

  it('recommends elevated sponsorship only for high score + low risk, never asserted independently of the candidate data', () => {
    const strong = generateAdmissionPackage(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey', now: NOW });
    const weak = generateAdmissionPackage(
      nakamotoCandidate({ scores: { overallPriorityScore: 40, riskScore: 60 } }),
      { journeyBaseUrl: 'https://x.example/journey', now: NOW },
    );
    expect(strong.operatorFacing.proposedSponsorshipLevel).toBe('elevated');
    expect(weak.operatorFacing.proposedSponsorshipLevel).toBe('standard');
  });

  it('never invents a capability or registry fact not present on the candidate', () => {
    const bare = dbToCandidate({ id: 'cand-bare', name: 'Bare Candidate' });
    const pkg = generateAdmissionPackage(bare, { journeyBaseUrl: 'https://x.example/journey', now: NOW });
    expect(pkg.evidenceBundle.registryProvider).toBeNull();
    expect(pkg.agentFacing.capabilitiesDetected).toEqual([]);
    expect(pkg.agentFacing.selectionRationale).not.toContain(expect.stringContaining('undefined'));
  });

  it('always states the four constitutional rights/responsibilities, unconditionally', () => {
    const pkg = generateAdmissionPackage(nakamotoCandidate(), { journeyBaseUrl: 'https://x.example/journey', now: NOW });
    expect(pkg.operatorFacing.constitutionalRightsAndResponsibilities).toHaveLength(4);
    expect(pkg.operatorFacing.constitutionalRightsAndResponsibilities.join(' ')).toContain('Sovereignty remains with the human principal');
  });
});
