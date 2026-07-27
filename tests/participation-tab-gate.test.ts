/**
 * Participation tab gate canaries — the Tier 0 / Tier 2 split (Horizen Phase 3,
 * audit §B.3; operator ruling "Partner gate = split agreed", 2026-07-27).
 *
 * WHAT THIS PROTECTS. The split replaced `adminOnly` on four Partner views with
 * a membership gate so partner operators stop needing platform admin — the hard
 * blocker the base audit recorded. That is a deliberate, operator-ratified
 * change to an access gate, which makes it exactly the kind of change CLAUDE.md
 * demands be enforced rather than trusted:
 *
 *  1. THE GATE NEVER WIDENS. A tab carrying both `adminOnly` and
 *     `participationDomain` stays admin-only. Adding a domain to an existing
 *     tab can never open it by accident.
 *  2. IT FAILS CLOSED. Before grants resolve, a participation-gated tab is
 *     hidden. "Not answered yet" must not be readable as "yes".
 *  3. ONE IMPLEMENTATION. Every filter calls
 *     services/passport/participationTabGate.ts. A hand-rolled
 *     `tab.participationDomain` comparison in a filter is the defect
 *     (inv.engineering.036 / .037) — it is how a gate silently diverges.
 *  4. THE SERVER STILL DECIDES. The tab gate governs RENDERING; the route
 *     governs PERMISSION, resolves membership through the spine, and returns
 *     Tier 0 content to admins only.
 *  5. THE DECLARED SPLIT IS THE RATIFIED ONE, and every declared domain is a
 *     real member of ACCESS_DOMAINS.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  satisfiesParticipationGate,
  tabPassesAccessGates,
  EMPTY_PARTICIPATION_ACCESS,
} from '../services/passport/participationTabGate';
import { ACCESS_DOMAINS, DOMAIN_ROLES } from '../services/passport/participationAccess';

const GATE_PATH = 'services/passport/participationTabGate.ts';
const ROUTE_PATH = 'app/api/venture/workspace/[workspaceId]/route.ts';

const loaded = (...grants: Array<[string, string]>) => ({
  loaded: true,
  grants: grants.map(([accessDomain, role]) => ({ accessDomain, role })),
});

describe('the gate is a gate', () => {
  it('never widens adminOnly', () => {
    const tab = { adminOnly: true, participationDomain: 'venture-lab' };
    // A member who is not an admin must still be refused.
    expect(tabPassesAccessGates(tab, loaded(['venture-lab', 'observer']), false)).toBe(false);
    expect(tabPassesAccessGates(tab, loaded(['venture-lab', 'observer']), true)).toBe(true);
  });

  it('fails closed before grants resolve', () => {
    const tab = { participationDomain: 'venture-lab' };
    expect(satisfiesParticipationGate(tab, EMPTY_PARTICIPATION_ACCESS, false)).toBe(false);
    // …and answers honestly once they have.
    expect(satisfiesParticipationGate(tab, { loaded: true, grants: [] }, false)).toBe(false);
    expect(satisfiesParticipationGate(tab, loaded(['venture-lab', 'observer']), false)).toBe(true);
  });

  it('is inert on tabs that declare no domain', () => {
    expect(satisfiesParticipationGate({}, EMPTY_PARTICIPATION_ACCESS, false)).toBe(true);
    expect(tabPassesAccessGates({}, EMPTY_PARTICIPATION_ACCESS, false)).toBe(true);
  });

  it('scopes to the named domain and narrows by role when asked', () => {
    const tab = { participationDomain: 'venture-lab' };
    // A grant in a DIFFERENT domain must not open a venture-lab tab.
    expect(satisfiesParticipationGate(tab, loaded(['research-lab', 'observer']), false)).toBe(false);

    const stewardOnly = { participationDomain: 'venture-lab', participationRoles: ['workspace-steward'] };
    expect(satisfiesParticipationGate(stewardOnly, loaded(['venture-lab', 'observer']), false)).toBe(false);
    expect(satisfiesParticipationGate(stewardOnly, loaded(['venture-lab', 'workspace-steward']), false)).toBe(true);
    // An empty role list means "any role", not "no role".
    expect(
      satisfiesParticipationGate(
        { participationDomain: 'venture-lab', participationRoles: [] },
        loaded(['venture-lab', 'observer']),
        false,
      ),
    ).toBe(true);
  });

  it('lets an admin see the workspace they administer', () => {
    expect(satisfiesParticipationGate({ participationDomain: 'venture-lab' }, EMPTY_PARTICIPATION_ACCESS, true)).toBe(true);
  });
});

describe('one implementation, no parallel predicates', () => {
  const SKIP = new Set(['node_modules', '.next', '.git', 'worktrees']);

  function walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue;
      const full = join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(full, out);
      else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
    }
    return out;
  }

  it('every module that reads participationDomain goes through the gate', () => {
    // The gate module itself, the type declaration and config DATA are allowed
    // to name the field; everything else must import the predicate rather than
    // compare the field itself.
    const allowed = new Set(['types/codex.ts', 'data/codex-configs.ts', GATE_PATH]);
    const offenders: string[] = [];

    for (const root of ['app', 'components', 'services', 'types', 'data']) {
      for (const file of walk(root)) {
        const rel = file.replace(/\\/g, '/');
        if (allowed.has(rel)) continue;
        const src = stripComments(readFileSync(file, 'utf-8'));
        if (!src.includes('participationDomain')) continue;
        // Reading the field is only legitimate via the gate's own functions.
        const usesGate = /participationTabGate|satisfiesParticipationGate|tabPassesAccessGates/.test(src);
        // A direct comparison against the field is the parallel predicate.
        const comparesDirectly = /participationDomain\s*===|===\s*[a-zA-Z.]*\.participationDomain/.test(src);
        if (!usesGate || comparesDirectly) {
          offenders.push(`${rel}: reads participationDomain without the canonical gate`);
        }
      }
    }

    expect(offenders, `parallel gate implementations:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the tab filters actually call it', () => {
    const panel = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    const hook = stripComments(readSource('app/hooks/useCodexConfig.ts'));
    expect(panel, 'CodexPanelDynamic does not apply the gate').toMatch(/tabPassesAccessGates\(/);
    expect(hook, 'getEnabledTabs does not apply the gate').toMatch(/satisfiesParticipationGate\(/);
    // MS-9: a group whose tabs are all gated away must not render an inert chip.
    expect(panel).toMatch(/enabledTabs\.some\(t => t\.group === g\.id\)/);
  });
});

describe('the server keeps the real boundary', () => {
  it('the workspace route resolves through the spine and gates Tier 0 on admin', () => {
    const src = stripComments(readSource(ROUTE_PATH));
    expect(src).toMatch(/getActivePersona\(req\)/);
    // Membership resolved from the SAME resolver the client gate reads, so the
    // two can never disagree about who is a member.
    expect(src).toMatch(/resolveParticipationSelfView/);
    expect(src).toMatch(/status: 403/);
    // Tier 0 is conditional on admin, not on membership.
    expect(src).toMatch(/tier0: isAdmin/);
  });

  it('the route never serialises a persona identifier', () => {
    const src = stripComments(readSource(ROUTE_PATH));
    // personaId may be READ (to project the caller's own actions) but must not
    // be echoed into the response body.
    expect(/personaId:\s*persona\.personaId/.test(src.split('return NextResponse.json')[1] ?? '')).toBe(false);
    expect(src).not.toMatch(/holderRef.*personaId/);
  });
});

describe('the declared split is the ratified one', () => {
  it('every participationDomain in the codex config is a real access domain', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const gated = VENTURE_LAB_CODEX.tabs.filter(
      (t: { participationDomain?: string }) => Boolean(t.participationDomain),
    );
    expect(gated.length, 'no tab uses the Tier 2 gate — the split did not land').toBeGreaterThan(0);
    for (const tab of gated) {
      expect(ACCESS_DOMAINS, `${tab.id} names a domain that does not exist`).toContain(
        tab.participationDomain,
      );
      for (const role of tab.participationRoles ?? []) {
        expect(
          DOMAIN_ROLES[tab.participationDomain as (typeof ACCESS_DOMAINS)[number]],
          `${tab.id} names role "${role}" the domain does not have`,
        ).toContain(role);
      }
    }
  });

  it('Tier 0 partner material stays admin-only', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    for (const id of ['partner-communicate', 'partner-administration']) {
      const tab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === id);
      expect(tab, `${id} is missing`).toBeTruthy();
      expect(tab!.adminOnly, `${id} left Tier 0 without the split being ratified`).toBe(true);
      expect(tab!.participationDomain, `${id} is Tier 0 but carries a membership gate`).toBeUndefined();
    }
  });
});
