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

const MISSING = 'delegation_grants';

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[delegation grants] migration 20260622500000 not applied; ${scope} skipped`);
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
