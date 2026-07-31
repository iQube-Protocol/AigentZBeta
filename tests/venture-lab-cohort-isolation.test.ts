/**
 * Venture Lab cohort isolation + Partner role restriction canaries
 * (operator rulings 1–2, 2026-07-28; recorded as Amendment G to
 * `codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md`).
 *
 * WHAT THIS PROTECTS.
 *
 *  RULING 1 — "A generic `venture-lab` membership must never confer access
 *  across all pilot cohorts." `satisfiesWorkspaceScope` / `grantAllowsScope`
 *  (services/passport/participationTabGate.ts) is DENY-BY-DEFAULT: an
 *  unscoped grant (`allowedScopes` null/empty) opens ZERO workspaces, not all
 *  of them — the opposite default from the pre-existing research-lab
 *  `getGrantedExperiments`, which this file does not touch.
 *
 *  RULING 2 — "Partner access requires domain + scope + role." The four
 *  Tier-2 Partner tabs (`data/codex-configs.ts`) now carry
 *  `participationRoles: ['partner-operator', 'workspace-steward']` — a
 *  generic `observer` or `venture-participant` role must not satisfy them.
 *
 *  SEVEN REQUIRED CANARIES (operator, 2026-07-28), one describe block each.
 */

import { describe, it, expect } from 'vitest';
import {
  satisfiesParticipationGate,
  tabPassesAccessGates,
  satisfiesWorkspaceScope,
  grantAllowsScope,
  scopesGrantedIn,
  type ParticipationAccessState,
} from '../services/passport/participationTabGate';
import { readSource } from './_lib/sourceAuthority';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const HORIZEN = 'horizen-pilot-series-001';
const OTHER_PILOT = 'project-liberty-pilot-001'; // hypothetical second pilot — not in the registry yet, and must not need to be for this canary to hold

const access = (grants: Array<{ accessDomain: string; role: string; allowedScopes?: string[] | null }>): ParticipationAccessState => ({
  loaded: true,
  grants,
});

// ─── Canary 1 — a Horizen participant cannot reach another cohort's workspace ─

describe('canary 1 — cross-cohort workspace isolation', () => {
  it('a grant scoped to Horizen does not open a different pilot workspace', () => {
    const a = access([{ accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] }]);
    expect(satisfiesWorkspaceScope(a, 'venture-lab', HORIZEN, false)).toBe(true);
    expect(satisfiesWorkspaceScope(a, 'venture-lab', OTHER_PILOT, false)).toBe(false);
  });

  it('grantAllowsScope is the same decision at the single-grant level', () => {
    const grant = { accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] };
    expect(grantAllowsScope(grant, HORIZEN)).toBe(true);
    expect(grantAllowsScope(grant, OTHER_PILOT)).toBe(false);
  });
});

// ─── Canary 2 — a Participant cannot reach Partner operational content ────────

describe('canary 2 — Participant does not satisfy Partner access', () => {
  it('a plain venture-participant role fails the Partner tabs’ role gate', () => {
    const partnerTab = { participationDomain: 'venture-lab', participationRoles: ['partner-operator', 'workspace-steward'] };
    const a = access([{ accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] }]);
    expect(satisfiesParticipationGate(partnerTab, a, false)).toBe(false);
    expect(tabPassesAccessGates(partnerTab, a, false)).toBe(false);
  });

  it('the real config: every Tier-2 Partner tab in VENTURE_LAB_CODEX carries the role restriction', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tier2PartnerTabs = VENTURE_LAB_CODEX.tabs.filter(
      (t: { group?: string; participationDomain?: string; adminOnly?: boolean }) =>
        t.group === 'partner' && t.participationDomain === 'venture-lab' && !t.adminOnly,
    );
    expect(tier2PartnerTabs.length, 'no Tier-2 Partner tabs found — the split regressed').toBeGreaterThan(0);
    for (const tab of tier2PartnerTabs as Array<{ id: string; participationRoles?: string[] }>) {
      expect(tab.participationRoles, `${tab.id} has no participationRoles — any venture-lab role satisfies it`).toBeTruthy();
      expect(tab.participationRoles).toEqual(expect.arrayContaining(['partner-operator', 'workspace-steward']));
      // A generic participant role must not be in the allow-list.
      expect(tab.participationRoles).not.toContain('venture-participant');
      expect(tab.participationRoles).not.toContain('observer');
    }
  });
});

