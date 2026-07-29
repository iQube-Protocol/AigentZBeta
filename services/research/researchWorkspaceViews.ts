/**
 * researchWorkspaceViews — THE eight Research Workspace views and the role
 * matrix that gates them (SPEC-IRL-WORKSPACE-001 §7, §8).
 *
 * ONE DEFINITION, THREE CONSUMERS. The IRL cartridge's tab config
 * (`data/codex-configs.ts`) BUILDS its workspace tabs from this list; the
 * workspace surface (`PartnerProgrammesTab`) reads it to decide which
 * sub-surfaces the research entrance offers and what to call them; the canaries
 * drive the same list. A hand-listed second copy in any of the three is the
 * stale-duplicate defect `tests/source-of-truth-parity.test.ts` indexes — and it
 * is the WORST place for one, because the drifting copy would be an ACCESS
 * matrix: a view whose config says `reviewer` while this table says otherwise
 * fails open or closed silently, and neither is discoverable from the screen.
 *
 * WHY THE MATRIX IS HERE AND NOT IN THE TAB CONFIG. `participationRoles` on a
 * tab is the mechanism, but the DECISION — "an External Reviewer may read the
 * Review view and may not open Working Materials" — is a constitutional
 * statement from the spec, not a UI detail. Recording it as data next to the
 * spec's own vocabulary is what lets a canary assert the shipped config against
 * the ruling rather than against itself (the tautology CLAUDE.md's mutation
 * discipline warns about: "a canary deriving its expectation with the same
 * predicate as the code under test").
 *
 * PURE MODULE. No server imports, no I/O — `data/codex-configs.ts` is bundled
 * for the browser and imports this.
 *
 * NOT AN AUTHORITY MODEL. This decides what RENDERS. What a role may DO lives in
 * `RESEARCH_WORKSPACE_ROLE_AUTHORITY` (`researchWorkspaceRoles.ts`) and is
 * re-enforced server-side; the two are deliberately separate checks, exactly as
 * `participationTabGate`'s header describes for the domain gate.
 */

/**
 * The substrate role ids used in the matrix. Every one is a member of
 * `DOMAIN_ROLES['research-lab']`; a canary asserts that from the substrate side,
 * so a role cannot be minted at this surface (the failure
 * `tests/research-lab-workspace.test.ts` canary R4 was written against).
 */
export type ResearchWorkspaceRoleId =
  | 'principal-investigator'
  | 'research-steward'
  | 'reviewer'
  | 'research-participant'
  | 'faculty-lead'
  | 'student-researcher'
  | 'researcher';

/** Every role the eight views can name. Order is display order. */
export const RESEARCH_WORKSPACE_ROLE_IDS: ResearchWorkspaceRoleId[] = [
  'principal-investigator',
  'research-steward',
  'reviewer',
  'research-participant',
  'faculty-lead',
  'student-researcher',
  'researcher',
];

/**
 * Every role EXCEPT the two that are procedurally scoped out of a view. Spelled
 * as a derivation rather than as six literal ids repeated five times, so adding
 * a seventh role reaches every "all roles" view automatically instead of
 * silently missing the ones a human forgot to update.
 */
function allRolesExcept(...excluded: ResearchWorkspaceRoleId[]): ResearchWorkspaceRoleId[] {
  return RESEARCH_WORKSPACE_ROLE_IDS.filter((r) => !excluded.includes(r));
}

export interface ResearchWorkspaceView {
  /** Sub-surface id inside the workspace component. */
  id: string;
  /** Tab slug in the IRL cartridge. */
  slug: string;
  /** Operator-facing name — the spec's own word for the view. */
  label: string;
  icon: string;
  description: string;
  /**
   * Which roles this view renders for. NEVER empty: a view no role can reach is
   * the "reachable by nobody" defect ruling C exists to prevent, and a canary
   * fails the build on it.
   */
  roles: ResearchWorkspaceRoleId[];
}

/**
 * THE EIGHT VIEWS, in the spec's own order (§7).
 *
 * `evidence` keeps its pre-existing sub-surface id and tab slug while carrying
 * the spec's label "Activity". The id is an IDENTIFIER — it is the
 * `initialSurface` prop, the tab slug a `?tab=` deep link resolves, and the key
 * `tests/research-lab-workspace.test.ts` pins — so renaming it would silently
 * land principals on the cartridge default (the dangling-`?tab=` failure the
 * 2026-07-28 restructure record documents). Only what a human reads changes.
 */
