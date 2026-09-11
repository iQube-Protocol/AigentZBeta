/**
 * Experiments tab / left rail parity invariant (2026-09-08, second
 * navigation-model pass — operator instruction: "If an experiment is visible
 * in the left rail, it must also appear in the Experiments tab, and both
 * must resolve to the same selected-workspace state. Conversely, if the
 * principal cannot dereference the workspace, neither surface may advertise
 * it. Test admin, Austin-equivalent EXP-P1 reviewer, Ian-equivalent OCSGA
 * participant, wrong-scope, revoked and anonymous.")
 *
 * The client-side half of this invariant is a STRUCTURAL fact, not a
 * behavioural one worth re-deriving: `PartnerProgrammesTab.tsx` computes ONE
 * `workspaces` array (the entitlement-derived list) and both the left rail
 * (`ResearchProgrammeNav`) and the `experiments` surface render THAT SAME
 * array — there is no second, independently-fetched or independently-filtered
 * list for either surface to drift against. This file proves that by source,
 * matching this repo's existing source-authority convention (no
 * @testing-library/react here — see tests/_lib/sourceAuthority.ts's own
 * header and tests/research-workspace-spec.test.ts for the established
 * pattern).
 *
 * The admin / Austin-equivalent EXP-P1 reviewer / Ian-equivalent OCSGA
 * participant / wrong-scope / revoked / anonymous cases are the SERVER-side
 * half of the same invariant — already exercised end-to-end against the real
 * registry and a realistic Supabase mock in:
 *   - tests/irl-experiment-membership-workspace.test.ts
 *     (`getParticipantResearchWorkspaceAccess` itself — the left rail's own
 *     data source, and this route's primary gate)
 *   - tests/selected-workspace-state-2026-09-08.test.ts
 *     (`GET /api/participation/workspace-state` — admin, scoped reviewer,
 *     wrong-scope 403, no-active-grant 403 (models revoked/expired),
 *     anonymous 401, OCSGA-with-no-experimentId, cross-workspace exchange
 *     non-leak)
 * This file does not re-implement those — re-deriving the same assertion
 * with a second mock would be the tautology CLAUDE.md warns against. It
 * proves the ONE missing link: that the client wires BOTH surfaces to that
 * SAME resolved list, and that the server resolver backing the Experiments
 * tab's fetch (`resolveSelectedWorkspaceState`) gates through the identical
 * function the left rail's own projection uses — never a parallel one.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const TAB_SRC = () => stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
const RESOLVER_SRC = () => stripComments(readSource('services/research/selectedWorkspaceState.ts'));

describe('Experiments tab / left rail parity — client wiring', () => {
  it('there is exactly ONE `workspaces` derivation (useMemo) in the tab — never a second list for either surface', () => {
    const src = TAB_SRC();
    const memoDeclarations = [...src.matchAll(/const workspaces = useMemo\(/g)];
    expect(memoDeclarations.length, 'a second `workspaces` derivation would let the two surfaces drift').toBe(1);
  });

  it('the left rail (`ResearchProgrammeNav`) is passed the SAME `workspaces` identifier the Experiments surface reads', () => {
    const src = TAB_SRC();
    expect(src).toMatch(/<ResearchProgrammeNav workspaces=\{workspaces\} activeId=\{ws\.id\} onSelect=\{setActiveId\}/);
    // The Experiments surface block iterates the identical `workspaces`
    // array via RESEARCH_NAV_SECTIONS.map(... workspaces.filter(...)) —
    // never a differently-named or independently-fetched list.
    const experimentsBlock = src.slice(
      src.indexOf('surface === "experiments" && kind === "research"'),
      src.indexOf('{/* ── Collaborate'),
    );
    expect(experimentsBlock.length, 'the experiments surface block did not parse').toBeGreaterThan(0);
    expect(experimentsBlock).toMatch(/workspaces\.length === 0/);
    expect(experimentsBlock).toMatch(/const items = workspaces\.filter\(\(w\) => w\.navSection === section\.id\)/);
  });

  it('selecting a row in the Experiments surface calls the SAME setActiveId the left rail uses — one shared selection state, not two', () => {
    const src = TAB_SRC();
    const experimentsBlock = src.slice(
      src.indexOf('surface === "experiments" && kind === "research"'),
      src.indexOf('{/* ── Collaborate'),
    );
    expect(experimentsBlock).toMatch(/onClick=\{\(\) => setActiveId\(item\.id\)\}/);
  });

  it("the 'experiments' view carries no role exclusion — every role the left rail admits, the Experiments tab admits too", () => {
    const src = stripComments(readSource('services/research/researchWorkspaceViews.ts'));
    const at = src.indexOf("id: 'experiments'");
    expect(at, "the 'experiments' view registry entry did not parse").toBeGreaterThan(-1);
    const entry = src.slice(at, src.indexOf('},', at));
    expect(entry).toMatch(/roles: allRolesExcept\(\)/);
  });
});

describe('Experiments tab / left rail parity — server wiring shares ONE access gate', () => {
  it('resolveSelectedWorkspaceState (the Experiments/Overview/Pipeline fetch) gates through getParticipantResearchWorkspaceAccess — the SAME function the left rail\'s own projection (GET /api/participation/my-experiments) uses', () => {
    const resolverSrc = RESOLVER_SRC();
    expect(resolverSrc).toContain('getParticipantResearchWorkspaceAccess(admin, persona.personaId, false)');
    // Never a parallel, hand-rolled access_grants query for this gate.
    expect(resolverSrc).not.toContain(".from('access_grants')");

    const myExperimentsSrc = stripComments(readSource('app/api/participation/my-experiments/route.ts'));
    expect(myExperimentsSrc).toContain('getParticipantResearchWorkspaceAccess');
  });

  it('a caller who cannot dereference the workspace is denied BEFORE any experiment-bound state is resolved (fail-closed, primary gate first)', () => {
    // Raw source (not comment-stripped) — these markers are the comments
    // themselves, the anchor this canary needs to order against the code.
    const resolverSrc = readSource('services/research/selectedWorkspaceState.ts');
    const gateAt = resolverSrc.indexOf('PRIMARY GATE');
    const experimentBoundAt = resolverSrc.indexOf('EXPERIMENT-BOUND state');
    expect(gateAt).toBeGreaterThan(-1);
    expect(experimentBoundAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(experimentBoundAt);
    // And the gate actually returns before proceeding — 'denied' return sits
    // textually before the experiment-bound block starts.
    const deniedReturnAt = resolverSrc.indexOf("reason: 'denied'");
    expect(deniedReturnAt).toBeGreaterThan(gateAt);
    expect(deniedReturnAt).toBeLessThan(experimentBoundAt);
  });

  it('the resolver and its experiment-lifecycle derivation contain NO hardcoded experiment or workspace id — generalized, not two special cases for Austin/EXP-P1 and Ian/OCSGA', () => {
    // The ONE legitimate exception: READINESS_AVAILABLE_EXPERIMENTS is a
    // named, documented allowlist of "which experiments have a Crystal
    // readiness dashboard concept AT ALL" (mirrors the identical, already-
    // justified allowlist in app/api/participation/workspace-capabilities/
    // route.ts) — a fact about what the platform has built, not a hardcoded
    // branch that treats EXP-P1/OCSGA specially in the RESOLUTION logic
    // itself. Every other hardcoded id would be that special-casing.
    const forbidden = ["'ocsga-boundary-research'", '"ocsga-boundary-research"', "'autonomi-review-exp-p1'"];
    for (const file of [
      'services/research/selectedWorkspaceState.ts',
      'services/research/experimentLifecycleState.ts',
      'app/api/participation/workspace-state/route.ts',
    ]) {
      const src = stripComments(readSource(file));
      for (const literal of forbidden) {
        expect(src, `${file} contains the hardcoded literal ${literal}`).not.toContain(literal);
      }
      // EXP-P1/P2/P3 may appear ONLY inside the named readiness allowlist —
      // never in a resolution-logic branch elsewhere in the file.
      const expMatches = [...src.matchAll(/'EXP-P[123]'/g)];
      if (expMatches.length > 0) {
        expect(src, `${file} references an EXP-Pn literal outside READINESS_AVAILABLE_EXPERIMENTS`).toContain(
          'READINESS_AVAILABLE_EXPERIMENTS',
        );
        const allowlistLine = src.split('\n').find((l) => l.includes('READINESS_AVAILABLE_EXPERIMENTS = new Set'));
        expect(allowlistLine, `${file}'s allowlist declaration did not parse`).toBeTruthy();
        for (const m of expMatches) {
          expect(allowlistLine, `an EXP-Pn literal in ${file} sits outside the named allowlist`).toContain(m[0]);
        }
      }
    }
  });
});
