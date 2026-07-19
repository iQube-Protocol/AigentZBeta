/**
 * Constitutional Access Service — participation invitations + grants
 * (operator + Aletheon consolidation, 2026-07-18).
 *
 * ONE shared mechanism for every permissioned area, keyed by access domain.
 * Applications (participant-initiated) keep their existing surfaces (the
 * polity passport application flow, metaMe Activations); this service adds
 * the steward-initiated INVITATION path and the canonical ACCESS GRANT
 * record both paths converge into.
 *
 * Constitutional boundaries:
 *   • The bearer code is transport, not authority — sha256-hashed at rest,
 *     raw value shown once at issuance, bounded (expiry / max uses /
 *     revocation / optional intended recipient).
 *   • Claiming is a HUMAN constitutional act performed by the signed-in
 *     persona. Agents may prepare and explain (agent-assisted applications
 *     are marked by personhood_proof_type='agent_declaration' on the
 *     application path) but cannot claim, delegate to themselves, or
 *     exceed their privileges.
 *   • Every grant is receipted (passport_privilege_changed) — the receipt,
 *     not the code, is the audit record.
 *
 * Role catalogues are configuration, not UI branches — extend DOMAIN_ROLES
 * to add a domain or role, never fork the mechanism.
 */

import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const ACCESS_DOMAINS = [
  'passport',
  'research-lab',
  'venture-lab',
  'metame-studio',
  'developer-studio',
] as const;
export type AccessDomain = (typeof ACCESS_DOMAINS)[number];

export const DOMAIN_LABELS: Record<AccessDomain, string> = {
  'passport': 'Passport',
  'research-lab': 'Research Lab',
  'venture-lab': 'Venture Lab',
  'metame-studio': 'metaMe Studio',
  'developer-studio': 'Developer Studio / Aigent Z',
};

export const DOMAIN_ROLES: Record<AccessDomain, string[]> = {
  'passport': ['citizen', 'sovereign-citizen', 'citizen-steward', 'passport-steward'],
  'research-lab': ['research-participant', 'researcher', 'delegated-research-agent', 'reviewer', 'research-steward', 'ratifier'],
  'venture-lab': ['founder-operator', 'venture-participant', 'mentor', 'venture-steward', 'portfolio-reviewer'],
  'metame-studio': ['creator', 'publisher', 'studio-member', 'studio-steward'],
  'developer-studio': ['developer', 'technical-operator', 'contributor', 'maintainer', 'development-steward', 'deployment-approver'],
};

export function isAccessDomain(v: string): v is AccessDomain {
  return (ACCESS_DOMAINS as readonly string[]).includes(v);
}

function hashCode(rawCode: string): string {
  return createHash('sha256').update(rawCode).digest('hex');
}

export interface AccessInvitationRow {
  id: string;
  accessDomain: string;
  role: string;
  label: string | null;
  intendedRecipient: string | null;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  status: string;
  createdAt: string;
  revokedAt: string | null;
}

function toInvitationRow(r: Record<string, unknown>): AccessInvitationRow {
  return {
    id: String(r.id),
    accessDomain: String(r.access_domain),
    role: String(r.role),
    label: (r.label as string | null) ?? null,
    intendedRecipient: (r.intended_recipient as string | null) ?? null,
    maxUses: Number(r.max_uses),
    uses: Number(r.uses),
    expiresAt: (r.expires_at as string | null) ?? null,
    status: String(r.status),
    createdAt: String(r.created_at),
    revokedAt: (r.revoked_at as string | null) ?? null,
  };
}

