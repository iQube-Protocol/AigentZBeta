/**
 * Research Workspace canaries — operator rulings A, B and C, 2026-07-28.
 *
 * WHAT WENT WRONG BEFORE THIS FILE EXISTED. The common experiment-workspace
 * spine had a research MODEL and no research INSTANCE, and the IRL cartridge
 * had no workspace surface at all. Every gate behaved correctly; there was
 * simply nothing to reach. To the operator that is indistinguishable from a
 * broken gate — "I don't see the workspace" — and no denial canary can see it,
 * because a denial suite passes at its maximum when a surface is reachable by
 * nobody.
 *
 * RULING C, the lesson generalised (recorded as Corollary 6 to Invariant B,
 * Composed Liveness, in `codexes/packs/agentiq/updates/
 * 2026-07-28_terminal-outcome-and-composed-liveness-invariants.md`):
 *
 *   "Every access-controlled constitutional surface must have both denial
 *    canaries and at least one positive reachability canary. A denial-only
 *    suite proves exclusion, not availability."
 *
 * RULING A, the three paths this file is organised around:
 *
 *   "A Research Workspace must have at least one positive reachability path,
 *    one read-only path, and one fail-closed path."
 *
 * EXACT SLUG SETS, NEVER COUNTS. Every reachability assertion below compares a
 * SORTED SET of slugs. A `toBeGreaterThan(0)` would stay green while the wrong
 * tabs survived — the read-only path collapsing into full participation, or a
 * Tier-0 tab leaking into a Tier-2 view, are both invisible to a count.
 */

import { describe, it, expect } from 'vitest';
import {
  satisfiesParticipationGate,
  tabPassesAccessGates,
  satisfiesWorkspaceScope,
  scopesGrantedIn,
  type ParticipationAccessState,
} from '../services/passport/participationTabGate';
import { DOMAIN_ROLES, DOMAIN_STEWARD_ROLES } from '../services/passport/participationAccess';
import {
  RESEARCH_WORKSPACES,
  RESEARCH_WORKSPACE_LAYERS,
  ASSIGNABLE_RESEARCH_WORKSPACES,
  listResearchWorkspaces,
  researchWorkspaceSeries,
  researchWorkspaceExperiment,
  researchWorkspaceExperiments,
  researchWorkspaceLabel,
  researchWorkspaceObjectives,
  researchWorkspaceParent,
  researchWorkspaceAncestry,
  researchWorkspaceOwner,
  researchWorkspaceLayerOwners,
  researchWorkspaceLinks,
  researchWorkspaceInstitutions,
} from '../services/research/researchWorkspace';
import {
  experimentWorkspaceFromResearch,
  workspaceReferenceIssues,
} from '../services/experiments/experimentWorkspace';
import { SERIES_REGISTRY, EXPERIMENT_REGISTRY } from '../types/research';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const VP1 = 'irl-validation-programme-vp1';
const OTHER_PROGRAMME = 'irl-some-other-programme'; // not in the registry, and must not need to be

const access = (
  grants: Array<{ accessDomain: string; role: string; allowedScopes?: string[] | null }>,
): ParticipationAccessState => ({ loaded: true, grants });

/**
 * The Workspace tab's subTabs, straight from the shipped config.
 *
 * RE-POINTED 2026-07-29: the research half moved from nine TOP-LEVEL tabs in
 * a `workspace` GROUP to one tab (`irl-workspace`, group `participation`)
 * whose `subTabs` carry the same per-view gates one tier deeper — the exact
 * nesting `irl-passport-steward` already uses for its own KNYT sub-items.
 * `getEnabledTabs` only resolves TOP-LEVEL tabs, so the group-filter this
 * helper used before the move no longer finds anything; the entrance is now
 * `IRL_CARTRIDGE.tabs.find(t => t.id === 'irl-workspace').subTabs`.
 */
async function workspaceTabs() {
  const { IRL_CARTRIDGE } = await import('../data/codex-configs');
  const parent = IRL_CARTRIDGE.tabs.find((t: { id: string }) => t.id === 'irl-workspace') as
    | { subTabs?: Array<{
        id: string;
        slug: string;
        label: string;
        enabled?: boolean;
        adminOnly?: boolean;
        participationDomain?: string;
        participationRoles?: string[];
        config: { component: string; props?: Record<string, unknown> };
      }> }
    | undefined;
  return parent?.subTabs ?? [];
}

/**
 * Every subTab this caller actually reaches, through the SAME predicate
 * `CodexPanelDynamic`'s real tier-3 row uses (`activeSubTabs` →
 * `tabPassesAccessGates` over `activeTab.subTabs`) — `getEnabledTabs` cannot
 * see one tier deeper, so it is not the right filter here any more.
 *
 * EQUIVALENT TO THE FULL RECURSIVE CHECK, not merely an approximation: the
 * parent `irl-workspace` tab's OWN gate is `participationDomain:
 * 'research-lab'` with no `participationRoles` — strictly more permissive
 * than every one of its subTabs' own domain+role gate. Any caller who could
 * pass a subTab's gate could therefore also pass the parent's, so evaluating
 * subTab gates directly (without first re-checking the parent) can never
 * admit a caller the real two-tier check would have refused.
 */
async function reachableWorkspaceSlugs(
  a: ParticipationAccessState,
  isAdmin: boolean,
): Promise<string[]> {
  const tabs = await workspaceTabs();
  return tabs
    .filter((t) => t.enabled !== false && tabPassesAccessGates(t, a, isAdmin))
    .map((t) => t.slug)
    .sort();
}