// ─── Canary 3 — Observer role specifically does not satisfy Partner access ────

describe('canary 3 — observer role does not satisfy Partner role requirements', () => {
  it('an observer, even with the right domain and scope, is refused', () => {
    const partnerTab = { participationDomain: 'venture-lab', participationRoles: ['partner-operator', 'workspace-steward'] };
    const a = access([{ accessDomain: 'venture-lab', role: 'observer', allowedScopes: [HORIZEN] }]);
    expect(satisfiesParticipationGate(partnerTab, a, false)).toBe(false);
  });

  it('the same observer DOES satisfy a role-unrestricted venture-lab tab (role gate is additive, not a re-implementation of domain)', () => {
    const openParticipateTab = { participationDomain: 'venture-lab' }; // no participationRoles
    const a = access([{ accessDomain: 'venture-lab', role: 'observer', allowedScopes: [HORIZEN] }]);
    expect(satisfiesParticipationGate(openParticipateTab, a, false)).toBe(true);
  });
});

// ─── Canary 4 — a Horizen partner operator cannot reach another partner's workspace ─

describe('canary 4 — Partner role does not bypass scope', () => {
  it('a partner-operator scoped to Horizen is refused a different pilot’s workspace', () => {
    const a = access([{ accessDomain: 'venture-lab', role: 'partner-operator', allowedScopes: [HORIZEN] }]);
    // Domain + role are satisfied — only scope refuses.
    const partnerTab = { participationDomain: 'venture-lab', participationRoles: ['partner-operator', 'workspace-steward'] };
    expect(satisfiesParticipationGate(partnerTab, a, false)).toBe(true); // sees the Partner GROUP
    expect(satisfiesWorkspaceScope(a, 'venture-lab', OTHER_PILOT, false)).toBe(false); // but not this WORKSPACE
    expect(satisfiesWorkspaceScope(a, 'venture-lab', HORIZEN, false)).toBe(true); // only their own
  });

  it('the live workspace route enforces this — not just the client gate', () => {
    const src = readSource('app/api/venture/workspace/[workspaceId]/route.ts');
    expect(src).toMatch(/satisfiesWorkspaceScope\(/);
    // The membership decision must be keyed to THIS workspace's id, not the
    // domain alone — ws.id is the scope argument.
    expect(src).toMatch(/satisfiesWorkspaceScope\(\s*\{[^}]*grants[^}]*\},\s*ws\.participation\.domain,\s*ws\.id,\s*isAdmin\s*\)/s);
  });
});

// ─── Canary 5 — admin capability does not leak into a non-admin call ─────────

describe('canary 5 — admin scope resolution does not leak across calls', () => {
  it('isAdmin is a per-call argument, not accumulated state: interleaved admin/non-admin calls never cross-contaminate', () => {
    const scopedOnlyToA = access([{ accessDomain: 'venture-lab', role: 'workspace-steward', allowedScopes: [HORIZEN] }]);
    // Warm the function with an ADMIN call first (the scenario the ruling
    // names: "an internal administrator can administer multiple scoped
    // programmes"). If any module-level memoization keyed off partial input
    // existed, the immediately-following NON-ADMIN call for the SAME access
    // object would incorrectly inherit the admin's unrestricted view.
    expect(scopesGrantedIn(scopedOnlyToA, 'venture-lab', true)).toBe('all');
    expect(satisfiesWorkspaceScope(scopedOnlyToA, 'venture-lab', OTHER_PILOT, true)).toBe(true);
    // Immediately after, the SAME persona's grants evaluated as non-admin must
    // fall back to exactly what their own grant scopes — never 'all'.
    expect(scopesGrantedIn(scopedOnlyToA, 'venture-lab', false)).toEqual([HORIZEN]);
    expect(satisfiesWorkspaceScope(scopedOnlyToA, 'venture-lab', OTHER_PILOT, false)).toBe(false);
    expect(satisfiesWorkspaceScope(scopedOnlyToA, 'venture-lab', HORIZEN, false)).toBe(true);
    // And repeating the admin call again afterward still returns 'all' — the
    // non-admin call in between did not narrow it either. Independence in
    // both directions.
    expect(scopesGrantedIn(scopedOnlyToA, 'venture-lab', true)).toBe('all');
  });

  it('the gate module holds no module-level mutable state to leak through', () => {
    const src = readSource('services/passport/participationTabGate.ts');
    // No cache/memo/module-level `let` — every exported decision function
    // takes its access state as an argument and returns a fresh answer.
    expect(src).not.toMatch(/\blet\s+\w+\s*[:=]/);
    expect(src).not.toMatch(/\bcache\b/i);
    expect(src).not.toMatch(/\bmemo/i);
  });
});

