/**
 * THE CANONICAL ANSWER to "has this agent been sponsored, passported and
 * delegated" — read from the records those acts actually write, not from the
 * receipts that corroborate them.
 *
 * ── WHY THIS EXISTS (operator, 2026-08-03) ────────────────────────────────
 *
 * A steward approved Aigent Nakamoto's Delegate Passport application. The
 * Journey then reverted to "ready for sponsorship."
 *
 * The approval wrote a Passport record and NO receipt. The observer's Passport
 * and Delegate stages read `hasReceipt(...)` alone:
 *
 *   sponsorBinding:         hasReceipt('agent_sponsorship_recorded')
 *   delegatePassportIssued: hasReceipt('agent_delegate_passport_issued')
 *   boundedDelegationActive: hasReceipt('agent_delegated')
 *
 * ...so it honestly reported what it was asked, and the operator was offered an
 * act they had already completed. Identical in shape to the registration defect
 * closed earlier the same day, in the two stages that fix had not reached.
 *
 *   > "canonical outcome record → observer settlement → receipt as
 *   >  corroboration → stepper projection"
 *
 *   > "It must not say an approved Passport or delegation did not happen
 *   >  solely because its DVN receipt is missing. That would recreate the
 *   >  registration defect."
 *
 * ── THE THREE CANONICAL SOURCES ───────────────────────────────────────────
 *
 *   sponsorship        agent_root_identity.sponsor_persona_id / sponsor_passport_id
 *                      (written by services/agents/sponsorPolityAgent.ts)
 *   delegate passport  polity_passport_records, passport_class 'agent_participant',
 *                      matched to the agent by its agent_card_url
 *   delegation         delegation_grants.status = 'active', keyed on the agent's
 *                      own root DID
 *
 * ── THREE-VALUED, LIKE EVERY OTHER OBSERVER HERE ──────────────────────────
 *
 * Each fact is `true` / `false` / `undefined`, where `undefined` means the read
 * FAILED. A caller must not render "not sponsored" for "could not tell" — the
 * distinction that `resolveAgentRegistrationState` draws between `unresolved`
 * and `registered: false`, and the reason a failed migration never became a
 * constitutional finding.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export interface AgentAdmissionState {
  /** A sponsoring persona + citizen passport are recorded against the agent. */
  sponsorshipRecorded: boolean | undefined;
  /** An approved `agent_participant` Passport exists for this agent. */
  delegatePassportIssued: boolean | undefined;
  /** An ACTIVE bounded-delegation grant exists for this agent's root DID. */
  delegationActive: boolean | undefined;
  /** Reads that failed, named. Disclosed, never folded into a `false`. */
  auditGaps: string[];
}

/**
 * `agent_card_url` is how a Delegate Passport names its subject — the Bureau
 * "anchors participant identity on the agent card URL" (PassportBureauApplyTab).
 * The stored value is absolute, so match on the PATH to stay origin-agnostic:
 * the same agent card is `https://dev-beta…/api/agents/nakamoto/agent-card.json`
 * in one deployment and a different host in another, and an origin-sensitive
 * match would silently stop recognising a Passport after a domain change.
 */
function matchesAgentCard(storedUrl: string | null | undefined, agentCardPath: string): boolean {
  if (!storedUrl) return false;
  try {
    return new URL(storedUrl).pathname === agentCardPath;
  } catch {
    // Not a URL — compare as a path, which is what older rows may hold.
    return storedUrl === agentCardPath;
  }
}

export async function resolveAgentAdmissionState(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
): Promise<AgentAdmissionState> {
  const auditGaps: string[] = [];
  let sponsorshipRecorded: boolean | undefined;
  let delegatePassportIssued: boolean | undefined;
  let delegationActive: boolean | undefined;
  let agentRootDid: string | null = null;

  // ── 1. Sponsorship, and the agent's own root DID (needed by step 3) ──────
  try {
    const { data, error } = await admin
      .from('agent_root_identity')
      .select('did_uri, sponsor_persona_id, sponsor_passport_id')
      .eq('agent_id', agent.runtimeAgentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    agentRootDid = (data as { did_uri?: string } | null)?.did_uri ?? null;
    const row = data as { sponsor_persona_id?: string; sponsor_passport_id?: string } | null;
    sponsorshipRecorded = Boolean(row?.sponsor_persona_id || row?.sponsor_passport_id);
  } catch (err) {
    auditGaps.push(`sponsorship read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Delegate Passport ─────────────────────────────────────────────────
  try {
    const { data, error } = await admin
      .from('polity_passport_records')
      .select('passport_id, participant_status, revoked, agent_card_url')
      .eq('passport_class', 'agent_participant')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      participant_status?: string;
      revoked?: boolean;
      agent_card_url?: string;
    }>;
    delegatePassportIssued = rows.some(
      (r) =>
        matchesAgentCard(r.agent_card_url, agent.agentCardPath) &&
        !r.revoked &&
        (r.participant_status === 'approved' || r.participant_status === 'active'),
    );
  } catch (err) {
    auditGaps.push(`delegate passport read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. Bounded delegation ────────────────────────────────────────────────
  if (agentRootDid) {
    try {
      const { data, error } = await admin
        .from('delegation_grants')
        .select('grant_id')
        .eq('agent_root_did', agentRootDid)
        .eq('status', 'active')
        .limit(1);
      if (error) throw new Error(error.message);
      delegationActive = (data ?? []).length > 0;
    } catch (err) {
      auditGaps.push(`delegation read failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (auditGaps.length === 0) {
    // The agent has no root identity row yet — a real negative, not a gap:
    // nothing can have been delegated to a DID that does not exist.
    delegationActive = false;
  }

  return { sponsorshipRecorded, delegatePassportIssued, delegationActive, auditGaps };
}