/** Issue a bounded bearer invitation. The raw code is returned ONCE. */
export async function createAccessInvitation(
  admin: SupabaseClient,
  input: {
    domain: AccessDomain;
    role: string;
    label?: string;
    intendedRecipient?: string;
    maxUses?: number;
    expiresInDays?: number;
    issuerPersonaId: string;
  },
): Promise<{ ok: true; rawCode: string; invitation: AccessInvitationRow } | { ok: false; error: string }> {
  if (!DOMAIN_ROLES[input.domain].includes(input.role)) {
    return { ok: false, error: `Role '${input.role}' is not defined for domain '${input.domain}'` };
  }
  const rawCode = `pinv-${randomBytes(16).toString('hex')}`;
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;
  const { data, error } = await admin
    .from('access_invitations')
    .insert({
      code_hash: hashCode(rawCode),
      access_domain: input.domain,
      role: input.role,
      label: input.label?.trim() || null,
      intended_recipient: input.intendedRecipient?.trim() || null,
      max_uses: Math.max(1, input.maxUses ?? 1),
      expires_at: expiresAt,
      issuer_persona_id: input.issuerPersonaId,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Invitation insert failed' };
  return { ok: true, rawCode, invitation: toInvitationRow(data) };
}

export async function listAccessInvitations(admin: SupabaseClient, domain?: AccessDomain): Promise<AccessInvitationRow[]> {
  let q = admin.from('access_invitations').select('*').order('created_at', { ascending: false });
  if (domain) q = q.eq('access_domain', domain);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(toInvitationRow);
}

export async function revokeAccessInvitation(admin: SupabaseClient, invitationId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('access_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('status', 'active')
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}

export interface AccessGrantView {
  id: string;
  accessDomain: string;
  role: string;
  source: string;
  status: string;
  grantedAt: string;
  expiresAt: string | null;
  receiptId: string | null;
  /** T2-safe holder commitment — never the raw persona id. */
  holderRef: string;
}

export async function listAccessGrants(admin: SupabaseClient, domain?: AccessDomain): Promise<AccessGrantView[]> {
  let q = admin.from('access_grants').select('*').order('granted_at', { ascending: false });
  if (domain) q = q.eq('access_domain', domain);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: String(r.id),
    accessDomain: String(r.access_domain),
    role: String(r.role),
    source: String(r.source),
    status: String(r.status),
    grantedAt: String(r.granted_at),
    expiresAt: (r.expires_at as string | null) ?? null,
    receiptId: (r.receipt_id as string | null) ?? null,
    holderRef: createHash('sha256').update(String(r.persona_id)).digest('hex').slice(0, 16),
  }));
}

/**
 * Claim an invitation — the human constitutional act. Validates the bearer
 * code (hash match, active, unexpired, uses remaining), records the use,
 * creates the canonical AccessGrant for the claimant's persona, and
 * receipts it. Idempotent per (persona, domain, role): an existing active
 * grant is returned rather than duplicated.
 */
export async function claimAccessInvitation(
  admin: SupabaseClient,
  rawCode: string,
  claimant: { personaId: string; passportId?: string | null },
): Promise<
  | { ok: true; grant: { id: string; accessDomain: string; role: string; grantedAt: string }; alreadyGranted?: boolean }
  | { ok: false; error: string }
> {
  const { data: inv, error } = await admin
    .from('access_invitations')
    .select('*')
    .eq('code_hash', hashCode(rawCode.trim()))
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!inv) return { ok: false, error: 'Invitation not found' };
  if (inv.status !== 'active') return { ok: false, error: `Invitation is ${inv.status}` };
  if (inv.expires_at && new Date(String(inv.expires_at)).getTime() < Date.now()) {
    await admin.from('access_invitations').update({ status: 'expired' }).eq('id', inv.id);
    return { ok: false, error: 'Invitation has expired' };
  }
  if (Number(inv.uses) >= Number(inv.max_uses)) {
    return { ok: false, error: 'Invitation has no uses remaining' };
  }

  const domain = String(inv.access_domain);
  const role = String(inv.role);

  // Idempotency: an active grant for the same (persona, domain, role) stands.
  const { data: existing } = await admin
    .from('access_grants')
    .select('id, access_domain, role, granted_at')
    .eq('persona_id', claimant.personaId)
    .eq('access_domain', domain)
    .eq('role', role)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      alreadyGranted: true,
      grant: { id: String(existing.id), accessDomain: domain, role, grantedAt: String(existing.granted_at) },
    };
  }

  // Receipt first (fail-soft): the grant carries the receipt id when it lands.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: claimant.personaId,
      actionType: 'passport_privilege_changed',
      summary: `Access granted via invitation: ${DOMAIN_LABELS[domain as AccessDomain] ?? domain} · ${role}`,
      activeCartridge: 'polity-passport',
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt failure never blocks the grant — the row is still canonical.
  }

  const { data: grant, error: grantErr } = await admin
    .from('access_grants')
    .insert({
      persona_id: claimant.personaId,
      passport_id: claimant.passportId ?? null,
      access_domain: domain,
      role,
      source: 'invitation',
      source_id: inv.id,
      receipt_id: receiptId,
    })
    .select('id, access_domain, role, granted_at')
    .single();
  if (grantErr || !grant) return { ok: false, error: grantErr?.message ?? 'Grant insert failed' };

  const nextUses = Number(inv.uses) + 1;
  await admin
    .from('access_invitations')
    .update({ uses: nextUses, ...(nextUses >= Number(inv.max_uses) ? { status: 'exhausted' } : {}) })
    .eq('id', inv.id);

  return {
    ok: true,
    grant: { id: String(grant.id), accessDomain: String(grant.access_domain), role: String(grant.role), grantedAt: String(grant.granted_at) },
  };
}
