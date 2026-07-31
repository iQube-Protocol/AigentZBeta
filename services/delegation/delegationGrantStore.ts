/**
 * delegationGrantStore — durable persistence for bounded-delegation grants.
 *
 * The bounded-delegation route (app/api/codex/chat/agentiq-os/delegation) keeps
 * active grants in an in-memory Map for speed, but that Map is wiped on every
 * serverless cold start. This module is the durable backing: it writes each
 * grant to public.delegation_grants on creation, reads the active grant back on
 * a cache miss (so a grant survives restart), and flips status on revoke/expiry.
 *
 * It does NOT replace the in-memory cache or the orchestration_events audit
 * trail — it sits alongside both (Extend-Don't-Duplicate). Every call is
 * best-effort: if the 20260622500000 migration hasn't been applied yet, the
 * underlying table is absent and we soft-fail + log, exactly like the Standing
 * accrual service. The route stays fully functional without the table.
 *
 * T0 discipline: persona_id and the full handoff JSON (which embeds persona_id)
 * are server-internal. Callers project only T1-safe fields to the browser.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { HandoffPayload } from '@/types/orchestration';
import { normalizeAgentIdentity, type HorizenNetwork } from '@/services/horizen/identity';
import type {
  AgentIdentityBinding,
  AgentBindingStatus,
  AgentBindingMethod,
} from '@/services/horizen/agentBinding';

export interface PersistDelegationGrantInput {
  grantId: string;
  personaId: string;
  agentRootDid: string;
  tenantId: string;
  trustBand: string;
  allowedActions: string[];
  allowedSurfaces: string[];
  forbiddenActions: string[];
  disclosureClass: string;
  maxActions: number;
  spendAutonomy?: string | null;
  showReceipts?: boolean;
  curatedSkillsOnly?: boolean;
  explainBeforeActing?: boolean;
  handoff: HandoffPayload;
  expiresAt: string;
}

export interface DelegationGrantRow {
  grant_id: string;
  persona_id: string;
  agent_root_did: string;
  tenant_id: string;
  trust_band: string;
  allowed_actions: string[];
  allowed_surfaces: string[];
  forbidden_actions: string[];
  disclosure_class: string;
  max_actions: number;
  actions_taken: number;
  spend_autonomy: string | null;
  show_receipts: boolean;
  curated_skills_only: boolean;
  explain_before_acting: boolean;
  handoff: HandoffPayload | null;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  updated_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

/** Table → the migration that creates it, so an unapplied migration logs as a
 *  pending migration rather than as an error the operator has to diagnose. */
const MISSING_TABLE_MIGRATIONS: ReadonlyArray<[table: string, migration: string]> = [
  ['delegation_grants', '20260622500000'],
  ['agent_identity_bindings', '20260905000000'],
];

function softFail(scope: string, message: string): void {
  const pending = MISSING_TABLE_MIGRATIONS.find(([table]) => message.includes(table));
  if (pending) {
    console.warn(`[delegation grants] migration ${pending[1]} not applied; ${scope} skipped`);
  } else {
    console.error(`[delegation grants] ${scope} failed:`, message);
  }
}

/**
 * Upsert a grant on creation. Supersedes any prior active grant for the persona
 * (a persona has at most one active bounded delegation at a time) by marking
 * older actives 'revoked' before inserting the new row.
 */
export async function persistDelegationGrant(input: PersistDelegationGrantInput): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    // Supersede prior actives for this persona — the in-memory Map only ever
    // held one grant per persona, so the durable ledger mirrors that.
    await admin
      .from('delegation_grants')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: 'superseded by new grant' })
      .eq('persona_id', input.personaId)
      .eq('status', 'active');

    const { error } = await admin.from('delegation_grants').insert({
      grant_id: input.grantId,
      persona_id: input.personaId,
      agent_root_did: input.agentRootDid,
      tenant_id: input.tenantId,
      trust_band: input.trustBand,
      allowed_actions: input.allowedActions,
      allowed_surfaces: input.allowedSurfaces,
      forbidden_actions: input.forbiddenActions,
      disclosure_class: input.disclosureClass,
      max_actions: input.maxActions,
      actions_taken: 0,
      spend_autonomy: input.spendAutonomy ?? null,
      show_receipts: input.showReceipts ?? true,
      curated_skills_only: input.curatedSkillsOnly ?? true,
      explain_before_acting: input.explainBeforeActing ?? false,
      handoff: input.handoff,
      status: 'active',
      expires_at: input.expiresAt,
    });
    if (error) softFail('persist', error.message);
  } catch (e) {
    softFail('persist', e instanceof Error ? e.message : String(e));
  }
}

