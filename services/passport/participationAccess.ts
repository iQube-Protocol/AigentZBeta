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
import { EXPERIMENT_REGISTRY } from '@/types/research';

/**
 * Invite → auto-channel: when an invitation was flagged `open_peer_channel`,
 * open a QubeTalk peer channel between the ISSUER and the CLAIMANT the moment
 * the claimant redeems it (both personas are now known). Best-effort — a channel
 * failure NEVER blocks the access grant. Reuses createOrGetChannel (idempotent
 * per unordered pair), so a re-claim does not duplicate the channel.
 */
async function maybeOpenInviteChannel(
  inv: { open_peer_channel?: boolean; issuer_persona_id?: string | null; access_domain?: string | null },
  claimantPersonaId: string,
): Promise<string | null> {
  try {
    if (!inv.open_peer_channel || !inv.issuer_persona_id) return null;
    if (inv.issuer_persona_id === claimantPersonaId) return null; // no self-channel
    // Tag the channel's origin with the invitation's access domain so the Lab's
    // filtered research view surfaces it (Locker shows all channels).
    const res = await createOrGetChannel(
      inv.issuer_persona_id,
      personaPublicRef(claimantPersonaId),
      inv.access_domain ? String(inv.access_domain) : undefined,
    );
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
  // LABEL ONLY (2026-07-28 naming pass). The KEY 'developer-studio' is an
  // identifier — it is the persisted `access_domain` value on every invitation
  // and grant row, and the key of DOMAIN_ROLES / DOMAIN_STEWARD_ROLES — so it
  // must not move. Only what a human reads changes.
  'developer-studio': 'metaMe Studio (Dev)',
};

export const DOMAIN_ROLES: Record<AccessDomain, string[]> = {
  'passport': ['citizen', 'sovereign-citizen', 'citizen-steward', 'passport-steward'],
  // The six original entries are the RESEARCH roles. SPEC-IRL-WORKSPACE-001 §8
  // names six workspace roles; three of them already have exact equivalents
  // here and are REUSED rather than renamed (operator ruling 2026-07-28, "Do
  // not invent new names if equivalent roles already exist"):
  //
  //   Research Steward       → 'research-steward'      (also DOMAIN_STEWARD_ROLES)
  //   External Reviewer      → 'reviewer'
  //   Institutional Observer → 'research-participant'  (the read-only path)
  //
  // Three have NO equivalent, and mapping them onto an existing role would
  // erase a real authority difference rather than reuse a real one:
  //
  //   'principal-investigator' — a PI defines experiments, requests freezes and
  //       initiates runs; `researcher` carries none of that and flattening the
  //       two would make "cannot self-review confirmatory work" unstateable.
  //   'faculty-lead'          — administers ONE cohort. Not a research-steward
  //       (whose authority is programme-wide) and not a researcher.
  //   'student-researcher'    — scoped to assigned projects, and the only role
  //       whose contributions accrue attributable Standing.
  //
  // ADDING A ROLE GRANTS NOTHING BY ITSELF. A role reaches a surface only when
  // a tab lists it in `participationRoles` AND the caller's grant is scoped to
  // the workspace; the three new roles are therefore fail-closed on every
  // pre-existing tab, which still names only the original three.
  'research-lab': [
    'research-participant', 'researcher', 'delegated-research-agent', 'reviewer', 'research-steward', 'ratifier',
    'principal-investigator', 'faculty-lead', 'student-researcher',
  ],
  // WORKSPACE ROLES added 2026-07-27 (operator decision). The five original
  // entries are VENTURE roles — what someone is to a venture. A partner pilot
  // needs what someone is to a WORKSPACE, and the two do not map 1:1: a partner
  // operator is not a founder-operator, and an observer is not a mentor.
  // Extended rather than forked so there is still ONE participation mechanism
  // across all five access domains (the substrate the Horizen Workspace reuses).
  'venture-lab': [
    'founder-operator', 'venture-participant', 'mentor', 'venture-steward', 'portfolio-reviewer',
    'workspace-steward', 'partner-operator', 'technical-contributor',
    'communications-contributor', 'observer', 'agent-participant',
  ],
  'metame-studio': ['creator', 'publisher', 'studio-member', 'studio-steward'],
  'developer-studio': ['developer', 'technical-operator', 'contributor', 'maintainer', 'development-steward', 'deployment-approver'],
};

export function isAccessDomain(v: string): v is AccessDomain {
  return (ACCESS_DOMAINS as readonly string[]).includes(v);
}

// ─── DELEGATED INVITATION AUTHORITY (operator, 2026-07-28) ───────────────────
//
// "There should be an admin gate on our side, which enables partners and
// various parties to be invited. But a partner operator … should be able to
// have rights to invite others to a pilot project or a research programme
// accordingly … so that we don't become the gate for that."
//
// TWO AUTHORITIES, NOT ONE GATE WITH TWO AUDIENCES:
//
//   platform  — a platform admin. Admits a party into ANY domain and confers
//               invitation authority itself (by inviting a steward role). This
//               is the gate the operator explicitly keeps on our side.
//   delegated — a persona holding an active STEWARD grant in a domain. May
//               invite into THAT domain only, scoped to the projects/pilots
//               their own grant covers, and may NOT confer a steward role.
//
// The whole security property is that `delegated` is derived SERVER-SIDE from
// the caller's own grants (resolved through the spine), never from anything the
// client sends. A domain in the request body is checked against this derivation
// and refused if absent — a delegated inviter naming another domain is a
// privilege-escalation attempt, not a valid request.

/**
 * The role in each domain that carries DELEGATED invitation authority — the
 * partner-side / programme-side administrator. Derived designation over the
 * existing DOMAIN_ROLES catalogue: no new role vocabulary, no schema change.
 */
export const DOMAIN_STEWARD_ROLES: Record<AccessDomain, string[]> = {
  'passport': ['passport-steward'],
  // `faculty-lead` added 2026-07-29 (SPEC-IRL-WORKSPACE-001 §8: a Faculty Lead
  // "administers one capstone/cohort, approves participation"). THIS IS THE ONE
  // GATE THIS WORK WIDENS, and it is bounded by the mechanism that already
  // exists rather than by a new one:
  //
  //   • `resolveInvitationAuthority` derives the tier SERVER-SIDE from the
  //     caller's OWN grants, so a Faculty Lead's reach is exactly their own
  //     grant's `allowedScopes` — their cohort and its projects, nothing else.
  //     A delegated inviter naming another domain is refused as an escalation
  //     attempt, not honoured.
  //   • `issuableRoles(domain, 'delegated')` SUBTRACTS every steward role, so a
  //     Faculty Lead cannot confer `research-steward` OR `faculty-lead`. Only a
  //     platform admin appoints a Faculty Lead. (This also TIGHTENS the existing
  //     research-steward: it can no longer issue `faculty-lead` either.)
  //   • A `faculty-lead` grant only exists because a platform admin issued one.
  //
  // Canaried from both sides in `tests/research-workspace-spec.test.ts`.
  'research-lab': ['research-steward', 'faculty-lead'],
  // A partner administrator IS a workspace steward (the role added 2026-07-27
  // for exactly this: "what someone is to a WORKSPACE"). `venture-steward` is
  // the platform-side venture equivalent and carries the same authority.
  'venture-lab': ['workspace-steward', 'venture-steward'],
  'metame-studio': ['studio-steward'],
  'developer-studio': ['development-steward'],
};

export type InvitationTier = 'platform' | 'delegated' | 'none';

export interface InvitationAuthority {
  tier: InvitationTier;
  /** The domains this caller may issue into. Empty when tier === 'none'. */
  domains: AccessDomain[];
  /**
   * Per-domain project/pilot/experiment scope the caller may confer, derived
   * from their OWN grants. `'all'` means unrestricted WITHIN that domain (what
   * a platform admin has, and what an unscoped steward grant confers).
   */
  scopes: Record<string, 'all' | string[]>;
}

/**
 * Roles a caller of the given tier may CONFER in a domain.
 *
 * NO ROLE MAY GRANT ITSELF OR GRANT UPWARD. A delegated steward's issuable set
 * excludes every steward role in the domain, so delegated authority cannot
 * replicate itself and cannot hand out the authority that created it. Only a
 * platform admin confers invitation authority — which is precisely the gate the
 * operator asked to keep on our side.
 */
export function issuableRoles(domain: AccessDomain, tier: InvitationTier): string[] {
  if (tier === 'platform') return DOMAIN_ROLES[domain];
  if (tier === 'delegated') {
    const stewardRoles = new Set(DOMAIN_STEWARD_ROLES[domain]);
    return DOMAIN_ROLES[domain].filter((r) => !stewardRoles.has(r));
  }
  return [];
}

/**
 * Resolve what a caller may invite, from platform-admin status plus the
 * caller's OWN active grants. Pure — the caller resolves the grants through the
 * spine and passes them in, so there is exactly one persona resolution per
 * request and the gate cannot be handed a client-supplied identity.
 */
export function resolveInvitationAuthority(
  isAdmin: boolean,
  grants: { accessDomain: string; role: string; allowedScopes?: string[] | null }[],
): InvitationAuthority {
  if (isAdmin) {
    const scopes: Record<string, 'all' | string[]> = {};
    for (const d of ACCESS_DOMAINS) scopes[d] = 'all';
    return { tier: 'platform', domains: [...ACCESS_DOMAINS], scopes };
  }

  const domains: AccessDomain[] = [];
  const scopes: Record<string, 'all' | string[]> = {};
  for (const g of grants) {
    if (!isAccessDomain(g.accessDomain)) continue;
    if (!DOMAIN_STEWARD_ROLES[g.accessDomain].includes(g.role)) continue;
    if (!domains.includes(g.accessDomain)) domains.push(g.accessDomain);
    const existing = scopes[g.accessDomain];
    const own = g.allowedScopes;
    // An unscoped steward grant is unrestricted within its domain; a scoped one
    // contributes only its own ids. Unions across several grants.
    if (!own || own.length === 0) scopes[g.accessDomain] = 'all';
    else if (existing !== 'all') {
      scopes[g.accessDomain] = Array.from(new Set([...(existing ?? []), ...own]));
    }
  }
  if (domains.length === 0) return { tier: 'none', domains: [], scopes: {} };
  return { tier: 'delegated', domains, scopes };
}

/**
 * Is `requested` a legal scope for an invitation this authority issues in this
 * domain? SCOPE CONTAINMENT — a delegated inviter can never widen beyond what
 * they themselves hold, and must name a scope at all when their own is
 * restricted (an unrestricted invitation from a restricted steward would be a
 * silent widening).
 */
export function scopeWithinAuthority(
  authority: InvitationAuthority,
  domain: AccessDomain,
  requested: string[],
): { ok: true } | { ok: false; error: string } {
  const own = authority.scopes[domain];
  if (own === 'all' || own === undefined) return { ok: true };
  const clean = requested.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) {
    return {
      ok: false,
      error: `Your ${DOMAIN_LABELS[domain]} authority is scoped to ${own.join(', ')} — an invitation must name one of them.`,
    };
  }
  const outside = clean.filter((s) => !own.includes(s));
  if (outside.length > 0) {
    return { ok: false, error: `Outside your authority: ${outside.join(', ')}` };
  }
  return { ok: true };
}