export const RESEARCH_WORKSPACE_VIEWS: ResearchWorkspaceView[] = [
  {
    id: 'overview',
    slug: 'irl-workspace-overview',
    label: 'Overview',
    icon: 'LayoutDashboard',
    description:
      'Purpose, phase, institutions, active roles, next action, blockers, decisions, milestones, recent receipts',
    roles: allRolesExcept(),
  },
  {
    id: 'pipeline',
    slug: 'irl-workspace-pipeline',
    label: 'Pipeline',
    icon: 'GitBranch',
    description: "The lifecycle template's stages, with the workspace's current stage marked",
    roles: allRolesExcept(),
  },
  {
    id: 'review',
    slug: 'irl-workspace-review',
    label: 'Review',
    icon: 'ClipboardCheck',
    description:
      'IRL-REVIEW-001 — review packages, reviewers, rubric, decisions, contested items and review receipts',
    // An Institutional Observer views agreed materials, not the adjudication
    // machinery; a Student Researcher is reviewed, not a reviewer.
    roles: allRolesExcept('research-participant', 'student-researcher'),
  },
  {
    id: 'working-materials',
    slug: 'irl-workspace-materials',
    label: 'Working Materials',
    icon: 'FileEdit',
    description:
      'Mutable drafts, notes, source packs, notebooks, code branches and unresolved decisions — never the record',
    // THE REVIEWER EXCLUSION IS THE POINT (SPEC §8, acceptance criterion 5).
    // A reviewer who could open the mutable working area would be one habit
    // away from editing it; "reviewers never write to source assets" is
    // IRL-REVIEW-001's own invariant and this is where it becomes navigation.
    roles: allRolesExcept('reviewer', 'research-participant'),
  },
  {
    id: 'locker',
    slug: 'irl-workspace-locker',
    label: 'Locker',
    icon: 'Lock',
    description: 'Frozen, signed, ratified or authoritative artefacts only',
    // SPEC §10: "Access to one experiment must not imply access to … the whole
    // Locker." An Institutional Observer is the one role the spec gives no
    // artefact-store access.
    roles: allRolesExcept('research-participant'),
  },
  {
    id: 'qubetalk',
    slug: 'irl-workspace-qubetalk',
    label: 'QubeTalk',
    icon: 'MessagesSquare',
    description: 'Workspace-scoped deliberation channels — mounted, never rebuilt',
    // Every role deliberates, including the Institutional Observer, whom the
    // spec explicitly permits to comment.
    roles: allRolesExcept(),
  },
  {
    id: 'evidence',
    slug: 'irl-workspace-evidence',
    label: 'Activity',
    icon: 'FileCheck',
    description: 'Consequential events and DVN receipts — the workspace activity record',
    roles: allRolesExcept(),
  },
  {
    id: 'participants',
    slug: 'irl-workspace-participants',
    label: 'Participants',
    icon: 'Users',
    description: 'People, institutions, roles, invitation status and scope',
    // ADMINISTRATION OF ACCESS, not a roster to browse. Only the two roles the
    // spec gives administrative authority — the Research Steward (programme)
    // and the Faculty Lead (one cohort). A PI defines science, not access.
    roles: ['research-steward', 'faculty-lead'],
  },
];

/** The Tier-0 internal space. NOT one of the eight — it is `adminOnly`, and it
 *  is listed here only so the tab builder has one source for the whole group. */
export const RESEARCH_WORKSPACE_ADMIN_VIEW = {
  id: 'administration',
  slug: 'irl-workspace-administration',
  label: 'Administration',
  icon: 'Lock',
  description:
    'Internal programme space — reference integrity, resolved invariants, milestones, blockers, decisions',
} as const;

export function getResearchWorkspaceView(id: string): ResearchWorkspaceView | null {
  return RESEARCH_WORKSPACE_VIEWS.find((v) => v.id === id) ?? null;
}

/** Every view id, in spec order — the surface's sub-surface list. */
export const RESEARCH_WORKSPACE_VIEW_IDS: string[] = RESEARCH_WORKSPACE_VIEWS.map((v) => v.id);