/** Read the persona's active, unexpired grant (rehydration on cache miss). */
export async function readActiveGrant(personaId: string): Promise<DelegationGrantRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('delegation_grants')
      .select('*')
      .eq('persona_id', personaId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      softFail('read', error.message);
      return null;
    }
    if (!data) return null;
    // Lazily expire a stale row so the ledger stays honest.
    if (new Date(data.expires_at) < new Date()) {
      await markGrantExpired(data.grant_id);
      return null;
    }
    return data as DelegationGrantRow;
  } catch (e) {
    softFail('read', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Durable "does this persona have an active delegation?" — for read-only
 * observers (the accession progress bar, IRL welcome) that must reflect the
 * SAME state the delegation GET route returns, WITHOUT the client having to
 * supply a persona_id (which mismatched the server's active persona and left
 * the Delegate step stuck; operator report 2026-07-20).
 *
 * Mirrors the delegation route's durable sources, minus the in-memory cache
 * (server-only, unreachable here): the delegation_grants ledger first, then the
 * orchestration_events fallback (latest z_delegated not superseded by a more
 * recent control_returned_to_metame, and not past its TTL). Best-effort — any
 * error reads as "no active delegation" rather than throwing.
 */
export async function hasActiveDelegation(personaId: string): Promise<boolean> {
  if (!personaId) return false;
  // 1. Durable ledger (the canonical rehydration source).
  const grant = await readActiveGrant(personaId);
  if (grant) return true;

  // 2. orchestration_events fallback — the delegation POST always awaits a
  //    z_delegated event, so this survives even when the ledger migration is
  //    pending. Latest event of either type wins; a revoke supersedes a grant.
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    const { data } = await admin
      .from('orchestration_events')
      .select('event_type, metadata, created_at')
      .eq('active_cartridge', 'agentiq-os-cartridge')
      .filter('metadata->>persona_id', 'eq', personaId)
      .in('event_type', ['z_delegated', 'control_returned_to_metame'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.event_type !== 'z_delegated' || !data.metadata) return false;
    const expiresAt = (data.metadata as Record<string, unknown>).expires_at;
    return typeof expiresAt === 'string' && new Date(expiresAt) > new Date();
  } catch {
    return false;
  }
}

/** Mark the persona's active grant revoked (user revoke / control return). */
export async function revokeActiveGrant(personaId: string, reason: string): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    const { error } = await admin
      .from('delegation_grants')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: reason })
      .eq('persona_id', personaId)
      .eq('status', 'active');
    if (error) softFail('revoke', error.message);
  } catch (e) {
    softFail('revoke', e instanceof Error ? e.message : String(e));
  }
}

/** T1-safe projection of a delegation_grants row's status transition — no
 *  persona_id, no handoff payload, just enough to render a notification
 *  ("Delegation active/revoked/expired") with a timestamp. */