// The ratified tier split, pinned literally. Derived-only expectations would be
// tautological against the config they are checking.
//
// RE-POINTED 2026-07-29, TWICE OVER. First for SPEC-IRL-WORKSPACE-001 §7 (the
// eight views) and §8 (six roles). SECOND, same day, for the Participation
// restructure: LOCKER and PARTICIPANTS are PRUNED from the shipped `subTabs`
// row (operator instruction — "the surrounding Participation tab already
// covers that ground once Workspace lives inside it"; Keep QubeTalk and
// Administration). The two views themselves are UNCHANGED in
// `RESEARCH_WORKSPACE_VIEWS` (still all eight, still spec-exact — see
// `tests/research-workspace-spec.test.ts`'s spec-parity canaries) and in
// `PartnerProgrammesTab`'s own `SUB_SURFACES`/`KIND_SURFACES` — they are only
// no longer OFFERED as a clickable tab here. `LOCKER`/`PARTICIPANTS` stay
// defined below (still real slugs a URL could target) purely so the "these
// two are absent from every role's reachable set" canary can name them.
//
// NOT LOOSENED by either change: every assertion below is still an EXACT
// sorted slug set driven through the REAL two-tier gate
// (`tabPassesAccessGates` over the Workspace tab's `subTabs` — see
// `reachableWorkspaceSlugs` above; `getEnabledTabs` cannot see one tier deep).
//
// LITERAL, NEVER DERIVED FROM THE MATRIX. Computing these from
// `RESEARCH_WORKSPACE_VIEWS[].roles` would be the tautology CLAUDE.md names as
// a false-survivor source ("a canary deriving its expectation with the same
// predicate as the code under test") — it would pass for ANY matrix, including
// one that admits everyone. The separate canary that checks the matrix against
// the SPEC DOCUMENT is what stops the two literals drifting together.
const OVERVIEW = 'irl-workspace-overview';
const PIPELINE = 'irl-workspace-pipeline';
const REVIEW = 'irl-workspace-review';
const MATERIALS = 'irl-workspace-materials';
/** No longer offered as a subTab (pruned 2026-07-29) — kept as a slug
 *  constant only to assert its ABSENCE from every role's reachable set. */
const LOCKER = 'irl-workspace-locker';
const QUBETALK = 'irl-workspace-qubetalk';
/** SPEC §7 names this view "Activity"; the SLUG is unchanged so every existing
 *  `?tab=` deep link still resolves. Only what a human reads changed. */
const ACTIVITY = 'irl-workspace-evidence';
/** No longer offered as a subTab (pruned 2026-07-29) — same as `LOCKER` above. */
const PARTICIPANTS = 'irl-workspace-participants';
const TIER_0_SLUG = 'irl-workspace-administration';

/** The SIX views actually offered as subTabs (2026-07-29 prune — Locker and
 *  Participants removed from the nav row; see the block comment above). */
const EVERY_VIEW = [OVERVIEW, PIPELINE, REVIEW, MATERIALS, QUBETALK, ACTIVITY].sort();
const TIER_0 = [TIER_0_SLUG];
const EVERY_TAB = [...EVERY_VIEW, ...TIER_0].sort();

/**
 * WHAT EACH ROLE REACHES, exactly, recomputed against the SIX offered
 * subTabs (2026-07-29). The load-bearing exclusions still traceable to SPEC
 * §8:
 *
 *   reviewer          has NO Working Materials — "cannot alter"; a reviewer who
 *                     could open the mutable area is one habit from editing it.
 *   observer          has NO Review or Materials — "views agreed materials and
 *                     comments; changes nothing".
 *   student           has NO Review           — a student is reviewed, not a
 *                     reviewer.
 *
 * WHAT THE PRUNE FLATTENED, stated rather than hidden: Participants was the
 * ONE view that distinguished the Research Steward and the Faculty Lead from
 * every other admitted role in THIS reachability canary (SPEC §8's "only the
 * two administrative roles reach Participants"). With Participants no longer
 * a subTab for anyone, principal-investigator / research-steward /
 * faculty-lead / researcher now reach the IDENTICAL six-view set — their
 * ROLE AUTHORITY still differs (`RESEARCH_WORKSPACE_ROLE_AUTHORITY`,
 * unaffected by this nav prune and asserted separately, canary R4/R9-adjacent
 * material below), but this particular canary can no longer see that
 * difference in the nav, and pretending otherwise would be the "false
 * survivor" pattern CLAUDE.md warns against.
 */
const REACHES: Record<string, string[]> = {
  'principal-investigator': [OVERVIEW, PIPELINE, REVIEW, MATERIALS, QUBETALK, ACTIVITY].sort(),
  'research-steward': [OVERVIEW, PIPELINE, REVIEW, MATERIALS, QUBETALK, ACTIVITY].sort(),
  reviewer: [OVERVIEW, PIPELINE, REVIEW, QUBETALK, ACTIVITY].sort(),
  'research-participant': [OVERVIEW, PIPELINE, QUBETALK, ACTIVITY].sort(),
  'faculty-lead': [OVERVIEW, PIPELINE, REVIEW, MATERIALS, QUBETALK, ACTIVITY].sort(),
  'student-researcher': [OVERVIEW, PIPELINE, MATERIALS, QUBETALK, ACTIVITY].sort(),
  researcher: [OVERVIEW, PIPELINE, REVIEW, MATERIALS, QUBETALK, ACTIVITY].sort(),
};

/** The roles that reach NOTHING — the fail-closed path, and it must stay real. */
const REACHES_NOTHING = ['delegated-research-agent', 'ratifier'];

/** Kept as the full-participation reference for the assertions that mean
 *  "everything a working member of the programme sees". */
const FULL_PARTICIPATION = REACHES['researcher'];
const READ_ONLY = REACHES['research-participant'];

// ─── Canary R1 — POSITIVE REACHABILITY (ruling A, path 1) ────────────────────