/**
 * The runnable experiments an invitation can scope a reviewer to. Acceptance
 * tests, reports, and plates are deliberately absent — they stay admin-only.
 *
 * DERIVED from EXPERIMENT_REGISTRY (types/research.ts) — the platform's single
 * source of truth for experiments (the same registry the Laboratory →
 * Experiments view and the disk-parity canary key off). This list previously
 * hand-duplicated the registry as a static array and went stale every time an
 * experiment was added (EXP-009/010, CCE-006/007, ISR-001 were all missing
 * from the invitation scoping UI — operator QA, 2026-07-22). Deriving it means
 * a new EXPERIMENT_REGISTRY entry is automatically assignable; there is no
 * second place to remember to update.
 */
export const ASSIGNABLE_EXPERIMENTS: { id: string; label: string }[] = EXPERIMENT_REGISTRY.map(
  (exp) => ({ id: exp.id, label: `${exp.id} · ${exp.family}` }),
);

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

/**
 * Roles the 'review' workspace view admits (services/research/researchWorkspaceViews.ts:
 * `allRolesExcept('research-participant', 'student-researcher')`). Kept here,
 * not re-derived from that module, because that module is deliberately
 * server-import-free (pure, bundled for the browser) — this is the one place
 * server-side authorization actually reads the access_grants table, per
 * SPEC-IRL-WORKSPACE-001 §16's reuse register.
 */