// ─── Canary 6 — Public/Community access confers nothing ──────────────────────

describe('canary 6 — Public/Community (no grant) confers no Participant, Partner, or Commons admission', () => {
  it('zero venture-lab grants fails every venture-lab-gated tab and every workspace', async () => {
    const noGrants = access([]); // the Public/Community baseline: authenticated, no domain grant
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const gatedTabs = VENTURE_LAB_CODEX.tabs.filter(
      (t: { participationDomain?: string }) => t.participationDomain === 'venture-lab',
    );
    expect(gatedTabs.length).toBeGreaterThan(0);
    for (const tab of gatedTabs as Array<{ id: string; participationDomain?: string; participationRoles?: string[]; adminOnly?: boolean }>) {
      expect(tabPassesAccessGates(tab, noGrants, false), `${tab.id} opened with no grant at all`).toBe(false);
    }
    expect(satisfiesWorkspaceScope(noGrants, 'venture-lab', HORIZEN, false)).toBe(false);
    expect(scopesGrantedIn(noGrants, 'venture-lab', false)).toEqual([]);
  });

  it('the six currently-open Venture Lab tabs are the only ones reachable with no grant, and none of them is participationDomain-gated', async () => {
    // This is the audit's own six-tab finding, re-asserted as a canary so a
    // future edit that quietly adds participationDomain (or removes it,
    // implicitly widening some OTHER tab) is caught. Deliberately not a
    // claim that these six ARE the Public/Community domain — see the
    // 2026-07-28 build record's explicit per-tab classification.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const openIds = ['founder-office', 'founders-club', 'financial-services', 'commercial-funnel', 'growth-matrix', 'portfolio'];
    for (const id of openIds) {
      const tab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === id);
      expect(tab, `${id} is missing from VENTURE_LAB_CODEX`).toBeTruthy();
      expect(tab!.adminOnly, `${id} unexpectedly became adminOnly`).toBeFalsy();
      expect(tab!.participationDomain, `${id} unexpectedly became participationDomain-gated`).toBeUndefined();
    }
  });
});

// ─── Canary 7 — Commons access is governed independently of venture-lab ──────

describe('canary 7 — Commons gating does not exist as a venture-lab derivative (verified, not asserted)', () => {
  it('no API route derives Commons access from a venture-lab participation grant', () => {
    // The Commons has NO built surface yet (Amendment F §F.2: "Commons — Does
    // not exist anywhere. This is Phase 5"). This canary verifies that
    // absence rather than asserting the abstract principle — a genuine
    // negative-existence check over the API tree, so it will FAIL the moment
    // Phase 5 adds a Commons route that (incorrectly) keys off venture-lab
    // domain membership instead of the governed-proof gate Amendments D/E
    // specify (Principle P5).
    const apiRoot = join(process.cwd(), 'app', 'api');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) { walk(full); continue; }
        if (!/route\.ts$/.test(entry)) continue;
        if (!/commons/i.test(full)) continue;
        const src = readFileSync(full, 'utf-8');
        if (/venture-lab/.test(src)) offenders.push(full);
      }
    };
    // No app/api/**/commons* directory exists today — this loop is
    // intentionally a no-op until Phase 5, which is the point: the test
    // fails LOUD (via the length assertion below) if that ceases to be true
    // without this file being updated to actually check the new route.
    let commonsRouteExists = false;
    const walkForExistence = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) { walkForExistence(full); continue; }
        if (/commons/i.test(full)) commonsRouteExists = true;
      }
    };
    walkForExistence(apiRoot);
    expect(commonsRouteExists, 'a Commons route now exists — this canary must be extended to check its gating, not left as a no-op').toBe(false);
    walk(apiRoot);
    expect(offenders).toEqual([]);
  });

  it('the governed-proof gate (Principle P5) is still recorded, not silently replaced by a domain-membership shortcut', () => {
    const audit = readSource('codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md');
    expect(audit).toMatch(/Only governed proof enters the metaProof Commons/);
    // Guard against the exact regression this canary exists for: the Commons
    // principle must never be restated as "any venture-lab participant".
    expect(audit).not.toMatch(/venture-lab (grant|membership|participation) (grants|confers|opens).{0,40}[Cc]ommons/);
  });
});

