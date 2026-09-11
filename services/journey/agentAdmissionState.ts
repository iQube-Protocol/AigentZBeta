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
 *
 * ── THE MIGRATED-AGENT GAP (operator, 2026-08-03) ─────────────────────────
 *
 * An agent that walks Register → Claim → Passport WITHOUT ever passing
 * through Agent Homecoming's stand-up step (services/homecoming/agentHomecoming.ts,
 * which runs `sponsorPolityAgent` to seed the RootDID BEFORE its Passport is
 * issued) can have an APPROVED Delegate Passport and NO `agent_root_identity`
 * row at all. Nakamoto is this exact case: Register/Claim proved wallet
 * control against the Horizen registry; nothing in that path — nor generic
 * Passport issuance — ever mints a RootDID. Sponsorship and delegation read
 * `agent_root_identity`, so both stayed real negatives forever, and Nakamoto
 * was invisible in the Locker's "Sponsored Agents" list and the Delegate
 * agent-picker, despite an approved Passport and an issued VC.
 *
 * The operator's ruling: "Passport issuance mints the DID." So when this
 * reader finds `delegatePassportIssued === true` and no root identity row,
 * it mints one right here (`mintRootIdentityForApprovedPassport`) — the
 * self-heal applies to ANY agent in this shape, not just Nakamoto. It reuses
 * `sponsorPolityAgent`'s capacity-checked insert core (one authoritative
 * genesis path — inv.engineering.036/037), parameterized with the agent's
 * PRE-EXISTING identity (`runtimeAgentId`) via `existingIdentity` so the new
 * row never disagrees with the identifier Register/Claim/receipts already
 * use for this agent. The sponsoring act already happened at steward
 * approval, so this never blocks on ordinary capacity — see
 * `migratedAgentApprovedPassportId` on `sponsorPolityAgent`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { sponsorPolityAgent } from '@/services/agents/sponsorPolityAgent';
import { listOwnedPersonaIds } from '@/services/identity/passportPrincipal';
import { ensureAgentRegistryActivation } from './agentRegistryActivation';

