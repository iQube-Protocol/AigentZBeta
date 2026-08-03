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
 *                      reached from the APPLICATION that carries the agent card URL
 *                      (see the join note below)
 *   delegation         delegation_grants.status = 'active', keyed on the agent's
 *                      own root DID
 *   factory presence   registry_assets — "the ingested factory is essentially the
 *                      registry, so presence there is a receipt in and of itself"
 *                      (operator, 2026-08-03)
 *
 * ── WHY THE PASSPORT READ IS A JOIN, NOT A DIRECT MATCH ───────────────────
 *
 * `agent_card_url` lives on `polity_passport_applications` (bureau migration
 * 20260610000000, line 69) and NOT on `polity_passport_records`. The first
 * version of this reader selected it straight off the records table; PostgREST
 * rejects the whole query for the unknown column, so the read failed, the
 * failure was honestly recorded as an audit gap — and `delegatePassportIssued`
 * stayed `undefined` forever. Honest, and still wrong: the Passport stage could
 * not go green no matter how many Passports were issued.
 *
 * So: find the agent's APPLICATIONS by card URL, then the RECORDS issued from
 * them via `application_id`. Two reads, one fact, no invented column.
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
  /** The agent is present in the registry — i.e. ingested into the Factory. */
  factoryPresent: boolean | undefined;
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
  let factoryPresent: boolean | undefined;
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

  // ── 2. Delegate Passport, via the application that names the agent card ──
  try {
    const { data: appData, error: appError } = await admin
      .from('polity_passport_applications')
      .select('id, agent_card_url')
      .not('agent_card_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (appError) throw new Error(appError.message);
    const applicationIds = ((appData ?? []) as Array<{ id: string; agent_card_url?: string }>)
      .filter((a) => matchesAgentCard(a.agent_card_url, agent.agentCardPath))
      .map((a) => a.id);

    if (applicationIds.length === 0) {
      // No application ever named this agent card — a real negative, not a gap.
      delegatePassportIssued = false;
    } else {
      const { data, error } = await admin
        .from('polity_passport_records')
        .select('passport_id, participant_status, revoked, application_id')
        .eq('passport_class', 'agent_participant')
        .in('application_id', applicationIds)
        .limit(50);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ participant_status?: string; revoked?: boolean }>;
      /*
       * `provisionally_issued` counts. The status machine issues participants
       * at `approved` by default but permits a provisional issue, and a
       * provisionally issued Passport IS a Passport — treating it as absent
       * would offer the operator an act the Bureau has already performed,
       * which is the whole defect class this reader exists to close.
       */
      delegatePassportIssued = rows.some(
        (r) =>
          !r.revoked &&
          (r.participant_status === 'approved' ||
            r.participant_status === 'active' ||
            r.participant_status === 'provisionally_issued'),
      );
    }
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

  /*
   * ── 4. Factory presence ──────────────────────────────────────────────────
   *
   *   > "The ingested factory is essentially the registry so presence there is
   *   >  a receipt in and of itself." (operator, 2026-08-03)
   *
   * Read exactly that. Nakamoto is already a published L4 AigentQube in the
   * registry; the Deploy stage waited on a `capability_registered` receipt
   * that the original ingestion never wrote, so the surface offered to ingest
   * an agent it was at that moment displaying. Same shape as Register, same
   * remedy: the registry row IS the outcome.
   */
  try {
    const { data, error } = await admin
      .from('registry_assets')
      .select('asset_id')
      .eq('asset_id', agent.aigentQubeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    factoryPresent = Boolean(data);
  } catch (err) {
    auditGaps.push(`registry presence read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { sponsorshipRecorded, delegatePassportIssued, delegationActive, factoryPresent, auditGaps };
}