describe('canary R1 — the Research Workspace is reachable by a researcher', () => {
  it('a correctly-granted, NON-admin researcher passes every full-participation tab gate', async () => {
    const researcher = access([
      { accessDomain: 'research-lab', role: 'researcher', allowedScopes: [VP1] },
    ]);
    const tabs = await workspaceTabs();
    const shouldPass = tabs.filter((t) => FULL_PARTICIPATION.includes(t.slug));
    expect(shouldPass.map((t) => t.slug).sort()).toEqual([...FULL_PARTICIPATION].sort());
    for (const tab of shouldPass) {
      expect(
        tabPassesAccessGates(tab, researcher, false),
        `${tab.id} is unreachable by a researcher scoped to ${VP1} — the gates admit nobody`,
      ).toBe(true);
    }
  });

  it('those tabs survive the REAL tab filter, as an EXACT set — the group actually renders', async () => {
    const researcher = access([
      { accessDomain: 'research-lab', role: 'researcher', allowedScopes: [VP1] },
    ]);
    // Exact, not `>0`: a count stays green while the Tier-0 Administration tab
    // leaks in (a gate breach) or while three of the four Tier-2 views go dark.
    expect(await reachableWorkspaceSlugs(researcher, false)).toEqual([...FULL_PARTICIPATION].sort());
  });

  it('a research-steward reaches the SIX offered views, and holds the domain’s delegated invitation authority', async () => {
    const steward = access([
      { accessDomain: 'research-lab', role: 'research-steward', allowedScopes: [VP1] },
    ]);
    // RE-POINTED 2026-07-29: before the Locker/Participants prune the steward
    // reached STRICTLY MORE than the researcher (Participants was the
    // distinguishing view). With Participants no longer offered as a subTab
    // to anyone, the two roles now reach the SAME six-view set through this
    // nav — asserted as an EQUALITY here rather than a stale superset claim,
    // per the honesty discipline this file's own header names ("never
    // guess/assume — verify"). The steward's administrative authority did not
    // disappear; it simply is not visible to a NAV-reachability canary any
    // more, which is exactly what the next block records.
    expect(await reachableWorkspaceSlugs(steward, false)).toEqual([...EVERY_VIEW]);
    expect(REACHES['research-steward']).toEqual(REACHES['researcher']);
    // "full workspace participation PLUS governance/review controls" is not a
    // second tab gate — it is the EXISTING server-side steward authority, and
    // research-steward must remain the role that carries it.
    expect(DOMAIN_STEWARD_ROLES['research-lab']).toContain('research-steward');
  });

  it('EVERY role the matrix names reaches its EXACT set through the real filter', async () => {
    // The generalisation of R1/R2: seven roles, seven exact sets, one filter.
    // A per-role loop rather than three hand-picked cases, so a role added to
    // the matrix without a reachability expectation fails rather than shipping
    // unasserted.
    for (const [role, expected] of Object.entries(REACHES)) {
      const a = access([{ accessDomain: 'research-lab', role, allowedScopes: [VP1] }]);
      expect(
        await reachableWorkspaceSlugs(a, false),
        `role '${role}' does not reach its specified view set`,
      ).toEqual(expected);
      // A role that reaches nothing would make its row vacuous.
      expect(expected.length, `role '${role}' reaches no view at all`).toBeGreaterThan(0);
      // No Tier-2 role may ever reach the Tier-0 internal space.
      expect(expected, `role '${role}' reaches the Tier-0 space`).not.toContain(TIER_0_SLUG);
    }
    // Every matrix role must be a real research-lab role.
    for (const role of Object.keys(REACHES)) {
      expect(DOMAIN_ROLES['research-lab'], `'${role}' is not a research-lab role`).toContain(role);
    }
  });

  it('NOBODY reaches Locker or Participants via the Workspace nav — pruned 2026-07-29, not merely role-gated', async () => {
    // SUPERSEDES the pre-2026-07-29 "only the two administrative roles reach
    // Participants" canary. That distinction was a ROLE gate (SPEC §8); this
    // is a NAV decision made on top of it (operator instruction, same day:
    // "the surrounding Participation tab already covers that ground once
    // Workspace lives inside it") — Locker and Participants are removed from
    // the subTab row for EVERY role, including the two SPEC §8 names as
    // administrative (research-steward, faculty-lead). Asserted over every
    // admitted role, not just the two that used to differ, because the old
    // per-role split no longer exists to assert.
    for (const role of Object.keys(REACHES)) {
      const a = access([{ accessDomain: 'research-lab', role, allowedScopes: [VP1] }]);
      const slugs = await reachableWorkspaceSlugs(a, false);
      expect(slugs, `'${role}' reached the pruned Locker view`).not.toContain(LOCKER);
      expect(slugs, `'${role}' reached the pruned Participants view`).not.toContain(PARTICIPANTS);
    }
    // An admin — the ONE caller who still reaches Tier 0 — ALSO does not see
    // Locker/Participants as subTabs, because they are not in the shipped
    // list at all (not merely gated out for non-admins).
    const admin = access([]);
    const adminSlugs = await reachableWorkspaceSlugs(admin, true);
    expect(adminSlugs).not.toContain(LOCKER);
    expect(adminSlugs).not.toContain(PARTICIPANTS);
    // The underlying SPEC role authority (who MAY administer access,
    // server-side) is untouched by this nav prune — asserted so a future
    // reader does not mistake "not offered as a tab" for "the role lost the
    // capability".
    expect(DOMAIN_STEWARD_ROLES['research-lab']).toEqual(
      expect.arrayContaining(['research-steward', 'faculty-lead']),
    );
  });

  it('and the workspace behind those tabs opens for the same caller — the picker lists exactly one entrance', () => {
    const researcher = access([
      { accessDomain: 'research-lab', role: 'researcher', allowedScopes: [VP1] },
    ]);
    // Scope is a SEPARATE decision from the tab gate. Passing the tabs and then
    // finding an empty picker is the same invisible surface from the operator's
    // seat; both must hold for the SAME caller.
    expect(satisfiesWorkspaceScope(researcher, 'research-lab', VP1, false)).toBe(true);
    expect(scopesGrantedIn(researcher, 'research-lab', false)).toEqual([VP1]);
  });

  it('an admin reaches the whole group — Tier 0 included — with no grant at all', async () => {
    const noGrants = access([]);
    expect(await reachableWorkspaceSlugs(noGrants, true)).toEqual(EVERY_TAB);
    expect(satisfiesWorkspaceScope(noGrants, 'research-lab', VP1, true)).toBe(true);
    expect(scopesGrantedIn(noGrants, 'research-lab', true)).toBe('all');
  });
});