export interface AgentAdmissionState {
  /** A sponsoring persona + citizen passport are recorded against the agent. */
  sponsorshipRecorded: boolean | undefined;
  /** An approved `agent_participant` Passport exists for this agent. */
  delegatePassportIssued: boolean | undefined;
  /** An ACTIVE bounded-delegation grant exists for this agent's root DID. */
  delegationActive: boolean | undefined;
  /**
   * The agent's AigentQube row exists in `registry_assets`.
   *
   * NOT the same fact as Factory ingestion (operator correction,
   * 2026-08-09) — a persisted AigentQube is a Register-stage prerequisite,
   * not evidence that the agent ever entered Factory participation. Callers
   * needing "was this agent Factory-ingested" must read the
   * `capability_registered` receipt instead; see
   * app/api/journey/moneypenny-horizen/state/route.ts's
   * `stages.deploy.factoryIngested` comment for the full causal chain this
   * closes. Kept here only as "does the registry row exist" — genuinely
   * useful on its own (e.g. Register's own `aigentQubeResolved` gate), never
   * as a substitute for the ingestion fact.
   */
  factoryPresent: boolean | undefined;
  /**
   * `agent_root_identity.id` — the row id `persona_agent_assignments` keys
   * against. Exposed so a caller can check whether the OPERATOR's active
   * persona has this agent structurally assigned as a delegate, independent
   * of the aigentMe designation (CFS-024). `null` when the root identity read
   * failed or found nothing — a caller must not infer "not assigned" from
   * that alone.
   */
  agentRootId: string | null;
  /**
   * `agent_root_identity.did_uri` for this agent — exposed (2026-08-23) so a
   * caller checking "is this agent the target of persona X's active
   * delegation grant" can compare against `delegation_grants.agent_root_did`
   * without a second `agent_root_identity` query (services/financialServices/
   * eligibility.ts's persona-scoped delegation fix is the first consumer).
   * `null` when the root identity read failed or found nothing — same
   * three-valued discipline as `agentRootId`.
   */
  agentRootDid: string | null;
  /**
   * Constitutional State Model Correction (operator-ratified, 2026-08-11).
   * `iQubeRegistryPresent ∧ sponsorBindingEstablished ∧ agentPassportIssued`
   * — established via `ensureAgentRegistryActivation`
   * (services/journey/agentRegistryActivation.ts) at this exact boundary,
   * the moment this resolver observes Passport complete. NEVER derived from
   * `delegationActive`, aigentMe/Operate, or `factoryPresent`/
   * `capability_registered`. `undefined` only on a read failure — an audit
   * gap, never "not activated".
   */
  registryActivated: boolean | undefined;
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

/**
 * Mints the RootDID for a migrated agent whose Delegate Passport has ALREADY
 * been approved but who has no `agent_root_identity` row — see "THE
 * MIGRATED-AGENT GAP" above. Best-effort: any failure is returned as a
 * message, never thrown — a failed backfill attempt must not break the
 * journey-state read that triggered it.
 *
 * The application itself carries no sponsor: agent-participant applications
 * ride `/api/polity-passport/submit`, a DELIBERATELY persona-less machine
 * surface ("machine submissions have no spine persona" — its own header
 * comment). So the sponsor is resolved the same way
 * `app/api/homecoming/agent/stand-up/route.ts` resolves a Homecoming
 * delegate's genesis sponsor: the CALLER currently viewing this journey
 * (widened to every persona on their auth account), sponsoring from their
 * own active citizen passport. `callerAuthProfileId` must be the account
 * actually looking at the Passport stage — never a value read off the
 * application row, which has none.
 */
async function mintRootIdentityForApprovedPassport(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  applicationId: string,
  passportId: string,
  callerAuthProfileId: string | null,
): Promise<{ didUri: string | null; error?: string }> {
  try {
    if (!callerAuthProfileId) {
      return { didUri: null, error: 'no authenticated caller to sponsor the mint from' };
    }

    const { data: appRow, error: appErr } = await admin
      .from('polity_passport_applications')
      .select('agent_card_url, application_payload')
      .eq('id', applicationId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    const row = appRow as { agent_card_url?: string; application_payload?: unknown } | null;
    const agentCardUrl = row?.agent_card_url;
    if (!agentCardUrl) {
      return { didUri: null, error: 'application missing agent_card_url' };
    }

    // The CALLER's own active citizen passport, widened to every persona on
    // their auth account — exactly the stand-up route's resolution.
    const owned = await listOwnedPersonaIds(admin, callerAuthProfileId);
    if (!owned.ok) {
      return { didUri: null, error: `caller has no owned personas: ${owned.reason}` };
    }
    const { data: citizenRows, error: citizenErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, citizen_status')
      .in('persona_id', owned.personaIds)
      .eq('passport_class', 'citizen');
    if (citizenErr) throw new Error(citizenErr.message);
    const citizens = (citizenRows ?? []) as Array<{ passport_id: string; persona_id: string; citizen_status?: string }>;
    const chosenCitizen = citizens.find((c) => c.citizen_status === 'active') ?? citizens[0];
    if (!chosenCitizen) {
      return { didUri: null, error: 'caller has no citizen passport to sponsor from' };
    }

    const payload = row?.application_payload;
    const participant =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>).participant : undefined;
    const payloadDescription =
      participant && typeof participant === 'object' && participant !== null
        ? (participant as Record<string, unknown>).description
        : undefined;
    const description =
      typeof payloadDescription === 'string' && payloadDescription.trim()
        ? payloadDescription.trim()
        : `${agent.displayName} — migrated agent participant, RootDID projected from an already-approved Delegate Passport.`;

    const result = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: chosenCitizen.persona_id,
      sponsorPassportId: chosenCitizen.passport_id,
      slug: agent.slug,
      displayName: agent.displayName,
      description,
      origin: new URL(agentCardUrl).origin,
      existingIdentity: {
        agentId: agent.runtimeAgentId,
        didUri: `did:agent:root:${agent.runtimeAgentId}`,
        agentCardUrl,
      },
      migratedAgentApprovedPassportId: passportId,
    });
    if (!result.ok || !result.agent) {
      return { didUri: null, error: result.error ?? 'sponsorPolityAgent failed' };
    }

    // Bind the passport to the freshly-minted RootDID — the same L5 signal
    // services/homecoming/issueDelegatePassport.ts writes for Homecoming
    // delegates, now completed for a migrated agent instead.
    await admin
      .from('agent_root_identity')
      .update({ bound_passport_id: passportId })
      .eq('id', result.agent.agentRootId)
      .is('bound_passport_id', null);

    return { didUri: result.agent.didUri };
  } catch (err) {
    return { didUri: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resolveAgentAdmissionState(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  /**
   * The requesting caller's auth-profile id — used ONLY to sponsor a
   * migrated agent's RootDID self-heal mint (see "THE MIGRATED-AGENT GAP"
   * below). Never used to gate or alter any read above; optional so
   * existing callers that don't yet resolve caller identity keep working
   * (the self-heal simply stays a no-op audit gap for them).
   */
  callerAuthProfileId: string | null = null,
  /**
   * The AUTHENTICATED caller's own personaId — used ONLY to attribute a
   * freshly-established `agent_registry_activated` receipt (never to gate
   * or alter any read above). `null` for an anonymous/preflight caller: the
   * activation check still runs and reports honestly (`eligible-awaiting-
   * actor` rather than a fabricated write), it just cannot write.
   */
  actorPersonaId: string | null = null,
  /**
   * 'legacy-reconciled' ONLY for the explicit, operator-invoked
   * reconciliation route (app/api/ops/journey/
   * reconcile-registry-activation/route.ts) — never automatically inferred
   * here. Defaults to 'freshly-established', correct for the ordinary case
   * of a live admission crossing the boundary for the first time.
   */
  activationProvenance: 'freshly-established' | 'legacy-reconciled' = 'freshly-established',
): Promise<AgentAdmissionState> {
  const auditGaps: string[] = [];
  let sponsorshipRecorded: boolean | undefined;
  let delegatePassportIssued: boolean | undefined;
  let delegationActive: boolean | undefined;
  let factoryPresent: boolean | undefined;
  let agentRootDid: string | null = null;
  let agentRootId: string | null = null;

  // ── 1. Sponsorship, and the agent's own root DID (needed by step 3) ──────
  try {
    const { data, error } = await admin
      .from('agent_root_identity')
      .select('id, did_uri, sponsor_persona_id, sponsor_passport_id')
      .eq('agent_id', agent.runtimeAgentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    agentRootDid = (data as { did_uri?: string } | null)?.did_uri ?? null;
    agentRootId = (data as { id?: string } | null)?.id ?? null;
    const row = data as { sponsor_persona_id?: string; sponsor_passport_id?: string } | null;
    sponsorshipRecorded = Boolean(row?.sponsor_persona_id || row?.sponsor_passport_id);
  } catch (err) {
    auditGaps.push(`sponsorship read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Delegate Passport, via the application that names the agent card ──
  let issuedPassport: { passportId: string; applicationId: string } | null = null;
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
      const rows = (data ?? []) as Array<{
        passport_id: string;
        participant_status?: string;
        revoked?: boolean;
        application_id?: string;
      }>;
      /*
       * `provisionally_issued` counts. The status machine issues participants
       * at `approved` by default but permits a provisional issue, and a
       * provisionally issued Passport IS a Passport — treating it as absent
       * would offer the operator an act the Bureau has already performed,
       * which is the whole defect class this reader exists to close.
       */
      const issuedRow = rows.find(
        (r) =>
          !r.revoked &&
          (r.participant_status === 'approved' ||
            r.participant_status === 'active' ||
            r.participant_status === 'provisionally_issued'),
      );
      delegatePassportIssued = Boolean(issuedRow);
      if (issuedRow?.application_id) {
        issuedPassport = { passportId: issuedRow.passport_id, applicationId: issuedRow.application_id };
      }
    }
  } catch (err) {
    auditGaps.push(`delegate passport read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2.5. Migrated-agent self-heal — mint the RootDID an approved Passport
  // implies but never created (see "THE MIGRATED-AGENT GAP" above). Only
  // when the Passport read itself succeeded cleanly (no audit gap) and the
  // root-identity read in step 1 genuinely found nothing (not merely failed).
  if (delegatePassportIssued === true && !agentRootDid && issuedPassport && auditGaps.length === 0) {
    const minted = await mintRootIdentityForApprovedPassport(
      admin,
      agent,
      issuedPassport.applicationId,
      issuedPassport.passportId,
      callerAuthProfileId,
    );
    if (minted.didUri) {
      agentRootDid = minted.didUri;
      sponsorshipRecorded = true;
    } else {
      auditGaps.push(`migrated-agent RootDID mint failed: ${minted.error ?? 'unknown error'}`);
    }
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

  /*
   * ── 5. Registry Activation — the derived constitutional transition ──────
   *
   * Constitutional State Model Correction (operator-ratified, 2026-08-11).
   * This is the "Passport completion path" hook point: the exact boundary
   * where this resolver observes `sponsorshipRecorded` and
   * `delegatePassportIssued` become true is where `registryActivated` gets
   * materialized — idempotently, via `ensureAgentRegistryActivation`
   * (services/journey/agentRegistryActivation.ts) — mirroring the RootDID
   * self-heal write immediately above (step 2.5), the ALREADY-established
   * precedent in this exact file for "a read boundary performs an
   * idempotent settlement write when it observes a completion".
   *
   * Only attempted when the reads above are trustworthy (no audit gap) —
   * an evidence gap must never be reasoned over as though it were a
   * negative. `registryPresent` reuses `factoryPresent`: same underlying
   * fact ("does this agent's registry_assets row exist"), read once.
   */
  let registryActivated: boolean | undefined;
  if (auditGaps.length === 0) {
    try {
      const activation = await ensureAgentRegistryActivation(
        admin,
        agent,
        actorPersonaId,
        {
          registryPresent: factoryPresent === true,
          sponsorBindingEstablished: sponsorshipRecorded === true,
          agentPassportIssued: delegatePassportIssued === true,
        },
        activationProvenance,
      );
      registryActivated = activation.registryActivated;
    } catch (err) {
      auditGaps.push(`registry activation check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    sponsorshipRecorded,
    delegatePassportIssued,
    delegationActive,
    factoryPresent,
    agentRootId,
    agentRootDid,
    registryActivated,
    auditGaps,
  };
}
