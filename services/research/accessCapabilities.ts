/**
 * accessCapabilities — capability-scoped participation (IRL Stewardship
 * pass, 2026-10-01, items 10-16).
 *
 * GOVERNING RULE (operator instruction, verbatim): "Access determines what a
 * Persona may enter. Capability determines what that Persona may do inside
 * the authorized scope." `access_grants` (participationAccess.ts) is
 * untouched by this module — it still decides ENTRY. This module decides
 * DOING, at a specific, narrow resource scope, via `access_grant_capabilities`
 * (migration 20261001000200).
 *
 * DEFAULT-DENY, TWO INDEPENDENT GATES. A capability row is necessary but not
 * sufficient: for any grant whose access_domain is 'research-lab' and whose
 * role is a workspace role, EVERY check here is additionally intersected
 * against the EXISTING role ceiling in researchWorkspaceRoles.ts
 * (RESEARCH_WORKSPACE_ROLE_AUTHORITY) — a capability row can grant what the
 * ceiling permits, never what it refuses. `mayFreeze`/`mayCanonize`/
 * `mayGrantStanding` are literal-`false` types on every role, so no
 * capability row for freeze_unfreeze/canonize/standing_admin will ever
 * resolve true for a workspace-role grant, no matter what a steward grants —
 * the same "type error, not a data edit" discipline that file already
 * documents, now also enforced at the capability layer.
 *
 * HIGH-RISK CAPABILITIES ARE NEVER IMPLIED BY 'write'/'run'. Each capability
 * value requires its OWN active row at the OWN scope — granting 'write' at
 * an experiment never grants 'crystal_groom' there too.
 *
 * FAILS CLOSED. Any error, any missing row, any expired row → not allowed.
 * This is the ONE function human UI and MCP/agent surfaces must both call
 * (item 17) — resolveCapability is written to have no client-only shortcut.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { RESEARCH_WORKSPACE_ROLE_AUTHORITY, type ResearchRoleAuthority } from '@/services/research/researchWorkspaceRoles';
import type { ResearchWorkspaceRoleId } from '@/services/research/researchWorkspaceViews';

export const CAPABILITY_SCOPE_TYPES = [
  'programme',
  'experiment',
  'review_package',
  'crystal_generation',
  'run_family',
  'artifact',
] as const;
export type CapabilityScopeType = (typeof CAPABILITY_SCOPE_TYPES)[number];

export const ORDINARY_CAPABILITIES = ['read', 'review', 'write', 'run', 'admin'] as const;
export const HIGH_RISK_CAPABILITIES = [
  'ide_ingest',
  'crystal_groom',
  'freeze_unfreeze',
  'canonize',
  'invariant_registry_mutate',
  'protocol_ratify',
  'standing_admin',
  'access_admin',
] as const;
export const CAPABILITY_VALUES = [...ORDINARY_CAPABILITIES, ...HIGH_RISK_CAPABILITIES] as const;
export type CapabilityValue = (typeof CAPABILITY_VALUES)[number];

export function isHighRiskCapability(c: string): boolean {
  return (HIGH_RISK_CAPABILITIES as readonly string[]).includes(c);
}

/** A high-risk capability's hard ceiling in the EXISTING role-authority
 *  table — never a new parallel policy. Capabilities with no listed mapping
 *  (invariant_registry_mutate, protocol_ratify, access_admin) have no
 *  role-authority precedent to intersect against; they are gated by the
 *  capability row alone (still independently, explicitly granted per scope
 *  — the separation from write/run is itself the safeguard). */
const HIGH_RISK_ROLE_CEILING: Partial<Record<CapabilityValue, keyof ResearchRoleAuthority>> = {
  freeze_unfreeze: 'mayFreeze',
  canonize: 'mayCanonize',
  standing_admin: 'mayGrantStanding',
  crystal_groom: 'mayEditSourceAssets',
  ide_ingest: 'mayEditSourceAssets',
};

export interface AccessGrantCapabilityRow {
  id: string;
  grantId: string;
  scopeType: CapabilityScopeType;
  scopeRef: string;
  capability: CapabilityValue;
  runConstraints: Record<string, unknown> | null;
  status: 'active' | 'revoked' | 'expired';
  grantedAt: string;
  grantedByPersonaId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  reason: string | null;
  receiptId: string | null;
}