// ─── Canary R2 — READ-ONLY PATH (ruling A, path 2) ───────────────────────────

describe('canary R2 — the read-only path is genuinely read-only', () => {
  const readOnly = access([
    { accessDomain: 'research-lab', role: 'research-participant', allowedScopes: [VP1] },
  ]);

  it('a research-participant reaches EXACTLY the read-only views', async () => {
    expect(await reachableWorkspaceSlugs(readOnly, false)).toEqual([...READ_ONLY].sort());
  });

  it('and is refused the write surfaces by the gate itself, not merely by the filter', async () => {
    const tabs = await workspaceTabs();
    const writeSurfaces = tabs.filter(
      (t) => EVERY_VIEW.includes(t.slug) && !READ_ONLY.includes(t.slug),
    );
    // RE-POINTED 2026-07-29: Locker and Participants are no longer offered as
    // subTabs at all (pruned from the nav row), so they cannot appear in
    // `tabs` (this describes the SHIPPED subTab list, not the full SPEC §7
    // view registry) — the write-surface set the read-only path is refused
    // narrows to the two that remain offered: Review and Working Materials.
    expect(writeSurfaces.map((t) => t.slug).sort()).toEqual([REVIEW, MATERIALS].sort());
    for (const tab of writeSurfaces) {
      expect(
        satisfiesParticipationGate(tab, readOnly, false),
        `${tab.id} opened for a read-only participant — the read-only path is not read-only`,
      ).toBe(false);
    }
  });

  it('the excluded surfaces still MOUNT the affordances, so excluding them excludes something', async () => {
    // If Working Materials stopped being the mutable area, excluding it would
    // no longer be excluding anything and this canary would pass vacuously.
    // RE-POINTED 2026-07-29: Participants and Locker are no longer subTabs at
    // all (see the block comment above `EVERY_VIEW`), so only the two
    // still-offered write surfaces are checked as tab ENTRANCES here; their
    // continued mount is checked separately, straight from the surface's own
    // source, further below.
    const tabs = await workspaceTabs();
    for (const [slug, surface] of [
      [MATERIALS, 'working-materials'],
      [REVIEW, 'review'],
    ] as const) {
      const tab = tabs.find((t) => t.slug === slug);
      expect(tab, `the ${slug} entrance is gone`).toBeTruthy();
      expect(tab!.config.props?.initialSurface).toBe(surface);
    }
    // Participants and Locker are pruned as NAV ENTRANCES, not as
    // CAPABILITIES — the surface itself still implements both (SPEC §16: "no
    // second … Locker, chat system"; a reachable-by-URL `initialSurface`
    // could still target them). Checked against the component's own source
    // rather than the tab list, since the tab list is exactly what changed.
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toMatch(/<StewardParticipationTab initialDomain=\{accessDomain\}/);
    expect(src).toMatch(/research:\s*"research-lab"/);
    // The QubeTalk and Locker surfaces mount the EXISTING capabilities rather
    // than reimplementing them (SPEC §16: "no second … Locker, chat system").
    expect(src).toMatch(/<QubeTalkInboxTab domainFilter=\{accessDomain\}/);
    expect(src).toMatch(/<LockerTab \/>/);
  });
});

// ─── Canary R3 — FAIL-CLOSED PATH (ruling A, path 3) ─────────────────────────

describe('canary R3 — every other role, and no grant at all, is refused', () => {
  it('the research-lab roles NOT named by the workspace reach exactly nothing', async () => {
    const admitted = new Set(Object.keys(REACHES));
    const others = DOMAIN_ROLES['research-lab'].filter((r) => !admitted.has(r));
    // The fail-closed set is pinned LITERALLY as well as derived, so a role
    // quietly joining the admitted matrix cannot shrink this set to nothing and
    // leave the canary passing vacuously.
    expect(others.sort()).toEqual([...REACHES_NOTHING].sort());
    expect(others.length, 'every research-lab role is admitted — there is no fail-closed path').toBeGreaterThan(0);
    for (const role of others) {
      const a = access([{ accessDomain: 'research-lab', role, allowedScopes: [VP1] }]);
      expect(
        await reachableWorkspaceSlugs(a, false),
        `role '${role}' reached the Research Workspace without being granted one of the three workspace roles`,
      ).toEqual([]);
    }
  });

  it('no grant at all reaches nothing, and opens no workspace', async () => {
    const noGrants = access([]);
    expect(await reachableWorkspaceSlugs(noGrants, false)).toEqual([]);
    expect(satisfiesWorkspaceScope(noGrants, 'research-lab', VP1, false)).toBe(false);
    expect(scopesGrantedIn(noGrants, 'research-lab', false)).toEqual([]);
  });

  it('grants that have not loaded yet reach nothing — "not answered" never reads as "yes"', async () => {
    const unloaded: ParticipationAccessState = { loaded: false, grants: [] };
    expect(await reachableWorkspaceSlugs(unloaded, false)).toEqual([]);
    expect(satisfiesWorkspaceScope(unloaded, 'research-lab', VP1, false)).toBe(false);
  });

  it('a venture-lab grant confers nothing in the Research Lab, and vice versa', async () => {
    const ventureOnly = access([
      { accessDomain: 'venture-lab', role: 'workspace-steward', allowedScopes: [VP1] },
    ]);
    expect(await reachableWorkspaceSlugs(ventureOnly, false)).toEqual([]);
    expect(satisfiesWorkspaceScope(ventureOnly, 'research-lab', VP1, false)).toBe(false);
  });

  it('a researcher scoped to one programme cannot open another', () => {
    const scoped = access([
      { accessDomain: 'research-lab', role: 'researcher', allowedScopes: [VP1] },
    ]);
    expect(satisfiesWorkspaceScope(scoped, 'research-lab', OTHER_PROGRAMME, false)).toBe(false);
  });

  it('an UNSCOPED researcher grant sees the tabs but opens zero workspaces — deny-by-default', async () => {
    // Domain + role are enough to reach the group; scope is a separate, stricter
    // decision. This is the one place the two answers legitimately differ, and
    // the component renders the honest "not scoped yet" state rather than an
    // empty surface.
    const unscoped = access([{ accessDomain: 'research-lab', role: 'researcher' }]);
    expect(await reachableWorkspaceSlugs(unscoped, false)).toEqual([...FULL_PARTICIPATION].sort());
    expect(scopesGrantedIn(unscoped, 'research-lab', false)).toEqual([]);
    expect(satisfiesWorkspaceScope(unscoped, 'research-lab', VP1, false)).toBe(false);
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toMatch(/unscopedHint/);
  });
});

