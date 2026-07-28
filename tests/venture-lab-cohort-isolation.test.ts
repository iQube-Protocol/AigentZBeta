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