// ─── Canary 8 — COMPOSED LIVENESS (Invariant B, ratified 2026-07-28) ─────────
//
// Canaries 1–7 are all DENIALS. Every one of them proves some caller is
// refused; not one proves any caller is ADMITTED. That is exactly the gap
// Invariant B (`codexes/packs/agentiq/updates/
// 2026-07-28_terminal-outcome-and-composed-liveness-invariants.md`) names:
//
//   "When an invariant lands, it must name the invariants it composes with, and
//    the composition must ship a liveness canary: one demonstrated end-to-end
//    path through every gate the composed system creates."
//
// Amendment G composed FOUR gates on one surface — domain (canary 6), role
// (canaries 2–3), scope (canaries 1, 4), and admin (canary 5) — and shipped
// without one. A suite of pure denials passes at its maximum when the surface
// is unreachable by EVERYONE, so nothing in this file would have failed if
// deny-by-default had closed the Partner Workspace to every non-admin. That is
// the operator's standing report ("I still don't see the workspace") stated as
// a test gap: absence was never distinguishable from correct denial.
//
// THIS BLOCK NEVER WEAKENS A GATE. Every assertion below is positive
// reachability for a caller who genuinely satisfies all four gates. It composes
// with: canary 2/3 (the same role list, from the other side), canary 4 (the
// same scope decision, admitting instead of refusing), canary 6 (the same tab
// set, non-empty instead of empty), and `tests/tier-surface-map.test.ts` (the
// entrance whose existence it now proves is also REACHABLE).