function rowToCapability(r: Record<string, unknown>): AccessGrantCapabilityRow {
  return {
    id: String(r.id),
    grantId: String(r.grant_id),
    scopeType: r.scope_type as CapabilityScopeType,
    scopeRef: String(r.scope_ref),
    capability: r.capability as CapabilityValue,
    runConstraints: (r.run_constraints as Record<string, unknown> | null) ?? null,
    status: r.status as 'active' | 'revoked' | 'expired',
    grantedAt: String(r.granted_at),
    grantedByPersonaId: String(r.granted_by_persona_id),
    expiresAt: (r.expires_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    receiptId: (r.receipt_id as string | null) ?? null,
  };
}

function isExpired(row: { expiresAt: string | null }): boolean {
  return Boolean(row.expiresAt && new Date(row.expiresAt).getTime() < Date.now());
}

/** All capability rows attached to one grant (steward-editor read path). */
export async function listCapabilitiesForGrant(admin: SupabaseClient, grantId: string): Promise<AccessGrantCapabilityRow[]> {
  const { data, error } = await admin
    .from('access_grant_capabilities')
    .select('*')
    .eq('grant_id', grantId)
    .order('granted_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => rowToCapability(r as Record<string, unknown>));
}

/**
 * THE gate. Fails closed on any ambiguity. Checks, in order:
 *   1. the persona holds at least one ACTIVE access_grants row;
 *   2. among that persona's grants, at least one has a matching, active,
 *      unexpired capability row for (scopeType, scopeRef, capability);
 *   3. for a research-lab-domain grant whose role is a known workspace
 *      role, a high-risk capability additionally survives that role's own
 *      ceiling (a literal `false` there refuses it regardless of step 2).
 */
export async function resolveCapability(
  admin: SupabaseClient,
  input: { personaId: string; scopeType: CapabilityScopeType; scopeRef: string; capability: CapabilityValue },
): Promise<{ allowed: boolean; reason: string }> {
  const { data: grants, error: grantErr } = await admin
    .from('access_grants')
    .select('id, access_domain, role, status')
    .eq('persona_id', input.personaId)
    .eq('status', 'active');
  if (grantErr || !grants || grants.length === 0) return { allowed: false, reason: 'no-active-grant' };

  const grantIds = grants.map((g) => String(g.id));
  const { data: capRows, error: capErr } = await admin
    .from('access_grant_capabilities')
    .select('*')
    .in('grant_id', grantIds)
    .eq('scope_type', input.scopeType)
    .eq('scope_ref', input.scopeRef)
    .eq('capability', input.capability)
    .eq('status', 'active');
  if (capErr || !capRows || capRows.length === 0) return { allowed: false, reason: 'no-matching-capability' };

  const grantById = new Map(grants.map((g) => [String(g.id), g]));
  const ceilingField = HIGH_RISK_ROLE_CEILING[input.capability];

  for (const raw of capRows) {
    const cap = rowToCapability(raw as Record<string, unknown>);
    if (isExpired(cap)) continue;

    const grant = grantById.get(cap.grantId);
    if (!grant) continue;

    if (ceilingField && grant.access_domain === 'research-lab') {
      const authority = RESEARCH_WORKSPACE_ROLE_AUTHORITY[grant.role as ResearchWorkspaceRoleId];
      if (authority && authority[ceilingField] === false) {
        continue; // this grant's role forbids it outright — try another grant, if any
      }
    }

    return { allowed: true, reason: 'ok' };
  }

  return { allowed: false, reason: ceilingField ? 'refused-by-role-ceiling-or-expired' : 'expired' };
}

export type GrantCapabilityResult = { ok: true; capability: AccessGrantCapabilityRow } | { ok: false; error: string };

/** Grant (or renew — expiry/reason only, never widen scope silently) a
 *  capability at a scope. Re-granting an already-active row updates its
 *  expiry/reason via the table's own UNIQUE(grant_id, scope_type, scope_ref,
 *  capability) — never a duplicate row. */
export async function grantCapability(
  admin: SupabaseClient,
  input: {
    grantId: string;
    scopeType: CapabilityScopeType;
    scopeRef: string;
    capability: CapabilityValue;
    actorPersonaId: string;
    runConstraints?: Record<string, unknown> | null;
    expiresAt?: string | null;
    reason?: string;
  },
): Promise<GrantCapabilityResult> {
  const { data: grant, error: grantErr } = await admin
    .from('access_grants')
    .select('id, persona_id, access_domain, role, status')
    .eq('id', input.grantId)
    .maybeSingle();
  if (grantErr || !grant) return { ok: false, error: 'Grant not found.' };
  if (grant.status !== 'active') return { ok: false, error: `Cannot attach a capability to a '${grant.status}' grant.` };

  const { data: existing } = await admin
    .from('access_grant_capabilities')
    .select('*')
    .eq('grant_id', input.grantId)
    .eq('scope_type', input.scopeType)
    .eq('scope_ref', input.scopeRef)
    .eq('capability', input.capability)
    .maybeSingle();

  const previousCapabilities = existing ? [rowToCapability(existing as Record<string, unknown>).capability] : [];

  const { data: saved, error: saveErr } = await admin
    .from('access_grant_capabilities')
    .upsert(
      {
        grant_id: input.grantId,
        scope_type: input.scopeType,
        scope_ref: input.scopeRef,
        capability: input.capability,
        run_constraints: input.runConstraints ?? null,
        status: 'active',
        granted_by_persona_id: input.actorPersonaId,
        expires_at: input.expiresAt ?? null,
        revoked_at: null,
        revoked_by_persona_id: null,
        reason: input.reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'grant_id,scope_type,scope_ref,capability' },
    )
    .select('*')
    .single();
  if (saveErr || !saved) return { ok: false, error: saveErr?.message ?? 'Capability grant failed.' };

  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: input.actorPersonaId,
      actionType: 'access_grant_capability_granted',
      summary: `Capability granted: ${input.capability} @ ${input.scopeType}:${input.scopeRef}`,
      activeCartridge: 'polity-passport',
      actionInput: {
        grantId: input.grantId,
        targetPersonaId: String(grant.persona_id),
        scopeType: input.scopeType,
        scopeRef: input.scopeRef,
        previousCapabilities,
        newCapabilities: [input.capability],
        expiresAt: input.expiresAt ?? null,
        reason: input.reason ?? null,
        constitutionalBasis: `access_grant:${input.grantId}`,
        resultingState: 'active',
      },
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Fail-soft on the receipt only — see participationAccess.ts's identical rationale.
  }
  if (receiptId) {
    await admin.from('access_grant_capabilities').update({ receipt_id: receiptId }).eq('id', saved.id);
    (saved as Record<string, unknown>).receipt_id = receiptId;
  }

  return { ok: true, capability: rowToCapability(saved as Record<string, unknown>) };
}

/** Immediate effect (item 15: "must take effect immediately for subsequent
 *  actions") — a status flip, read by resolveCapability on its very next call. */
export async function revokeCapability(
  admin: SupabaseClient,
  input: { capabilityId: string; actorPersonaId: string; reason?: string },
): Promise<GrantCapabilityResult> {
  const { data: existing, error: findErr } = await admin
    .from('access_grant_capabilities')
    .select('*')
    .eq('id', input.capabilityId)
    .maybeSingle();
  if (findErr || !existing) return { ok: false, error: 'Capability grant not found.' };

  const { data: updated, error: updErr } = await admin
    .from('access_grant_capabilities')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by_persona_id: input.actorPersonaId,
      reason: input.reason ?? existing.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.capabilityId)
    .select('*')
    .single();
  if (updErr || !updated) return { ok: false, error: updErr?.message ?? 'Revoke failed.' };

  const { data: grant } = await admin.from('access_grants').select('persona_id').eq('id', existing.grant_id).maybeSingle();

  try {
    await createActivityReceipt({
      personaId: input.actorPersonaId,
      actionType: 'access_grant_capability_revoked',
      summary: `Capability revoked: ${existing.capability} @ ${existing.scope_type}:${existing.scope_ref}`,
      activeCartridge: 'polity-passport',
      actionInput: {
        grantId: String(existing.grant_id),
        targetPersonaId: grant ? String(grant.persona_id) : null,
        scopeType: existing.scope_type,
        scopeRef: existing.scope_ref,
        previousCapabilities: [existing.capability],
        newCapabilities: [],
        reason: input.reason ?? null,
        constitutionalBasis: `access_grant:${existing.grant_id}`,
        resultingState: 'revoked',
      },
    });
  } catch {
    // Fail-soft on the receipt only.
  }

  return { ok: true, capability: rowToCapability(updated as Record<string, unknown>) };
}