// ─── Canary R4 — no role was invented (ruling A's naming constraint) ─────────

describe('canary R4 — the workspace names only roles the access model already has', () => {
  it('every role on every workspace tab exists in DOMAIN_ROLES[research-lab]', async () => {
    const tabs = await workspaceTabs();
    const named = new Set<string>();
    for (const t of tabs) for (const r of t.participationRoles ?? []) named.add(r);
    expect(named.size, 'no workspace tab names a role — the role gate was removed').toBeGreaterThan(0);
    for (const role of named) {
      expect(
        DOMAIN_ROLES['research-lab'],
        `'${role}' is not a research-lab role — a role was minted at the surface instead of in the access model`,
      ).toContain(role);
    }
  });

  it('the spine projection names the roles the workspace TYPE admits, so surface and model cannot disagree', () => {
    // RE-POINTED for SPEC §6: the role set is now a function of the workspace
    // TYPE — a capstone cohort and a validation experiment are administered by
    // different people under different authority, and one flat list would let a
    // student's grant satisfy an experiment workspace's gate. Pinned per type,
    // literally, rather than asserted as "the same three everywhere".
    const byType: Record<string, string[]> = {
      'research-programme': ['principal-investigator', 'research-steward', 'reviewer', 'research-participant', 'researcher'],
      experiment: ['principal-investigator', 'research-steward', 'reviewer', 'research-participant', 'researcher'],
      cohort: ['faculty-lead', 'research-steward', 'student-researcher', 'research-participant'],
      'student-project': ['faculty-lead', 'student-researcher', 'research-participant'],
    };
    const seen = new Set<string>();
    for (const rw of RESEARCH_WORKSPACES) {
      const ws = experimentWorkspaceFromResearch(rw);
      expect(ws.participation.domain).toBe('research-lab');
      expect([...ws.participation.roles].sort(), `${rw.id} (${rw.workspaceType})`).toEqual(
        [...byType[rw.workspaceType]].sort(),
      );
      seen.add(rw.workspaceType);
    }
    // All four types must actually be instantiated, or the rows above are
    // asserting a mapping nothing exercises.
    expect([...seen].sort()).toEqual(Object.keys(byType).sort());
  });

  it('a capstone role can never satisfy an experiment workspace, and vice versa', () => {
    // The whole reason the role set is keyed by type. Both directions.
    const experiment = experimentWorkspaceFromResearch(
      RESEARCH_WORKSPACES.find((w) => w.workspaceType === 'experiment')!,
    );
    const project = experimentWorkspaceFromResearch(
      RESEARCH_WORKSPACES.find((w) => w.workspaceType === 'student-project')!,
    );
    expect(experiment.participation.roles).not.toContain('student-researcher');
    expect(experiment.participation.roles).not.toContain('faculty-lead');
    expect(project.participation.roles).not.toContain('principal-investigator');
    expect(project.participation.roles).not.toContain('reviewer');
  });

  it('the research-lab role catalogue grew by EXACTLY the three roles with no equivalent', () => {
    // RE-POINTED, and still an EXACT set. The 2026-07-28 ruling — "Do not invent
    // new names if equivalent roles already exist" — is honoured by REUSING
    // research-steward / reviewer / research-participant for the Research
    // Steward / External Reviewer / Institutional Observer. The three additions
    // are the roles SPEC-IRL-WORKSPACE-001 §8 names that have NO equivalent, and
    // mapping them onto an existing role would erase a real authority
    // difference rather than reuse a real one. This is the deliberate operator
    // decision the previous version of this canary demanded.
    expect([...DOMAIN_ROLES['research-lab']].sort()).toEqual(
      [
        'delegated-research-agent',
        'ratifier',
        'research-participant',
        'research-steward',
        'researcher',
        'reviewer',
        // Added 2026-07-29 by SPEC-IRL-WORKSPACE-001.
        'principal-investigator',
        'faculty-lead',
        'student-researcher',
      ].sort(),
    );
  });

  it('the three REUSED roles were not duplicated under a new name', () => {
    // The failure this guards: someone adds 'institutional-observer' and
    // 'external-reviewer' beside the roles that already mean exactly that,
    // and the access model now has two ids for one concept.
    for (const forbidden of ['institutional-observer', 'external-reviewer', 'principal-researcher']) {
      expect(
        DOMAIN_ROLES['research-lab'],
        `'${forbidden}' duplicates a role that already exists`,
      ).not.toContain(forbidden);
    }
  });
});