describe('canary 8 — composed liveness: the Partner Workspace is reachable by someone', () => {
  /** The caller Amendment G's four gates were written to admit. */
  const grantedPartnerOperator = access([
    { accessDomain: 'venture-lab', role: 'partner-operator', allowedScopes: [HORIZEN] },
  ]);

  it('a correctly-granted, NON-admin partner operator passes every Tier-2 Partner tab gate', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tier2PartnerTabs = VENTURE_LAB_CODEX.tabs.filter(
      (t: { group?: string; participationDomain?: string; adminOnly?: boolean }) =>
        t.group === 'partner' && t.participationDomain === 'venture-lab' && !t.adminOnly,
    );
    expect(tier2PartnerTabs.length, 'no Tier-2 Partner tabs exist to be reachable').toBeGreaterThan(0);
    for (const tab of tier2PartnerTabs as Array<{ id: string }>) {
      expect(
        tabPassesAccessGates(tab, grantedPartnerOperator, false),
        `${tab.id} is unreachable by a partner-operator scoped to ${HORIZEN} — the gates admit nobody`,
      ).toBe(true);
    }
  });

  it('those tabs survive the REAL tab filter, so the Partner group actually renders', async () => {
    // The gate predicate passing is necessary but not sufficient: the surface
    // is `getEnabledTabs` (app/hooks/useCodexConfig), and CodexPanelDynamic
    // hides a group with no visible tabs (MS-9). Drive the real filter with
    // the real config — a non-admin, non-partner, non-investor caller with no
    // activations and no cartridge-admin grants, i.e. nothing BUT the grant.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
    const enabled = getEnabledTabs(
      VENTURE_LAB_CODEX,
      false, // isAdmin
      false, // isPartner
      false, // isInvestor
      new Set(),
      { isGlobalAdmin: false, cartridgeSlugs: new Set() },
      grantedPartnerOperator,
    );
    const partnerTabs = enabled.filter((t) => t.group === 'partner');
    // This is verbatim the predicate CodexPanelDynamic's `visibleGroups` uses.
    expect(
      partnerTabs.length,
      'the Partner group filters to empty for a granted partner operator — the group chip would not render at all',
    ).toBeGreaterThan(0);
    // Reachability is asserted per-tab, not as a count: a `>0` assertion is
    // satisfied by ANY surviving tab, so it would stay green while the Tier-2
    // views specifically went dark. The set must be EXACTLY the Tier-2 views
    // — no Tier-0 tab may leak in either (that would be a gate breach, not a
    // liveness win).
    const expectedTier2 = VENTURE_LAB_CODEX.tabs
      .filter(
        (t: { group?: string; participationDomain?: string; adminOnly?: boolean }) =>
          t.group === 'partner' && t.participationDomain === 'venture-lab' && !t.adminOnly,
      )
      .map((t: { slug: string }) => t.slug)
      .sort();
    expect(partnerTabs.map((t) => t.slug).sort()).toEqual(expectedTier2);
    // And the group they would land in must exist to be landed in.
    const partnerGroup = (VENTURE_LAB_CODEX.tabGroups ?? []).find((g: { id: string }) => g.id === 'partner');
    expect(partnerGroup, 'the Partner group was removed — its tabs have nowhere to render').toBeTruthy();
  });

  it('and the workspace behind those tabs opens for the same caller — the picker lists exactly one entrance', () => {
    // Scope is a SEPARATE decision from the tab gate (see the module header):
    // passing the tabs and then finding an empty picker is the same invisible
    // surface from the operator's seat. Both must hold for the SAME caller.
    expect(satisfiesWorkspaceScope(grantedPartnerOperator, 'venture-lab', HORIZEN, false)).toBe(true);
    expect(scopesGrantedIn(grantedPartnerOperator, 'venture-lab', false)).toEqual([HORIZEN]);
  });

  it('an admin reaches the same surface without any grant at all', async () => {
    // The other end-to-end path. An admin holds no venture-lab grant (canary 5
    // covers the isolation); if the admin fast-path regressed, the operator's
    // OWN view of the workspace would go dark while every denial canary
    // stayed green.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
    const noGrants = access([]);
    const enabled = getEnabledTabs(
      VENTURE_LAB_CODEX,
      true, // isAdmin
      false,
      false,
      new Set(),
      { isGlobalAdmin: true, cartridgeSlugs: new Set() },
      noGrants,
    );
    const partnerTabs = enabled.filter((t) => t.group === 'partner');
    // EVERY Partner tab, Tier 0 and Tier 2 — not merely a non-empty group.
    // The two Tier-0 tabs carry no `participationDomain`, so they survive a
    // broken admin fast path and would keep a `>0` assertion green while the
    // operator's own view of the Tier-2 workspace went dark.
    const allPartnerSlugs = VENTURE_LAB_CODEX.tabs
      .filter((t: { group?: string }) => t.group === 'partner')
      .map((t: { slug: string }) => t.slug)
      .sort();
    expect(
      partnerTabs.map((t) => t.slug).sort(),
      'an admin cannot see the whole Partner group — the admin fast path regressed',
    ).toEqual(allPartnerSlugs);
    expect(satisfiesWorkspaceScope(noGrants, 'venture-lab', HORIZEN, true)).toBe(true);
    expect(scopesGrantedIn(noGrants, 'venture-lab', true)).toBe('all');
  });
});

// ─── Canary 9 — every workspace on the spine has a cartridge entrance ────────
//
// THE DEFECT CLASS THIS CATCHES, stated plainly: a workspace can exist in the
// MODEL and have no door in any cartridge. That is not a gate failure — every
// gate is behaving correctly — and no denial canary can see it, because there
// is nothing to deny. It reads to the operator exactly like a gate failure:
// "I don't see the workspace."
//
// `services/experiments/experimentWorkspace.ts` is the COMMON spine shared by
// the Research Lab and the Venture Lab, and `listExperimentWorkspaces()` says
// "Research variants join in Phase 4". Today it yields venture workspaces only,
// and the Venture Lab carries their entrance — so this canary passes as
// written, honestly, rather than failing for unbuilt work (the discipline
// `tests/tier-surface-map.test.ts` states in its own header). The moment a
// research workspace joins the spine WITHOUT an IRL entrance, this fails and
// names the missing surface instead of the operator having to find it.
//
// The binding is DERIVED, never hand-listed (inv.engineering.036): a workspace
// already declares `evidence.cartridge` (the codex slug that holds its
// evidence) and `participation.domain` (the access domain that gates it). The
// entrance is the tab in that cartridge gated on that domain.

