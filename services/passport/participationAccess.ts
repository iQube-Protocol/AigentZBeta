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
import { personaPublicRef } from '@/services/identity/personaReferences';
import { createOrGetChannel } from '@/services/qubetalk/peerChannel';

/**
 * Invite → auto-channel: when an invitation was flagged `open_peer_channel`,
 * open a QubeTalk peer channel between the ISSUER and the CLAIMANT the moment
 * the claimant redeems it (both personas are now known). Best-effort — a channel
 * failure NEVER blocks the access grant. Reuses createOrGetChannel (idempotent
 * per unordered pair), so a re-claim does not duplicate the channel.
 */
async function maybeOpenInviteChannel(
  inv: { open_peer_channel?: boolean; issuer_persona_id?: string | null },
  claimantPersonaId: string,
): Promise<string | null> {
  try {
    if (!inv.open_peer_channel || !inv.issuer_persona_id) return null;
    if (inv.issuer_persona_id === claimantPersonaId) return null; // no self-channel
    const res = await createOrGetChannel(inv.issuer_persona_id, personaPublicRef(claimantPersonaId));
    return res.ok ? res.value.id : null;
  } catch {
    return null;
  }
}

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

/** The runnable experiments an invitation can scope a reviewer to. Acceptance
 *  tests, reports, and plates are deliberately absent — they stay admin-only. */
export const ASSIGNABLE_EXPERIMENTS: { id: string; label: string }[] = [
  { id: 'EXP-001', label: 'EXP-001 · Bundle Evaluation' },
  { id: 'EXP-002', label: 'EXP-002 · Invariant-Carried Video' },
  { id: 'EXP-003', label: 'EXP-003 · Rediscovery Savings' },
  { id: 'EXP-004', label: 'EXP-004 · Sovereignty' },
  { id: 'EXP-005', label: 'EXP-005 · Provider Choice' },
  // Invariant Intelligence Validation Series (EXP-006 runs in-app; 007/008 are
  // design-stage, assignable so a reviewer can scope + develop them).
  { id: 'EXP-006', label: 'EXP-006 · Projection Fidelity' },
  { id: 'EXP-007', label: 'EXP-007 · Reasoning Entropy' },
  { id: 'EXP-008', label: 'EXP-008 · Cross-Modal Reuse' },
  // Validation Programme (design-stage).
  { id: 'EXP-P1', label: 'EXP-P1 · Representation Gauntlet' },
  { id: 'EXP-P2', label: 'EXP-P2 · Projection Semantics' },
  { id: 'EXP-P3', label: 'EXP-P3 · Programme Arm 3' },
];

/**
 * Resolve a persona's research-lab experiment access from their active grants.
 * Returns 'all' when unrestricted (paid access is handled separately; here a
 * grant with no allowed_experiments means the whole series), or the union set
 * of assigned experiment ids across grants.
 */
export async function getGrantedExperiments(
  admin: SupabaseClient,
  personaId: string,
): Promise<{ hasGrant: boolean; allowed: 'all' | Set<string> }> {
  const { data, error } = await admin
    .from('access_grants')
    .select('allowed_experiments')
    .eq('persona_id', personaId)
    .eq('access_domain', 'research-lab')
    .eq('status', 'active');
  if (error || !data || data.length === 0) return { hasGrant: false, allowed: new Set() };
  const union = new Set<string>();
  let anyUnrestricted = false;
  for (const row of data) {
    const list = (row as { allowed_experiments?: string[] | null }).allowed_experiments;
    if (!list || list.length === 0) anyUnrestricted = true;
    else for (const e of list) union.add(e);
  }
  return { hasGrant: true, allowed: anyUnrestricted ? 'all' : union };
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
  /** Experiment ids this invitation scopes the reviewer to (null/[] = all). */
  allowedExperiments: string[] | null;
  /** Non-secret identifier: the first 12 hex of the stored sha256(code_hash).
   *  Lets the steward tell invitations apart / correlate one against a code
   *  they hold, WITHOUT exposing the claimable bearer code (which is never
   *  stored — hashed at rest, shown once). One-way: cannot recover the code. */
  codeFingerprint: string;
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
    allowedExperiments: ((r.allowed_experiments as string[] | null) ?? null),
    codeFingerprint: String(r.code_hash ?? '').slice(0, 12),
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
    /** Experiment ids/labels this invitation scopes the reviewer to. Empty =
     *  unrestricted. Only meaningful for the research-lab domain. */
    allowedExperiments?: string[];
    /** Open a QubeTalk peer channel with the issuer when the invitee claims. */
    openPeerChannel?: boolean;
  },
): Promise<{ ok: true; rawCode: string; invitation: AccessInvitationRow } | { ok: false; error: string }> {
  if (!DOMAIN_ROLES[input.domain].includes(input.role)) {
    return { ok: false, error: `Role '${input.role}' is not defined for domain '${input.domain}'` };
  }
  const rawCode = `pinv-${randomBytes(16).toString('hex')}`;
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;
  const allowedExperiments = (input.allowedExperiments ?? [])
    .map((e) => e.trim())
    .filter(Boolean);
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
      allowed_experiments: allowedExperiments.length > 0 ? allowedExperiments : null,
      // Only touch the new column when the feature is opted into, so invitation
      // creation is byte-identical (and safe) on a DB that hasn't applied
      // 20260805300000 yet.
      ...(input.openPeerChannel === true ? { open_peer_channel: true } : {}),
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
  /** Experiment ids this grant scopes the reviewer to (null/[] = all). */
  allowedExperiments: string[] | null;
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
    allowedExperiments: ((r.allowed_experiments as string[] | null) ?? null),
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
  | { ok: true; grant: { id: string; accessDomain: string; role: string; grantedAt: string }; alreadyGranted?: boolean; peerChannelId?: string }
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
      // Carry the invitation's experiment scoping onto the grant, so the
      // run gate can enforce which experiments this reviewer may run.
      allowed_experiments: (inv as { allowed_experiments?: string[] | null }).allowed_experiments ?? null,
    })
    .select('id, access_domain, role, granted_at')
    .single();
  if (grantErr || !grant) return { ok: false, error: grantErr?.message ?? 'Grant insert failed' };

  const nextUses = Number(inv.uses) + 1;
  await admin
    .from('access_invitations')
    .update({ uses: nextUses, ...(nextUses >= Number(inv.max_uses) ? { status: 'exhausted' } : {}) })
    .eq('id', inv.id);

  // Invite → auto-channel (best-effort; never blocks the grant).
  const peerChannelId = await maybeOpenInviteChannel(inv as { open_peer_channel?: boolean; issuer_persona_id?: string | null }, claimant.personaId);

  return {
    ok: true,
    grant: { id: String(grant.id), accessDomain: String(grant.access_domain), role: String(grant.role), grantedAt: String(grant.granted_at) },
    ...(peerChannelId ? { peerChannelId } : {}),
  };
}