// ─── Canary R5 — the workspace can actually be granted to someone ────────────

describe('canary R5 — the scope catalogue makes the workspace grantable', () => {
  it('every research workspace is assignable as an invitation scope', () => {
    // Without this, no steward could ever scope a grant to the workspace, every
    // non-admin would fail `satisfiesWorkspaceScope`, and the surface would be
    // reachable by nobody while every denial canary stayed green — the exact
    // defect ruling C exists to prevent.
    expect(ASSIGNABLE_RESEARCH_WORKSPACES.map((w) => w.id).sort()).toEqual(
      RESEARCH_WORKSPACES.map((w) => w.id).sort(),
    );
    for (const entry of ASSIGNABLE_RESEARCH_WORKSPACES) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('the catalogue is DERIVED from the registry, not hand-listed', () => {
    const src = stripComments(readSource('services/research/researchWorkspace.ts'));
    const literal = src.match(/ASSIGNABLE_RESEARCH_WORKSPACES[\s\S]{0,300}/)?.[0] ?? '';
    expect(literal, 'ASSIGNABLE_RESEARCH_WORKSPACES hand-lists a workspace id').toMatch(
      /RESEARCH_WORKSPACES\.map/,
    );
  });

  it('it is COMPOSED with the experiment catalogue in the steward route, never replacing it', () => {
    const src = stripComments(readSource('app/api/steward/participation/route.ts'));
    expect(src).toMatch(
      /'research-lab': \[\.\.\.ASSIGNABLE_EXPERIMENTS, \.\.\.ASSIGNABLE_RESEARCH_WORKSPACES\]/,
    );
  });
});

// ─── Canary R6 — one derivation, three consumers (source-of-truth parity) ────

describe('canary R6 — registry, spine and surface cannot disagree about the programme', () => {
  it('every series/experiment binding a workspace declares resolves — never a copy of it', () => {
    // RE-POINTED for SPEC §6, and STRENGTHENED: a cohort or student project
    // convenes no series (a capstone is not a validation series, and giving one
    // a fake `seriesId` to satisfy a required field would put an invention in
    // the registry). So the rule is no longer "every workspace names a series"
    // but the stricter "every binding a workspace DOES declare must resolve,
    // AND a workspace with no binding must declare a title" — which the old
    // version did not check at all.
    expect(RESEARCH_WORKSPACES.length, 'the research registry is empty').toBeGreaterThan(0);
    let seriesBound = 0;
    let experimentBound = 0;
    for (const rw of RESEARCH_WORKSPACES) {
      if (rw.seriesId !== undefined) {
        seriesBound += 1;
        const series = researchWorkspaceSeries(rw);
        expect(series, `${rw.id} names series '${rw.seriesId}', which is not in SERIES_REGISTRY`).toBeTruthy();
        expect(SERIES_REGISTRY.map((s) => s.id)).toContain(rw.seriesId);
        const experiments = researchWorkspaceExperiments(rw);
        expect(experiments.length, `${rw.id}'s series has no resolvable members`).toBeGreaterThan(0);
        for (const e of experiments) {
          expect(EXPERIMENT_REGISTRY.map((x) => x.id)).toContain(e.id);
        }
        // The label and objectives must be the series' own words, not a copy.
        expect(researchWorkspaceLabel(rw)).toContain(series!.name);
        expect(researchWorkspaceObjectives(rw)[0]).toBe(series!.claim);
      }
      if (rw.experimentId !== undefined) {
        experimentBound += 1;
        const experiment = researchWorkspaceExperiment(rw);
        expect(
          experiment,
          `${rw.id} names experiment '${rw.experimentId}', which is not in EXPERIMENT_REGISTRY`,
        ).toBeTruthy();
        // Objectives are the experiment's own hypothesis — derived, not restated.
        expect(researchWorkspaceObjectives(rw)[0]).toBe(experiment!.hypothesis);
      }
      // NO WORKSPACE MAY FALL THROUGH TO ITS OWN ID AS A HEADING. An id rendered
      // as a name is indistinguishable from a name to everyone but its author.
      expect(
        researchWorkspaceLabel(rw),
        `${rw.id} has no derivable name and declares no title — its id would render as its heading`,
      ).not.toBe(rw.id);
      // And it must have some objective text, or invariant resolution reads
      // nothing and the Overview renders an empty promise.
      expect(researchWorkspaceObjectives(rw).length, `${rw.id} has no objectives`).toBeGreaterThan(0);
    }
    // Both binding kinds must actually be exercised, or half the branch above
    // is asserted against nothing.
    expect(seriesBound, 'no workspace convenes a series').toBeGreaterThan(0);
    expect(experimentBound, 'no workspace is scoped to a single experiment').toBeGreaterThan(0);
  });

  it('the hierarchy resolves: every parent exists, no cycles, and every type is instantiated', () => {
    const ids = new Set(RESEARCH_WORKSPACES.map((w) => w.id));
    expect(ids.size, 'duplicate workspace ids in the registry').toBe(RESEARCH_WORKSPACES.length);
    for (const rw of RESEARCH_WORKSPACES) {
      if (rw.parentId !== undefined) {
        expect(ids, `${rw.id} names parent '${rw.parentId}', which is not in the registry`).toContain(
          rw.parentId,
        );
        expect(researchWorkspaceParent(rw), `${rw.id}'s parent does not resolve`).toBeTruthy();
      }
      // The ancestry walk is cycle-GUARDED; this asserts the shipped data needs
      // no guard, so the guard never fires in a client render.
      const chain = researchWorkspaceAncestry(rw);
      expect(new Set(chain.map((c) => c.id)).size, `${rw.id} sits in a parent cycle`).toBe(chain.length);
      expect(chain[0].id).toBe(rw.id);
      // A root's ancestry is itself; a child's reaches a root that has no parent.
      expect(chain[chain.length - 1].parentId).toBeUndefined();
    }
    expect([...new Set(RESEARCH_WORKSPACES.map((w) => w.workspaceType))].sort()).toEqual(
      ['cohort', 'experiment', 'research-programme', 'student-project'].sort(),
    );
  });

  it('inheritance actually inherits — a child with no owner resolves its programme’s', () => {
    // The mechanism that lets a student project be three lines instead of forty.
    // Driven, not grepped: pick a real child that declares none of the three
    // inheritable fields and assert it resolves the root's.
    const child = RESEARCH_WORKSPACES.find(
      (w) => w.workspaceType === 'student-project' && w.ownerAgentId === undefined,
    );
    expect(child, 'no student project exercises inheritance').toBeTruthy();
    const root = researchWorkspaceAncestry(child!).at(-1)!;
    expect(root.ownerAgentId, 'the root declares no owner — inheritance has nothing to find').toBeTruthy();
    expect(researchWorkspaceOwner(child!)).toBe(root.ownerAgentId);
    expect(researchWorkspaceLayerOwners(child!)).toEqual(root.layerOwners);
    expect(researchWorkspaceLinks(child!)).toEqual(root.links);
    expect(researchWorkspaceInstitutions(child!)).toEqual(root.institutionRefs);
    // And the SPINE projects the inherited values, so the surface and the spine
    // cannot disagree about who owns a student project.
    const ws = experimentWorkspaceFromResearch(child!);
    expect(ws.agents.agentIds.length, 'an inherited workspace projects no acting agent').toBeGreaterThan(0);
    expect(workspaceReferenceIssues(ws)).toEqual([]);
  });

  it('the spine projects through the registry’s own derivations', () => {
    for (const rw of RESEARCH_WORKSPACES) {
      const ws = experimentWorkspaceFromResearch(rw);
      expect(ws.label).toBe(researchWorkspaceLabel(rw));
      expect(ws.objectives).toEqual(researchWorkspaceObjectives(rw));
      expect(ws.id).toBe(rw.id);
    }
  });

  it('the client surface reads the same derivations rather than rebuilding them', () => {
    // The component cannot import the spine (it reaches Supabase, the ontology
    // resolver and the invariant store). It therefore reads the SAME registry
    // helpers — this is what stops a second, drifting projection appearing in
    // the surface layer (inv.engineering.037).
    const auth = importAuthority(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    for (const name of [
      'listResearchWorkspaces',
      'researchWorkspaceLabel',
      'researchWorkspaceObjectives',
      'researchWorkspaceExperiments',
    ]) {
      expect(auth.boundNames.has(name), `the surface does not read ${name} — it may be rebuilding it`).toBe(true);
    }
    expect(
      auth.records.some((r) => r.specifier.includes('services/research/researchWorkspace')),
    ).toBe(true);
  });

  it('the research layer vocabulary is a filtered SUBSET, never a second list', () => {
    const src = stripComments(readSource('services/research/researchWorkspace.ts'));
    expect(src).toMatch(/PARTNER_WORKSPACE_LAYERS\.filter/);
    expect(RESEARCH_WORKSPACE_LAYERS.length).toBeGreaterThan(0);
    for (const rw of listResearchWorkspaces()) {
      // Resolved, so an INHERITED layer set is checked too — a child that
      // inherited a bad layer would otherwise escape this canary entirely.
      for (const layer of Object.keys(researchWorkspaceLayerOwners(rw))) {
        expect(RESEARCH_WORKSPACE_LAYERS, `layer '${layer}' is outside the research subset`).toContain(layer);
      }
    }
  });
});

// ─── Canary R7 — ONE surface component, two entrances ───────────────────────

describe('canary R7 — both Labs mount the same workspace implementation', () => {
  it('every IRL workspace subTab mounts PartnerProgrammesTab on the research domain', async () => {
    const tabs = await workspaceTabs();
    expect(tabs.length, 'the Workspace tab\'s subTabs are empty').toBe(EVERY_TAB.length);
    for (const t of tabs) {
      expect(t.config.component, `${t.id} mounts a different component — a second implementation`).toBe(
        'PartnerProgrammesTab',
      );
      expect(t.config.props?.workspaceDomain).toBe('research');
    }
  });

  it('the Venture Lab Tier-2 tabs still mount it on the venture domain (default, unchanged)', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tier2 = VENTURE_LAB_CODEX.tabs.filter(
      (t: { group?: string; participationDomain?: string; adminOnly?: boolean }) =>
        t.group === 'partner' && t.participationDomain === 'venture-lab' && !t.adminOnly,
    ) as Array<{ id: string; config: { component: string; props?: Record<string, unknown> } }>;
    expect(tier2.length).toBeGreaterThan(0);
    for (const t of tier2) {
      expect(t.config.component).toBe('PartnerProgrammesTab');
      // Absent = venture, deliberately: every pre-existing mount is unchanged.
      expect(t.config.props?.workspaceDomain).toBeUndefined();
    }
  });

  it('the Workspace TAB exists to be landed in, lives in Participation, and is not admin-only', async () => {
    // RE-POINTED 2026-07-29: there is no longer a `workspace` GROUP — the
    // research entrance is now the `irl-workspace` TAB, one tier up from its
    // own subTabs, inside the `participation` group. It DOES carry a
    // `participationDomain` gate of its own (deliberately, unlike the old
    // group, which carried none) — see the doc comment on the tab in
    // data/codex-configs.ts: the coarse domain-only gate at the parent lets
    // any research-lab grant land on the container, and the finer per-view
    // role split lives one tier deeper, on each subTab.
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const tab = IRL_CARTRIDGE.tabs.find((t: { id: string }) => t.id === 'irl-workspace') as
      | { group?: string; adminOnly?: boolean; participationDomain?: string; participationRoles?: string[] }
      | undefined;
    expect(tab, 'the Workspace tab was removed — Participation has nowhere to render it').toBeTruthy();
    expect(tab!.group).toBe('participation');
    expect(tab!.adminOnly, 'the Workspace tab took a blanket admin gate — the read-only path would vanish').toBeUndefined();
    expect(tab!.participationDomain).toBe('research-lab');
    // No role narrowing at the PARENT — narrowing happens per subTab instead.
    expect(tab!.participationRoles).toBeUndefined();
  });
});

// ─── Canary R8 — "Workspace" has a real UI referent (ruling B) ───────────────

describe('canary R8 — Workspace is a visible referent in both Labs', () => {
  // RE-POINTED 2026-07-28 at the operator's SECOND ruling of the same day, which
  // supersedes the first without weakening it. Ruling one said "Workspace must
  // have a real UI referent"; ruling two split the Venture Lab's workspace into
  // a PRIVATE (partner↔metaProof, Partner group) and a PUBLIC (cohort-facing,
  // Participate group) expression. The invariant this canary exists for is
  // unchanged and now stronger: BOTH expressions must name themselves, and the
  // public one must not name a partner.

  it('the IRL Workspace tab and both Venture Lab expressions name their surface', async () => {
    // RE-POINTED 2026-07-29: the IRL referent moved from a GROUP label
    // ("Research Workspace") to a TAB label — and the operator's own
    // instruction for the move was explicit: "labeled simply 'Workspace'".
    const { IRL_CARTRIDGE, VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tab = IRL_CARTRIDGE.tabs.find((t: { id: string }) => t.id === 'irl-workspace') as
      | { label: string }
      | undefined;
    expect(tab!.label).toBe('Workspace');
    const entrance = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-programmes');
    // PARTNER-AGNOSTIC by operator instruction: "labelled 'Public Workspace' —
    // NOT 'Partner Workspace'". The tab serves whichever partner public space
    // the viewing cohort qualifies for, so its label may name no partner.
    expect(entrance!.label).toBe('Public Workspace');
    expect(entrance!.label).not.toMatch(/Partner/);
    // 'Partner' may remain the GROUP label — the first ruling allows it
    // explicitly, and the second leaves it standing.
    const partnerGroup = (VENTURE_LAB_CODEX.tabGroups ?? []).find((g: { id: string }) => g.id === 'partner');
    expect(partnerGroup!.label).toBe('Partner');
  });

  it('the move changed no slug and no domain, and the role drop is the ruling', async () => {
    // The FIRST ruling's promise — "closes the representation gap WITHOUT
    // changing the underlying access model" — still binds the parts it named: a
    // slug change would break every issued deep link, and the domain gate is
    // what keeps a grantless caller out.
    //
    // The SECOND ruling deliberately drops `participationRoles` on THIS tab —
    // the one genuine access-model change, and the reason it is asserted here
    // as an explicit `toBeUndefined()` rather than left unstated: an absent
    // assertion would let the restriction silently return (breaking the
    // cross-partner surface) or spread (re-closing it) with nothing failing.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const entrance = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-programmes');
    expect(entrance!.slug).toBe('partner-programmes');
    expect(entrance!.participationDomain).toBe('venture-lab');
    expect(entrance!.participationRoles).toBeUndefined();
    expect(entrance!.adminOnly).toBeUndefined();
    // It now lives in Participate, and opens on the public posture.
    expect(entrance!.group).toBe('participate');
    expect(entrance!.config.props?.workspaceVisibility).toBe('public');
  });

  it('the surface renders its own name, not only the navigation', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    // Both venture expressions, each named — and the header must read the
    // VISIBILITY-keyed entry, or the two names exist in the map while one of
    // them can never reach the screen.
    expect(src).toMatch(/private: "Partner Private Workspace"/);
    expect(src).toMatch(/public: "Partner Public Workspace"/);
    expect(src).toMatch(/private: "Research Workspace"/);
    expect(src).toMatch(/\{copy\.surfaceName\[visibility\]\}/);
  });
});

// ─── Canary R9 — ruling C is recorded as doctrine, not only as this file ─────

describe('canary R9 — the reachability lesson is on the record', () => {
  const DOC = 'codexes/packs/agentiq/updates/2026-07-28_terminal-outcome-and-composed-liveness-invariants.md';

  it('Invariant B carries the denial-only corollary the operator ratified', () => {
    const doc = readSource(DOC);
    const section = doc.slice(doc.indexOf('## Invariant B'));
    expect(section.length, 'Invariant B is not in the doctrine document').toBeGreaterThan(500);
    // The COROLLARY itself, not only the quoted ruling. Pinning the quote alone
    // survives a mutation that keeps the operator's words while deleting the
    // corollary that gives them force — found by mutation M22 and fixed here.
    expect(section).toMatch(/A denial-only canary suite proves exclusion, not availability/);
    expect(section).toMatch(/denial canaries and at least[\s>]*one positive reachability canary/);
    expect(section).toMatch(/A denial-only suite proves exclusion, not availability/);
    // It must bind to capability completion, which is what makes it a gate on
    // new work rather than a retrospective observation.
    expect(section).toMatch(/capability-completion/i);
  });

  it('the doc is registered in the AgentiQ updates collection, with the updates/ prefix', async () => {
    const collections = JSON.parse(readSource('codexes/packs/agentiq/collections.json')) as {
      collections: Array<{ id: string; items: string[] }>;
    };
    const updates = collections.collections.find((c) => c.id === 'col_updates');
    expect(updates, 'col_updates is missing').toBeTruthy();
    expect(updates!.items).toContain('updates/2026-07-28_terminal-outcome-and-composed-liveness-invariants.md');
  });
});