describe('canary 9 — a workspace in the model has a door in a cartridge', () => {
  it('every workspace on the common spine resolves to a real cartridge with a domain-gated entrance', async () => {
    const { listExperimentWorkspaces } = await import('../services/experiments/experimentWorkspace');
    const { CODEX_DEFINITIONS } = await import('../data/codex-configs');
    const workspaces = listExperimentWorkspaces();
    expect(workspaces.length, 'the spine is empty — nothing to check').toBeGreaterThan(0);
    for (const ws of workspaces) {
      const cartridge = CODEX_DEFINITIONS.find((c: { slug: string }) => c.slug === ws.evidence.cartridge);
      expect(
        cartridge,
        `workspace "${ws.id}" declares evidence cartridge "${ws.evidence.cartridge}", which is not a registered codex — the workspace has no door`,
      ).toBeTruthy();
      const entrances = cartridge!.tabs.filter(
        (t: { enabled?: boolean; participationDomain?: string }) =>
          t.enabled !== false && t.participationDomain === ws.participation.domain,
      );
      expect(
        entrances.length,
        `workspace "${ws.id}" (domain ${ws.participation.domain}) has NO entrance in cartridge "${ws.evidence.cartridge}" — it exists in the model with no tab to reach it`,
      ).toBeGreaterThan(0);
    }
  });

  it('the research half of the spine is populated, and its door is in the IRL cartridge', async () => {
    // SUPERSEDES the "Research variants join in Phase 4" pin this canary
    // carried until 2026-07-28. That pin kept the gap KNOWN while it was a
    // gap; keeping it after the gap closed would have asserted the opposite of
    // the truth. What replaces it is the stronger claim: research workspaces
    // now exist AND every one of them resolves to a real, enabled,
    // research-lab-gated entrance in the IRL cartridge — which is exactly what
    // the first assertion of this canary was written to fail on.
    const { listExperimentWorkspaces } = await import('../services/experiments/experimentWorkspace');
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const research = listExperimentWorkspaces().filter((w) => w.domain === 'research');
    expect(research.length, 'the research half of the spine is empty again').toBeGreaterThan(0);
    for (const ws of research) {
      expect(
        ws.evidence.cartridge,
        `${ws.id} points its evidence at a cartridge other than the IRL one`,
      ).toBe(IRL_CARTRIDGE.slug);
      expect(ws.participation.domain).toBe('research-lab');
    }
  });
});

// ─── Canary 10 — the Partner group is INVISIBLE, not merely empty ────────────
//
// Added 2026-07-28 with the operator's structural ruling: "The Partner group
// renders only to partner ops/personnel cohorts and metaMe admins — invisible
// to everyone else, not merely empty."
//
// The distinction is the whole canary. A group chip that renders and then shows
// nothing is a DIFFERENT (and worse) outcome than no chip at all: it advertises
// a surface the caller cannot have, and it is the exact failure the group-level
// `adminOnly` used to prevent before the tier split removed it. The replacement
// is structural — CodexPanelDynamic's `visibleGroups` drops a group with no
// enabled tabs (MS-9) — so this canary drives the REAL tab filter and then
// applies that verbatim predicate, rather than asserting the gate predicate
// alone (which would stay green while the chip rendered anyway).
//
// It composes with canary 8: the same `getEnabledTabs` call, the same caller
// shape, asserting the opposite outcome for a caller who does not qualify.