/**
 * Auto-claim an email-scoped invitation (operator direction 2026-07-19): if the
 * caller's OWN email matches an active invitation's intended_recipient, create
 * the grant WITHOUT a manual claim ceremony — an emailed, authorized citizen has
 * access; the claim/delegation ceremony is a convenience, never a gate. This
 * keeps the canonical grant model (audit row + receipt) intact rather than a
 * parallel read-only access path.
 *
 * T0 discipline: the caller's own emails are resolved server-side and never
 * serialized/receipted (only the domain/role label lands on the receipt).
 * Idempotent: a standing grant short-circuits. Returns true iff a grant exists
 * for the domain after this call.
 */
export async function autoClaimEmailInvitation(
  admin: SupabaseClient,
  caller: { personaId: string; authProfileId: string; passportId?: string | null },
  domain: AccessDomain,
): Promise<boolean> {
  // Already granted → nothing to do.
  const { data: existingGrant } = await admin
    .from('access_grants')
    .select('id')
    .eq('persona_id', caller.personaId)
    .eq('access_domain', domain)
    .eq('status', 'active')
    .limit(1);
  if (existingGrant && existingGrant.length > 0) return true;
  if (!caller.authProfileId) return false;

  // Resolve the caller's own active emails (T0 self — server-only).
  const { data: emailRows } = await admin
    .from('crm_auth_profile_emails')
    .select('email_normalized')
    .eq('auth_profile_id', caller.authProfileId)
    .eq('status', 'active');
  const emails = new Set(
    (emailRows ?? [])
      .map((r) => String((r as { email_normalized?: string }).email_normalized ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  if (emails.size === 0) return false;

  // Find an active, unexpired, uses-remaining invitation in this domain whose
  // intended recipient matches one of the caller's emails. Newest-first so the
  // steward's most recent (correctly-scoped) invitation wins over stale ones.
  const { data: invRows } = await admin
    .from('access_invitations')
    .select('*')
    .eq('access_domain', domain)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const now = Date.now();
  const match = (invRows ?? []).find((inv) => {
    const recip = String((inv as { intended_recipient?: string | null }).intended_recipient ?? '').trim().toLowerCase();
    if (!recip || !emails.has(recip)) return false;
    if (inv.expires_at && new Date(String(inv.expires_at)).getTime() < now) return false;
    if (Number(inv.uses) >= Number(inv.max_uses)) return false;
    return true;
  });
  if (!match) return false;

  const role = String(match.role);
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: caller.personaId,
      actionType: 'passport_privilege_changed',
      summary: `Access granted via email invitation: ${DOMAIN_LABELS[domain] ?? domain} · ${role}`,
      activeCartridge: 'polity-passport',
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt failure never blocks the grant.
  }

  const { data: grant, error } = await admin
    .from('access_grants')
    .insert({
      persona_id: caller.personaId,
      passport_id: caller.passportId ?? null,
      access_domain: domain,
      role,
      source: 'invitation',
      source_id: match.id,
      receipt_id: receiptId,
      allowed_experiments: (match as { allowed_experiments?: string[] | null }).allowed_experiments ?? null,
    })
    .select('id')
    .single();
  if (error || !grant) return false;

  const nextUses = Number(match.uses) + 1;
  await admin
    .from('access_invitations')
    .update({ uses: nextUses, ...(nextUses >= Number(match.max_uses) ? { status: 'exhausted' } : {}) })
    .eq('id', match.id);
  return true;
}
