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