const REVIEW_VIEW_READABLE_ROLES = ['reviewer', 'research-steward', 'principal-investigator', 'faculty-lead', 'researcher'];

/**
 * Read-only reviewer-reach check (SPEC-IRL-WORKSPACE-001 §8, acceptance
 * criterion 4: "Autonomi reviewers reach only assigned experiments"). Does a
 * persona hold an active research-lab grant, in one of the roles the Review
 * workspace view admits, scoped (via allowed_experiments) to this experiment?
 *
 * READ-ONLY BOUNDARY: this answers "may this caller SEE this experiment's
 * review/crystal evidence", never "may they resolve/freeze/canonise it". The
 * governed-resolution routes (accept/revise/defer/reject, freeze-preview)
 * stay gated on `cartridgeFlags.isAdmin` exactly as before — extending THIS
 * check to cover those would be exactly the authority the reviewer role's
 * `false`s (researchWorkspaceRoles.ts) exist to withhold.
 */
export async function callerMayReadExperimentReview(
  admin: SupabaseClient,
  personaId: string,
  experimentId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('access_grants')
    .select('role, allowed_experiments')
    .eq('persona_id', personaId)
    .eq('access_domain', 'research-lab')
    .eq('status', 'active');
  if (error || !data) return false;
  return data.some((row) => {
    const role = String((row as { role: string }).role);
    if (!REVIEW_VIEW_READABLE_ROLES.includes(role)) return false;
    const allowed = (row as { allowed_experiments?: string[] | null }).allowed_experiments;
    return !allowed || allowed.length === 0 || allowed.includes(experimentId);
  });
}