export interface LatestGrantEvent {
  grantId: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

/**
 * Most recent delegation_grants row (any status) for a persona — the latest
 * status TRANSITION (grant created / revoked / expired), for surfaces that
 * need to notice a CHANGE (Companion Universal Notifications,
 * PRD-MMC-IMPL-002 Increment 3) rather than just "is one active right now"
 * (hasActiveDelegation, above). Same soft-fail discipline as the rest of
 * this store: a missing migration or query error reads as "no event" rather
 * than throwing.
 */
export async function latestGrantEvent(personaId: string): Promise<LatestGrantEvent | null> {
  if (!personaId) return null;
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('delegation_grants')
      .select('grant_id, status, created_at, updated_at, revoked_at, revoke_reason')
      .eq('persona_id', personaId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      softFail('latest-event', error.message);
      return null;
    }
    if (!data) return null;
    return {
      grantId: data.grant_id,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      revokedAt: data.revoked_at,
      revokeReason: data.revoke_reason,
    };
  } catch (e) {
    softFail('latest-event', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ERC-8004 identity bindings — the constitutional link this store's grants
// hang an external agent identity from.
//
// It lives HERE rather than in a new store module because it is the same
// concern: `agent_root_did` on a delegation grant is what a binding attaches an
// ERC-8004 identity to, and splitting the two would give the delegation chain
// two durable homes (inv.engineering.036). The MODEL is in
// services/horizen/agentBinding.ts and stays pure — this section is only I/O,
// with the same best-effort soft-fail discipline as everything above: a missing
// migration reads as "no bindings", never as a throw.
//
// The one thing this section must NEVER do is return `[]` when it could not
// read. `null` and `[]` mean different things to `resolveBinding` — "unknown"
// vs "none" — and the whole honesty of the four evidence-binding states rests
// on the difference.
// ───────────────────────────────────────────────────────────────────────────

const BINDINGS_TABLE = 'agent_identity_bindings';

/** DB row → the pure model. Tolerant of nulls; never invents a value. */
function toAgentIdentityBinding(r: Record<string, unknown>): AgentIdentityBinding | null {
  // Re-normalise through the canonical path rather than trusting stored
  // strings: it re-derives the hex/decimal aliases and refuses a row whose
  // token id is not a real token id, so a corrupted row cannot become a
  // plausible-looking identity.
  const normalized = normalizeAgentIdentity({
    agentId: String(r.token_id ?? ''),
    network: String(r.network ?? '') as HorizenNetwork,
    source: 'on-chain',
  });
  if (!normalized.ok) return null;

  return {
    bindingId: String(r.binding_id),
    agentRootDid: String(r.agent_root_did),
    identity: normalized.identity,
    identityRegistry: String(r.identity_registry),
    ownerAddressAtBinding: String(r.owner_address_at_binding),
    bindingMethod: String(r.binding_method) as AgentBindingMethod,
    agentControlProof: {
      ownerAddress: String(r.owner_address_at_binding),
      ownerObservation: (r.ownership_check_source as AgentIdentityBinding['agentControlProof']['ownerObservation']) ?? 'registry_read',
      claimMessage: String(r.claim_message ?? ''),
      nonce: String(r.claim_nonce ?? ''),
      signatureCommitment: String(r.signature_commitment ?? ''),
      verifiedAt: String(r.claim_verified_at ?? r.effective_from),
    },
    constitutionalAct: {
      personaId: String(r.persona_id),
      passportId: String(r.passport_id),
      delegationGrantId: String(r.delegation_grant_id),
      claimedRelationship: r.claimed_relationship === true,
      acceptedResponsibility: r.accepted_responsibility === true,
      scopeDefined: r.scope_defined === true,
      actedAt: String(r.acted_at ?? r.effective_from),
      receiptId: (r.receipt_id as string | null) ?? null,
    },
    ownershipCheckedAt: (r.ownership_checked_at as string | null) ?? null,
    ownerWalletAtCheck: (r.owner_wallet_at_check as string | null) ?? null,
    ownershipStatus: (r.ownership_status as AgentIdentityBinding['ownershipStatus']) ?? 'unknown',
    ownershipCheckSource: (r.ownership_check_source as AgentIdentityBinding['ownershipCheckSource']) ?? null,
    facets: {
      ownershipVerified: r.ownership_verified === true,
      operatorRelationshipClaimed: r.operator_relationship_claimed === true,
      delegationActive: r.delegation_active === true,
      runtimeAdmissionEligible: r.runtime_admission_eligible === true,
    },
    effectiveFrom: String(r.effective_from),
    effectiveTo: (r.effective_to as string | null) ?? null,
    status: String(r.status) as AgentIdentityBinding['status'],
    statusReason: (r.status_reason as string | null) ?? null,
    supersededBy: (r.superseded_by as string | null) ?? null,
    receiptCommitment: (r.receipt_commitment as string | null) ?? null,
  };
}

/**
 * Every binding recorded for a NETWORK-QUALIFIED identity.
 *
 * Returns `null` when the store could not be read (no client, missing
 * migration, query error) and `[]` when it was read and holds none. Callers
 * pass the result straight to `resolveBinding`, which turns the distinction
 * into `binding_unresolvable` vs `unbound`.
 *
 * The query filters on BOTH network and token_id. Filtering on token_id alone
 * would return the Base Mainnet agent for a Base Sepolia question — the exact
 * cross-network confusion identity.ts §4.4 calls the most dangerous property of
 * this integration.
 */
export async function readAgentIdentityBindings(
  network: HorizenNetwork,
  tokenId: string,
): Promise<AgentIdentityBinding[] | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from(BINDINGS_TABLE)
      .select('*')
      .eq('network', network)
      .eq('token_id', tokenId)
      .order('effective_from', { ascending: false });
    if (error) {
      softFail('binding read', error.message);
      return null;
    }
    return (data ?? [])
      .map((row) => toAgentIdentityBinding(row as Record<string, unknown>))
      .filter((b): b is AgentIdentityBinding => b !== null);
  } catch (e) {
    softFail('binding read', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Insert a newly minted binding. The model has already refused anything that
 *  lacked both proofs — this only persists what `bindAgentIdentity` produced. */
export async function persistAgentIdentityBinding(b: AgentIdentityBinding): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    const { error } = await admin.from(BINDINGS_TABLE).insert({
      binding_id: b.bindingId,
      agent_root_did: b.agentRootDid,
      network: b.identity.network,
      chain_id: b.identity.chainId,
      token_id: b.identity.tokenId,
      registry_alias: b.identity.registryAlias,
      identity_registry: b.identityRegistry,
      owner_address_at_binding: b.ownerAddressAtBinding,
      binding_method: b.bindingMethod,
      claim_message: b.agentControlProof.claimMessage,
      claim_nonce: b.agentControlProof.nonce,
      signature_commitment: b.agentControlProof.signatureCommitment,
      claim_verified_at: b.agentControlProof.verifiedAt,
      persona_id: b.constitutionalAct.personaId,
      passport_id: b.constitutionalAct.passportId,
      delegation_grant_id: b.constitutionalAct.delegationGrantId,
      claimed_relationship: b.constitutionalAct.claimedRelationship,
      accepted_responsibility: b.constitutionalAct.acceptedResponsibility,
      scope_defined: b.constitutionalAct.scopeDefined,
      acted_at: b.constitutionalAct.actedAt,
      receipt_id: b.constitutionalAct.receiptId,
      ownership_checked_at: b.ownershipCheckedAt,
      owner_wallet_at_check: b.ownerWalletAtCheck,
      ownership_status: b.ownershipStatus,
      ownership_check_source: b.ownershipCheckSource,
      ownership_verified: b.facets.ownershipVerified,
      operator_relationship_claimed: b.facets.operatorRelationshipClaimed,
      delegation_active: b.facets.delegationActive,
      runtime_admission_eligible: b.facets.runtimeAdmissionEligible,
      effective_from: b.effectiveFrom,
      effective_to: b.effectiveTo,
      status: b.status,
      status_reason: b.statusReason,
      superseded_by: b.supersededBy,
      receipt_commitment: b.receiptCommitment,
    });
    if (error) softFail('binding persist', error.message);
  } catch (e) {
    softFail('binding persist', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Write back the result of an ownership re-check.
 *
 * Writes the ownership columns, the `ownershipVerified` FACET, and the
 * suspension columns — and nothing else. The other three facets and the whole
 * proof/act record are untouched, because a token transfer is not evidence
 * about the delegation grant or about what the binding once attributed.
 */
export async function recordBindingOwnershipCheck(b: AgentIdentityBinding): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    const { error } = await admin
      .from(BINDINGS_TABLE)
      .update({
        ownership_checked_at: b.ownershipCheckedAt,
        owner_wallet_at_check: b.ownerWalletAtCheck,
        ownership_status: b.ownershipStatus,
        ownership_check_source: b.ownershipCheckSource,
        ownership_verified: b.facets.ownershipVerified,
        status: b.status,
        status_reason: b.statusReason,
        effective_to: b.effectiveTo,
        updated_at: new Date().toISOString(),
      })
      .eq('binding_id', b.bindingId);
    if (error) softFail('binding ownership check', error.message);
  } catch (e) {
    softFail('binding ownership check', e instanceof Error ? e.message : String(e));
  }
}

/** Flip a single grant to expired (called when a read finds it past TTL). */
export async function markGrantExpired(grantId: string): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    const { error } = await admin
      .from('delegation_grants')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('grant_id', grantId)
      .eq('status', 'active');
    if (error) softFail('expire', error.message);
  } catch (e) {
    softFail('expire', e instanceof Error ? e.message : String(e));
  }
}
