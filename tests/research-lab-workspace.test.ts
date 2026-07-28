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
  researchWorkspaceExperiments,
  researchWorkspaceLabel,
  researchWorkspaceObjectives,
} from '../services/research/researchWorkspace';
import { experimentWorkspaceFromResearch } from '../services/experiments/experimentWorkspace';
import { SERIES_REGISTRY, EXPERIMENT_REGISTRY } from '../types/research';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const VP1 = 'irl-validation-programme-vp1';
const OTHER_PROGRAMME = 'irl-some-other-programme'; // not in the registry, and must not need to be

const access = (
  grants: Array<{ accessDomain: string; role: string; allowedScopes?: string[] | null }>,
): ParticipationAccessState => ({ loaded: true, grants });

/** The workspace group's tabs, straight from the shipped config. */
async function workspaceTabs() {
  const { IRL_CARTRIDGE } = await import('../data/codex-configs');
  return IRL_CARTRIDGE.tabs.filter((t: { group?: string }) => t.group === 'workspace') as Array<{
    id: string;
    slug: string;
    label: string;
    enabled?: boolean;
    adminOnly?: boolean;
    participationDomain?: string;
    participationRoles?: string[];
    config: { component: string; props?: Record<string, unknown> };
  }>;
}

/** Every workspace-group slug this caller actually reaches, through the REAL filter. */
async function reachableWorkspaceSlugs(
  a: ParticipationAccessState,
  isAdmin: boolean,
): Promise<string[]> {
  const { IRL_CARTRIDGE } = await import('../data/codex-configs');
  const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
  return getEnabledTabs(
    IRL_CARTRIDGE,
    isAdmin,
    false, // isPartner
    false, // isInvestor
    new Set(),
    { isGlobalAdmin: isAdmin, cartridgeSlugs: new Set() },
    a,
  )
    .filter((t) => t.group === 'workspace')
    .map((t) => t.slug)
    .sort();
}

// The ratified tier split, pinned literally. Derived-only expectations would be
// tautological against the config they are checking.
const FULL_PARTICIPATION = [
  'irl-workspace-collaborate',
  'irl-workspace-evidence',
  'irl-workspace-operate',
  'irl-workspace-overview',
];
const READ_ONLY = ['irl-workspace-evidence', 'irl-workspace-overview'];
const TIER_0 = ['irl-workspace-administration'];
const EVERY_TAB = [...FULL_PARTICIPATION, ...TIER_0].sort();

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

  it('a research-steward reaches the same set, and holds the domain’s delegated invitation authority', async () => {
    const steward = access([
      { accessDomain: 'research-lab', role: 'research-steward', allowedScopes: [VP1] },
    ]);
    expect(await reachableWorkspaceSlugs(steward, false)).toEqual([...FULL_PARTICIPATION].sort());
    // "full workspace participation PLUS governance/review controls" is not a
    // second tab gate — it is the EXISTING server-side steward authority, and
    // research-steward must remain the role that carries it.
    expect(DOMAIN_STEWARD_ROLES['research-lab']).toContain('research-steward');
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
      (t) => FULL_PARTICIPATION.includes(t.slug) && !READ_ONLY.includes(t.slug),
    );
    expect(writeSurfaces.map((t) => t.slug).sort()).toEqual(
      ['irl-workspace-collaborate', 'irl-workspace-operate'].sort(),
    );
    for (const tab of writeSurfaces) {
      expect(
        satisfiesParticipationGate(tab, readOnly, false),
        `${tab.id} opened for a read-only participant — the read-only path is not read-only`,
      ).toBe(false);
    }
  });

  it('Collaborate is the surface that mounts the write affordances, so its exclusion is what makes read-only mean something', async () => {
    // If Collaborate stopped mounting the invitation/peer/locker workspace,
    // excluding it would no longer be excluding anything.
    const tabs = await workspaceTabs();
    const collab = tabs.find((t) => t.slug === 'irl-workspace-collaborate');
    expect(collab, 'the Collaborate entrance is gone').toBeTruthy();
    expect(collab!.config.props?.initialSurface).toBe('collaborate');
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toMatch(/collabView === "invitations"/);
    expect(src).toMatch(/<StewardParticipationTab initialDomain=\{accessDomain\}/);
    expect(src).toMatch(/research:\s*"research-lab"/);
  });
});

