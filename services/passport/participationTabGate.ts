/**
 * participationTabGate — the Tier 2 visibility gate: a codex tab visible to
 * anyone holding an active participation grant in a named access domain,
 * WITHOUT making them a platform admin.
 *
 * WHY THIS EXISTS (Horizen audit §B.3, operator ruling "Partner gate = split
 * agreed", 2026-07-27). The Partner views were all `adminOnly`, which is
 * correct for internal partner administration and wrong for the shared record
 * a partner operator must be able to see. The only way to show them today was
 * to make partner operators platform admins — the hard blocker the base audit
 * recorded (§7 item 4). This gate is the mechanism that resolves it:
 *
 *   Partner Administration  → adminOnly              (Tier 0, internal)
 *   Partner Workspace       → participationDomain    (Tier 2, membership)
 *
 * IT IS A GATE, NOT A BYPASS. It never widens `adminOnly`: a tab carrying both
 * is admin-only, full stop. It fails CLOSED — a caller whose grants have not
 * resolved yet sees nothing, because "not loaded" and "no membership" must not
 * be distinguishable to a surface that has to decide right now.
 *
 * ONE IMPLEMENTATION (inv.engineering.036). Every tab filter — `useCodexConfig`
 * and all four tiers in `CodexPanelDynamic` — calls this function. A second
 * copy of the predicate is the defect `tests/participation-tab-gate.test.ts`
 * fails the build on.
 *
 * The server remains the authority: these grants come from
 * `/api/participation/my-access`, which resolves through the spine, and any
 * route the tab reaches re-checks membership itself. This gate decides what is
 * RENDERED, never what is permitted.
 */

/** The grant shape returned by /api/participation/my-access. */
export interface ParticipationGrantSignal {
  accessDomain: string;
  role: string;
  /**
   * The pilots/programmes/experiments this grant is scoped to (Amendment G,
   * 2026-07-28 cohort-isolation ruling — same `access_grants.allowed_experiments`
   * column the Research Lab already scopes with, `services/passport/
   * participationAccess.ts`'s `getGrantedExperiments`). Optional so every OTHER
   * caller of this gate (passport, research-lab role checks, metame-studio,
   * developer-studio) is unaffected — only workspace/pilot-scoped callers read
   * this field.
   */
  allowedScopes?: string[] | null;
}

/** The tab fields this gate reads. Structural, so both CodexTab and a plain
 *  config object satisfy it. */
export interface ParticipationGatedTab {
  adminOnly?: boolean;
  participationDomain?: string;
  participationRoles?: string[];
}

/**
 * The caller's participation state as a surface knows it. `loaded` is
 * explicit — an empty grant list before the fetch resolves and an empty grant
 * list after it are different facts, and only the second one is an answer.
 */
export interface ParticipationAccessState {
  loaded: boolean;
  grants: ParticipationGrantSignal[];
}

export const EMPTY_PARTICIPATION_ACCESS: ParticipationAccessState = { loaded: false, grants: [] };

/**
 * Does this caller satisfy the tab's participation gate?
 *
 * Order matters and is the whole safety argument:
 *  1. no gate declared        → not this gate's business (true)
 *  2. admin                   → admins see the workspace they administer
 *  3. grants not loaded       → CLOSED
 *  4. domain grant present    → open, narrowed by `participationRoles` if set
 */
export function satisfiesParticipationGate(
  tab: ParticipationGatedTab,
  access: ParticipationAccessState,
  isAdmin: boolean,
): boolean {
  if (!tab.participationDomain) return true;
  if (isAdmin) return true;
  if (!access.loaded) return false;

  const inDomain = access.grants.filter((g) => g.accessDomain === tab.participationDomain);
  if (inDomain.length === 0) return false;

  const roles = tab.participationRoles;
  if (!roles || roles.length === 0) return true;
  return inDomain.some((g) => roles.includes(g.role));
}

/**
 * The complete tab visibility decision for the two gates that travel together.
 * `adminOnly` is checked FIRST and independently: a tab that is both admin-only
 * and participation-gated stays admin-only, so adding a participation domain to
 * an existing tab can never widen it by accident.
 */
export function tabPassesAccessGates(
  tab: ParticipationGatedTab,
  access: ParticipationAccessState,
  isAdmin: boolean,
): boolean {
  if (tab.adminOnly && !isAdmin) return false;
  return satisfiesParticipationGate(tab, access, isAdmin);
}

// ─── Cohort / pilot scope (Amendment G, operator ruling 2026-07-28) ──────────
//
// "A generic `venture-lab` membership must never confer access across all
// pilot cohorts." Domain (row above) answers "can this persona see the Partner
// / Participate GROUP at all" — a question with one answer per domain. Scope
// answers "which specific pilot/cohort's WORKSPACE content", which varies per
// grant and is not knowable from the static tab config (one Partner tab set
// serves N pilots via PartnerProgrammesTab's in-component picker, so a scope
// cannot be pinned to the tab the way `participationDomain` is). This is
// therefore a SEPARATE, dynamic check — called at the point a specific
// workspace/pilot id is being resolved (the workspace API route, and the
// client picker that must not even list what it cannot open) — never folded
// into `satisfiesParticipationGate`, which stays domain+role only for its
// many other (non-scoped) callers.
//
// DENY-BY-DEFAULT, not "unscoped = all" (explicit decision, recorded in
// `codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md`
// Amendment G / the 2026-07-28 build record). An unscoped grant
// (`allowedScopes` null/empty) grants domain membership — enough to reach the
// self-service Participate tabs and hold a role — but ZERO workspace content
// until a scope is explicitly attached. This is the opposite of the
// pre-existing `getGrantedExperiments` default for research-lab reviewers
// (empty = unrestricted access to the whole series) — deliberately: that
// default predates cohort isolation and this ruling changes the meaning for
// venture-lab specifically going forward. Existing Horizen grants are
// preserved via a one-time data backfill (see the build record), not by
// keeping the old "unscoped = all" code path.

/** Does this ONE grant cover the named workspace/pilot scope? */
export function grantAllowsScope(grant: ParticipationGrantSignal, scopeId: string): boolean {
  const scopes = grant.allowedScopes;
  if (!scopes || scopes.length === 0) return false; // deny-by-default — see note above
  return scopes.includes(scopeId);
}

/**
 * Does this caller have workspace-scoped access to `scopeId` within `domain`?
 * Admin bypasses (the Internal-domain equivalent authority, tracked
 * separately from scope — an admin administers every scoped programme without
 * that privilege being a "wide" participation grant). Fails CLOSED before
 * grants load, same discipline as `satisfiesParticipationGate`.
 */
export function satisfiesWorkspaceScope(
  access: ParticipationAccessState,
  domain: string,
  scopeId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!access.loaded) return false;
  return access.grants.some((g) => g.accessDomain === domain && grantAllowsScope(g, scopeId));
}

/** Every scope id this caller's grants in `domain` cover. Empty ≠ "all" —
 *  empty means no workspace is currently visible (deny-by-default). Used by
 *  pickers/lists that must not render an entrance they cannot open (MS-9). */
export function scopesGrantedIn(
  access: ParticipationAccessState,
  domain: string,
  isAdmin: boolean,
): 'all' | string[] {
  if (isAdmin) return 'all';
  if (!access.loaded) return [];
  const scopes = new Set<string>();
  for (const g of access.grants) {
    if (g.accessDomain !== domain) continue;
    for (const s of g.allowedScopes ?? []) scopes.add(s);
  }
  return Array.from(scopes);
}