describe('canary 10 — Partner is invisible to a non-partner venture-lab member', () => {
  const partnerGroupRenders = async (
    access: ParticipationAccessState,
    isAdmin: boolean,
  ): Promise<{ renders: boolean; slugs: string[] }> => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
    const enabled = getEnabledTabs(
      VENTURE_LAB_CODEX,
      isAdmin,
      false,
      false,
      new Set(),
      { isGlobalAdmin: isAdmin, cartridgeSlugs: new Set() },
      access,
    );
    const partnerTabs = enabled.filter((t) => t.group === 'partner');
    // Verbatim the predicate CodexPanelDynamic's `visibleGroups` uses (MS-9).
    return { renders: partnerTabs.length > 0, slugs: partnerTabs.map((t) => t.slug).sort() };
  };

  it('a venture-participant scoped to a real pilot sees NO Partner tab at all — the chip does not render', async () => {
    const participant = access([
      { accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] },
    ]);
    const { renders, slugs } = await partnerGroupRenders(participant, false);
    // The EXACT set, not a count: an empty-set assertion is what distinguishes
    // "invisible" from "renders with one surviving tab".
    expect(slugs, 'a plain participant reached a Partner surface').toEqual([]);
    expect(renders, 'the Partner chip renders for a caller with nothing in it').toBe(false);
  });

  it('an observer with the same scope likewise sees no Partner chip', async () => {
    const observer = access([{ accessDomain: 'venture-lab', role: 'observer', allowedScopes: [HORIZEN] }]);
    const { renders, slugs } = await partnerGroupRenders(observer, false);
    expect(slugs).toEqual([]);
    expect(renders).toBe(false);
  });

  it('a partner-operator DOES see it — exactly the three Tier-2 views, no Tier-0 leak', async () => {
    // The liveness half. Without it, "invisible to everyone" would pass at its
    // maximum with the group closed to the partner operators it exists for.
    //
    // THE EXPECTATION IS A LITERAL LIST, deliberately. Deriving it from the
    // config with `!t.adminOnly` — the same predicate the filter uses — is
    // TAUTOLOGICAL: admin-gating one Tier-2 view removes it from the expected
    // set and the actual set together, and the canary stays green while that
    // view goes dark for the operator it exists for. Found by mutation-testing
    // this very block (M3, 2026-07-28), which survived the derived version.
    const operator = access([
      { accessDomain: 'venture-lab', role: 'partner-operator', allowedScopes: [HORIZEN] },
    ]);
    const { renders, slugs } = await partnerGroupRenders(operator, false);
    expect(renders).toBe(true);
    // 'partner-pilot-journey' added 2026-07-31 (PRD-GJR-001, Guided Journey
    // Runtime, operator-directed) — a fourth Tier 2 view alongside these three.
    expect(slugs).toEqual(['partner-collaborate', 'partner-evidence', 'partner-operate', 'partner-pilot-journey']);
  });

  it('a metaMe admin sees the whole group, Tier 0 included', async () => {
    // Literal, for the same reason as the block above: deriving "every Partner
    // tab" from the config makes a DELETED tab invisible to the assertion.
    const { slugs } = await partnerGroupRenders(access([]), true);
    // 'partner-pilot-journey' added 2026-07-31 (PRD-GJR-001, Guided Journey
    // Runtime, operator-directed).
    expect(slugs).toEqual([
      'partner-administration',
      'partner-collaborate',
      'partner-communicate',
      'partner-evidence',
      'partner-operate',
      'partner-pilot-journey',
    ]);
  });

  it('every remaining Partner tab carries a gate — invisibility is a property of the tabs, not a coincidence', async () => {
    // MS-9 only hides the group if EVERY tab is gated away. One ungated tab
    // reopens the chip to the whole cartridge audience, and nothing above would
    // catch it if that tab happened to be gated for the two callers tested.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const partnerTabs = VENTURE_LAB_CODEX.tabs.filter((t: { group?: string }) => t.group === 'partner') as Array<{
      id: string;
      adminOnly?: boolean;
      participationDomain?: string;
      participationRoles?: string[];
    }>;
    expect(partnerTabs.length).toBeGreaterThan(0);
    for (const t of partnerTabs) {
      const gated =
        t.adminOnly === true ||
        (t.participationDomain === 'venture-lab' &&
          Array.isArray(t.participationRoles) &&
          t.participationRoles.length > 0);
      expect(gated, `${t.id} is ungated — the Partner chip becomes visible to every venture-lab member`).toBe(true);
      if (!t.adminOnly) {
        expect(t.participationRoles).toEqual(expect.arrayContaining(['partner-operator', 'workspace-steward']));
        expect(t.participationRoles).not.toContain('venture-participant');
        expect(t.participationRoles).not.toContain('observer');
      }
    }
  });
});

// ─── Canary 11 — the Public Workspace: reachable by the cohort, isolated ─────
//
// The operator's structural ruling moved the public workspace surface out of
// Partner into Participate, dropping its role restriction so that "every user
// with Venture Lab access gets an iteration of it". That is the one gate this
// ruling deliberately widens, so it needs BOTH halves asserted here:
//
//   LIVENESS  — a plain venture-participant reaches it (the point of the move),
//               through the real filter, and the workspace picker admits the
//               same caller (passing the tab gate and then finding an empty
//               picker is the same invisible surface from the operator's seat).
//   ISOLATION — the widening is on ROLE only. Domain still excludes a grantless
//               caller, and SCOPE still excludes another cohort's workspace.
//               Cohort isolation is the invariant the move must not touch.