/**
 * The set of experiments a persona's own review-readable grants reach —
 * `'all'` when any qualifying grant is unrestricted, otherwise the union of
 * every qualifying grant's `allowed_experiments` (empty set = no qualifying
 * grant at all, i.e. reach nothing). Same role/scope rule as
 * `callerMayReadExperimentReview`, but returning the whole set rather than a
 * single experiment's yes/no — for filtering a LIST of reviews down to only
 * what this caller may see (never exposing an unrelated internal review,
 * SPEC-IRL-WORKSPACE-001 §10: "access to one experiment must not imply
 * access to sibling experiments").
 */
export async function getReviewReadableExperiments(
  admin: SupabaseClient,
  personaId: string,
): Promise<'all' | Set<string>> {
  const { data, error } = await admin
    .from('access_grants')
    .select('role, allowed_experiments')
    .eq('persona_id', personaId)
    .eq('access_domain', 'research-lab')
    .eq('status', 'active');
  if (error || !data) return new Set();
  const union = new Set<string>();
  for (const row of data) {
    const role = String((row as { role: string }).role);
    if (!REVIEW_VIEW_READABLE_ROLES.includes(role)) continue;
    const allowed = (row as { allowed_experiments?: string[] | null }).allowed_experiments;
    if (!allowed || allowed.length === 0) return 'all';
    for (const e of allowed) union.add(e);
  }
  return union;
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

/**
 * `issuerPersonaId` narrows the list to invitations the caller issued — the
 * read half of delegated authority. A delegated steward administers what they
 * created; the estate-wide view stays a platform-admin capability.
 */
export async function listAccessInvitations(
  admin: SupabaseClient,
  domain?: AccessDomain,
  issuerPersonaId?: string,
): Promise<AccessInvitationRow[]> {
  let q = admin.from('access_invitations').select('*').order('created_at', { ascending: false });
  if (domain) q = q.eq('access_domain', domain);
  if (issuerPersonaId) q = q.eq('issuer_persona_id', issuerPersonaId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(toInvitationRow);
}

/**
 * `issuerPersonaId`, when supplied, constrains the revoke to invitations the
 * caller issued. Enforced IN THE UPDATE PREDICATE, not by a read-then-write
 * check, so there is no window in which another issuer's invitation could be
 * revoked. Omitted only for a platform admin.
 */
export async function revokeAccessInvitation(
  admin: SupabaseClient,
  invitationId: string,
  issuerPersonaId?: string,
): Promise<boolean> {
  let q = admin
    .from('access_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('status', 'active');
  if (issuerPersonaId) q = q.eq('issuer_persona_id', issuerPersonaId);
  const { data, error } = await q.select('id');
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
  const peerChannelId = await maybeOpenInviteChannel(inv as { open_peer_channel?: boolean; issuer_persona_id?: string | null; access_domain?: string | null }, claimant.personaId);

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