// ─── Canary R3 — FAIL-CLOSED PATH (ruling A, path 3) ─────────────────────────

describe('canary R3 — every other role, and no grant at all, is refused', () => {
  it('the research-lab roles NOT named by the workspace reach exactly nothing', async () => {
    const admitted = new Set(['researcher', 'research-steward', 'research-participant']);
    const others = DOMAIN_ROLES['research-lab'].filter((r) => !admitted.has(r));
    // The ruling's "all other roles" must be a real, non-empty set — otherwise
    // this canary passes vacuously.
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

  it('the spine projection names the same three roles, so surface and model cannot disagree', () => {
    for (const rw of RESEARCH_WORKSPACES) {
      const ws = experimentWorkspaceFromResearch(rw);
      expect(ws.participation.domain).toBe('research-lab');
      expect([...ws.participation.roles].sort()).toEqual(
        ['research-participant', 'research-steward', 'researcher'].sort(),
      );
    }
  });

  it('the research-lab role catalogue was not widened to make this work', () => {
    // The ruling: "Do not invent new names if equivalent roles already exist."
    // These six are the pre-existing catalogue; a seventh appearing here means
    // a role was minted rather than mapped, and must be a deliberate operator
    // decision rather than a side effect of building a surface.
    expect([...DOMAIN_ROLES['research-lab']].sort()).toEqual(
      [
        'delegated-research-agent',
        'ratifier',
        'research-participant',
        'research-steward',
        'researcher',
        'reviewer',
      ].sort(),
    );
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
  it('the registry references a real series and real experiments — never a copy of them', () => {
    expect(RESEARCH_WORKSPACES.length, 'the research registry is empty').toBeGreaterThan(0);
    for (const rw of RESEARCH_WORKSPACES) {
      const series = researchWorkspaceSeries(rw);
      expect(series, `${rw.id} names series '${rw.seriesId}', which is not in SERIES_REGISTRY`).toBeTruthy();
      expect(SERIES_REGISTRY.map((s) => s.id)).toContain(rw.seriesId);
      const experiments = researchWorkspaceExperiments(rw);
      expect(experiments.length, `${rw.id}'s series has no resolvable members`).toBeGreaterThan(0);
      for (const e of experiments) {
        expect(EXPERIMENT_REGISTRY.map((x) => x.id)).toContain(e.id);
      }
      // The label and objectives must be the series' own words, not a second copy.
      expect(researchWorkspaceLabel(rw)).toContain(series!.name);
      expect(researchWorkspaceObjectives(rw)[0]).toBe(series!.claim);
    }
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
      for (const layer of Object.keys(rw.layerOwners)) {
        expect(RESEARCH_WORKSPACE_LAYERS, `layer '${layer}' is outside the research subset`).toContain(layer);
      }
    }
  });
});

// ─── Canary R7 — ONE surface component, two entrances ───────────────────────

describe('canary R7 — both Labs mount the same workspace implementation', () => {
  it('every IRL workspace tab mounts PartnerProgrammesTab on the research domain', async () => {
    const tabs = await workspaceTabs();
    expect(tabs.length, 'the IRL Research Workspace group is empty').toBe(EVERY_TAB.length);
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

  it('the group exists to be landed in, and carries no gate of its own', async () => {
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const group = (IRL_CARTRIDGE.tabGroups ?? []).find((g: { id: string }) => g.id === 'workspace');
    expect(group, 'the Research Workspace group was removed — its tabs have nowhere to render').toBeTruthy();
    expect(group!.adminOnly, 'the group took a blanket admin gate — the read-only path would vanish').toBeUndefined();
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

  it('the IRL group and both Venture Lab expressions name their surface', async () => {
    const { IRL_CARTRIDGE, VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const group = (IRL_CARTRIDGE.tabGroups ?? []).find((g: { id: string }) => g.id === 'workspace');
    expect(group!.label).toBe('Research Workspace');
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