describe('canary 11 — the Public Workspace is cross-partner, not cross-cohort', () => {
  const PUBLIC_TAB_ID = 'partner-programmes';

  const participateTabs = async (access: ParticipationAccessState, isAdmin: boolean) => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
    return getEnabledTabs(
      VENTURE_LAB_CODEX,
      isAdmin,
      false,
      false,
      new Set(),
      { isGlobalAdmin: isAdmin, cartridgeSlugs: new Set() },
      access,
    ).filter((t) => t.group === 'participate');
  };

  it('a plain venture-participant reaches it through the REAL tab filter', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const participant = access([
      { accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] },
    ]);
    const slugs = (await participateTabs(participant, false)).map((t) => t.slug).sort();
    const publicTab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === PUBLIC_TAB_ID)!;
    expect(publicTab.group, 'the Public Workspace is not in the Participate group').toBe('participate');
    expect(slugs, 'the Public Workspace is unreachable by an ordinary venture-lab participant').toContain(
      publicTab.slug,
    );
    // The EXACT set a non-admin participant gets: every Participate tab except
    // the admin-gated Steward. A `toContain` alone stays green while some other
    // Participate surface silently opened or closed — and a set DERIVED with
    // `!t.adminOnly` is tautological, since gating a tab removes it from both
    // sides at once. Literal list, therefore.
    expect(slugs).toEqual([
      'partner-programmes',
      'venture-participate-apply',
      'venture-participate-delegation',
      'venture-participate-locker',
      'venture-participate-overview',
      'venture-participate-standing',
    ]);
  });

  it('…and the workspace behind it opens for that SAME caller — the picker is not empty', () => {
    // A separate decision from the tab gate, so it is asserted for the same
    // caller rather than assumed to follow.
    const participant = access([
      { accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] },
    ]);
    expect(satisfiesWorkspaceScope(participant, 'venture-lab', HORIZEN, false)).toBe(true);
    expect(scopesGrantedIn(participant, 'venture-lab', false)).toEqual([HORIZEN]);
  });

  it('the widening is ROLE-only: a caller with no venture-lab grant still cannot see it', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const publicTab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === PUBLIC_TAB_ID)!;
    // The domain gate is what stops the move from opening the surface to the
    // whole cartridge audience — pinned as config AND driven as a decision.
    expect(publicTab.participationDomain).toBe('venture-lab');
    expect(tabPassesAccessGates(publicTab, access([]), false)).toBe(false);
    const slugs = (await participateTabs(access([]), false)).map((t) => t.slug);
    expect(slugs, 'a caller with no venture-lab grant reached the Public Workspace').not.toContain(publicTab.slug);
  });

  it('cohort isolation survives the move: one cohort still cannot open another cohort’s public workspace', () => {
    const horizenParticipant = access([
      { accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [HORIZEN] },
    ]);
    expect(satisfiesWorkspaceScope(horizenParticipant, 'venture-lab', OTHER_PILOT, false)).toBe(false);
    // An unscoped venture-lab grant sees the TAB (domain satisfied) and NO
    // workspace inside it (deny-by-default) — the "visible tab, no qualifying
    // workspace" state the ruling explicitly allows, and the one it forbids
    // (someone else's workspace) is the assertion above.
    const unscoped = access([{ accessDomain: 'venture-lab', role: 'venture-participant', allowedScopes: [] }]);
    expect(scopesGrantedIn(unscoped, 'venture-lab', false)).toEqual([]);
    expect(satisfiesWorkspaceScope(unscoped, 'venture-lab', HORIZEN, false)).toBe(false);
  });

  it('the tab names no partner, and opens on the clamped PUBLIC posture', async () => {
    // "Do not hardcode Horizen" — the qualifying workspace must fall out of the
    // caller's grants over the registry, never out of a conditional. A partner
    // name anywhere in this tab's config is that conditional in disguise.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const publicTab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === PUBLIC_TAB_ID)! as {
      label: string;
      metadata?: { description?: string };
      config: { props?: Record<string, unknown> };
    };
    expect(publicTab.label).toBe('Public Workspace');
    expect(publicTab.label).not.toMatch(/Partner|Horizen/i);
    expect(publicTab.metadata?.description ?? '').not.toMatch(/Horizen/i);
    expect(publicTab.config.props?.workspaceVisibility).toBe('public');
    expect(publicTab.config.props?.initialSurface).toBe('overview');
  });
});
