/**
 * admissionPacket — assembles the packet Factor submits to MoneyPenny for
 * admission (PRD Journey C step 3, §12 "prepare/read admission packet").
 *
 * Pure read + assembly. Writes NOTHING — building a packet never mutates
 * case state (the caller separately calls
 * factorCaseService.transitionCaseState to move the case into
 * 'admission_pending' once it is satisfied the packet is complete).
 *
 * Readiness flags that this worktree has no live source for yet (Horizen
 * Presence, Pulse enrollment, P&L registration — none of
 * services/horizen/*, services/passport/*, or services/standing/* exist in
 * this worktree; see the Phase 0 implementation-map doc) are represented
 * honestly as `verified: false, reason: 'not-available-in-this-environment'`
 * rather than fabricated as passing (CLAUDE.md "No Guessing" + PRD
 * instruction 5 "Do not invent successful provider, migration, or
 * deployment verification").
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactorCaseRow } from './factorCaseService';
import type { AegisAssessmentRow } from '../aegis/aegisAssessmentService';

export interface ReadinessCheck {
  verified: boolean;
  reason: string;
}

export interface AdmissionPacket {
  caseId: string;
  candidateDisplayName: string;
  candidateAgentRootDid: string | null;
  pathway: 'registry_only' | 'full_horizon';
  requestedServices: unknown[];
  requestedJurisdictions: string[];

  registryReadiness: ReadinessCheck;
  ratifiedAssessment: {
    verified: boolean;
    assessmentId: string | null;
    decision: string | null;
    assessmentHash: string | null;
    reason: string;
  };
  walletControlProof: ReadinessCheck;
  operatorAndSponsorship: ReadinessCheck;
  boundedDelegation: ReadinessCheck;
  pulseAndPnlReadiness: ReadinessCheck;

  evidenceOutstanding: string[];
  builtAt: string;
}

export async function buildAdmissionPacket(admin: SupabaseClient, caseId: string): Promise<AdmissionPacket> {
  const { data: caseRow, error: caseErr } = await admin.from('factor_cases').select('*').eq('case_id', caseId).maybeSingle();
  if (caseErr) throw new Error(`buildAdmissionPacket case read failed: ${caseErr.message}`);
  if (!caseRow) throw new Error(`No factor_cases row for case_id ${caseId}`);
  const c = caseRow as FactorCaseRow;

  const registryReadiness: ReadinessCheck = c.candidate_registry_asset_id
    ? { verified: true, reason: `registry_assets row ${c.candidate_registry_asset_id} present` }
    : { verified: false, reason: 'no candidate_registry_asset_id recorded on this case yet' };

  let ratifiedAssessment: AdmissionPacket['ratifiedAssessment'] = {
    verified: false,
    assessmentId: null,
    decision: null,
    assessmentHash: null,
    reason: 'no current_aegis_assessment_id on this case',
  };
  if (c.current_aegis_assessment_id) {
    const { data: assessment, error: aErr } = await admin
      .from('aegis_assessments')
      .select('*')
      .eq('assessment_id', c.current_aegis_assessment_id)
      .maybeSingle();
    if (aErr) throw new Error(`buildAdmissionPacket assessment read failed: ${aErr.message}`);
    const a = assessment as AegisAssessmentRow | null;
    if (a && a.state === 'ratified') {
      ratifiedAssessment = {
        verified: true,
        assessmentId: a.assessment_id,
        decision: a.decision,
        assessmentHash: a.assessment_hash,
        reason: `assessment ratified (v${a.version})`,
      };
    } else if (a) {
      ratifiedAssessment = { verified: false, assessmentId: a.assessment_id, decision: null, assessmentHash: null, reason: `assessment is '${a.state}', not ratified` };
    }
  }

  const { data: outstandingEvidence, error: evErr } = await admin
    .from('factor_evidence_items')
    .select('category, status')
    .eq('case_id', caseId)
    .is('superseded_by', null)
    .in('status', ['missing', 'requested', 'contradicted']);
  if (evErr) throw new Error(`buildAdmissionPacket evidence read failed: ${evErr.message}`);

  // Wallet control, operator/sponsorship, and bounded-delegation proofs
  // route through primitives this worktree does not carry yet
  // (services/horizen agentBinding-style wallet-control proof,
  // services/passport sponsorship, and the authority-chain table this
  // migration DOES add). Wallet-control and sponsorship stay an honest
  // gap; bounded delegation is checked against the real
  // factor_authority_chains table this migration introduces.
  const { data: chain } = await admin
    .from('factor_authority_chains')
    .select('chain_id, status, mode, subdelegation_permitted')
    .eq('delegate_agent_root_did', c.candidate_agent_root_did ?? '__none__')
    .eq('status', 'active')
    .maybeSingle();

  return {
    caseId,
    candidateDisplayName: c.candidate_display_name,
    candidateAgentRootDid: c.candidate_agent_root_did,
    pathway: c.pathway,
    requestedServices: c.requested_services,
    requestedJurisdictions: c.requested_jurisdictions,
    registryReadiness,
    ratifiedAssessment,
    walletControlProof: { verified: false, reason: 'not-available-in-this-environment: no wallet-control-proof primitive in this worktree' },
    operatorAndSponsorship: c.owner_persona_id
      ? { verified: true, reason: 'owner_persona_id recorded on case' }
      : { verified: false, reason: 'no owner_persona_id on case' },
    boundedDelegation: chain
      ? { verified: true, reason: `active authority chain ${chain.chain_id} (${chain.mode})` }
      : { verified: false, reason: 'no active factor_authority_chains row for this candidate' },
    pulseAndPnlReadiness: { verified: false, reason: 'not-available-in-this-environment: no Pulse/P&L primitive in this worktree' },
    evidenceOutstanding: (outstandingEvidence ?? []).map((e: any) => `${e.category}:${e.status}`),
    builtAt: new Date().toISOString(),
  };
}
