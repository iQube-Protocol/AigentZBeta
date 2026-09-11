/**
 * QubeTalk Communications Membrane — Agent management (§10).
 *
 * Policy MODE (MANUAL/DRAFT/ROUTINE/BOUNDED/NO_AGENT) is recorded per scope
 * in `qubetalk_agent_policies` and resolved narrowest-scope-first
 * (transport → conversation → group → relationship → participant →
 * default), matching §10's inheritance order. Authority itself is NEVER
 * recorded here — a BOUNDED policy only NAMES which grant it defers to
 * (`delegationGrantRef`, an `agent_root_did`); this module re-checks that
 * grant against the REAL store (services/delegation/delegationGrantStore.ts)
 * on every resolution, so a revoked/expired grant is caught immediately
 * rather than trusted from a stale policy row. This preserves P9/P10: an
 * Agent acts only under bounded delegation, and can never redelegate — this
 * module has no code path that creates or widens a grant, only reads one.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readActiveGrantForAgent } from '@/services/delegation/delegationGrantStore';
import type { QubeTalkAgentPolicy, QubeTalkAgentPolicyMode, QubeTalkAgentPolicyScope } from '@/types/qubetalk';
import { QUBETALK_AGENT_POLICY_SCOPES } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const POLICIES = 'qubetalk_agent_policies';

function rowToPolicy(row: Record<string, unknown>): QubeTalkAgentPolicy {
  return {
    id: String(row.id),
    ownerPersonaId: String(row.owner_persona_id),
    scopeType: row.scope_type as QubeTalkAgentPolicyScope,
    scopeRef: (row.scope_ref as string | null) ?? null,
    mode: row.mode as QubeTalkAgentPolicyMode,
    delegationGrantRef: (row.delegation_grant_ref as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function setAgentPolicy(
  ownerPersonaId: string,
  input: { scopeType: QubeTalkAgentPolicyScope; scopeRef?: string | null; mode: QubeTalkAgentPolicyMode; delegationGrantRef?: string | null },
): Promise<PeerResult<QubeTalkAgentPolicy>> {
  if (input.mode === 'agent_bounded' && !input.delegationGrantRef) {
    return { ok: false, error: 'BOUNDED mode requires delegationGrantRef', code: 'missing_grant_ref' };
  }
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const scopeRef = input.scopeType === 'default' ? null : (input.scopeRef ?? null);
  const { data, error } = await admin
    .from(POLICIES)
    .upsert(
      {
        owner_persona_id: ownerPersonaId,
        scope_type: input.scopeType,
        scope_ref: scopeRef,
        mode: input.mode,
        delegation_grant_ref: input.mode === 'agent_bounded' ? input.delegationGrantRef : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_persona_id,scope_type,scope_ref' },
    )
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToPolicy(data as Record<string, unknown>) };
}

export interface ResolvedAgentPolicy {
  mode: QubeTalkAgentPolicyMode;
  /** The scope the effective mode came from — for UI transparency ("this is
   *  the conversation-level policy," not silently inherited from default). */
  resolvedFromScope: QubeTalkAgentPolicyScope | 'implicit_default';
  /** Only meaningful when mode === 'agent_bounded' — the LIVE grant status,
   *  re-checked against delegationGrantStore just now, never cached. */
  grantActive: boolean;
}

/**
 * Resolve the effective policy for a given owner across the full scope
 * chain, narrowest first. `scopeRefs` supplies whichever refs are known for
 * the message/act being evaluated — omitted scopes are simply skipped.
 * Falls back to `NO_AGENT` (never a permissive default) when nothing is set
 * anywhere in the chain.
 */
export async function resolveEffectiveAgentPolicy(
  ownerPersonaId: string,
  scopeRefs: Partial<Record<Exclude<QubeTalkAgentPolicyScope, 'default'>, string>>,
  agentRootDid?: string,
): Promise<PeerResult<ResolvedAgentPolicy>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  for (const scopeType of QUBETALK_AGENT_POLICY_SCOPES) {
    const scopeRef = scopeType === 'default' ? null : scopeRefs[scopeType];
    if (scopeType !== 'default' && !scopeRef) continue; // this scope doesn't apply to the act being evaluated

    let query = admin.from(POLICIES).select('*').eq('owner_persona_id', ownerPersonaId).eq('scope_type', scopeType);
    query = scopeType === 'default' ? query.is('scope_ref', null) : query.eq('scope_ref', scopeRef as string);
    const { data, error } = await query.maybeSingle();

    if (error) return { ok: false, error: error.message };
    const row = data as Record<string, unknown> | null;
    if (!row) continue;

    const policy = rowToPolicy(row);
    let grantActive = false;
    if (policy.mode === 'agent_bounded' && policy.delegationGrantRef && agentRootDid) {
      const grant = await readActiveGrantForAgent(ownerPersonaId, agentRootDid).catch(() => null);
      grantActive = Boolean(grant && grant.status === 'active' && grant.agent_root_did === policy.delegationGrantRef);
    }
    return { ok: true, value: { mode: policy.mode, resolvedFromScope: scopeType, grantActive } };
  }

  return { ok: true, value: { mode: 'no_agent', resolvedFromScope: 'implicit_default', grantActive: false } };
}

/**
 * The single permission gate every QubeTalk send path must call before
 * letting an Agent author a message (§10's "effective Agent action" formula,
 * the delegation-authority half of it — communication/disclosure policy
 * gating happens separately in disclosurePolicy.ts). Returns false for
 * every mode except a BOUNDED policy backed by a currently-active grant.
 */
export async function agentMaySend(
  ownerPersonaId: string,
  scopeRefs: Partial<Record<Exclude<QubeTalkAgentPolicyScope, 'default'>, string>>,
  agentRootDid: string,
): Promise<PeerResult<boolean>> {
  const resolved = await resolveEffectiveAgentPolicy(ownerPersonaId, scopeRefs, agentRootDid);
  if (!resolved.ok) return resolved;
  return { ok: true, value: resolved.value.mode === 'agent_bounded' && resolved.value.grantActive };
}
