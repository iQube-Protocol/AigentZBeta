/**
 * IRL OS — Experiment Membership & Artifact Workspace Restoration
 * (operator spec, 2026-09-02).
 *
 * Covers the P0 canonical resolver added to
 * services/passport/participationAccess.ts (canViewResearchWorkspace,
 * getParticipantResearchWorkspaceAccess), the projection route it powers
 * (GET /api/participation/my-experiments), and the containment properties
 * required by spec §13 ("reveals no private research by default, but never
 * hides research from a principal who possesses a valid entitlement").
 *
 * Mirrors tests/boundary-research-experiment-scoping.test.ts's mock-admin
 * and structural-source conventions (this repo has no
 * @testing-library/react; behaviour is proven from source + pure-function
 * assertions).
 */

import { describe, it, expect } from 'vitest';
import {
  canViewResearchWorkspace,
  getParticipantResearchWorkspaceAccess,
} from '@/services/passport/participationAccess';
import { listResearchWorkspaces } from '@/services/research/researchWorkspace';
import { readSource, stripComments } from './_lib/sourceAuthority';

function mockAdmin(rows: Array<{ role: string; allowed_experiments: string[] | null }>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getParticipantResearchWorkspaceAccess>[0];
}

// ─── canViewResearchWorkspace — the pure predicate ───────────────────────────

describe('canViewResearchWorkspace', () => {
  const privateWs = { id: 'ocsga-boundary-research', visibility: 'invited' };
  const publicWs = { id: 'some-public-ws', visibility: 'public' };
  const experimentWs = { id: 'autonomi-review-exp-p1', experimentId: 'EXP-P1', visibility: 'invited' };

  it('admin sees every workspace regardless of visibility or reach', () => {
    expect(canViewResearchWorkspace(privateWs, new Set(), true)).toBe('admin');
    expect(canViewResearchWorkspace(publicWs, new Set(), true)).toBe('admin');
  });

  it('a workspace declared visibility: "public" is visible with ZERO grant reach', () => {
    expect(canViewResearchWorkspace(publicWs, new Set(), false)).toBe('public');
  });

  it('a private/invited workspace is HIDDEN from a caller with no reach (default deny)', () => {
    expect(canViewResearchWorkspace(privateWs, new Set(), false)).toBeNull();
  });

  it('a private/invited workspace is visible once the caller\'s reach includes its own id (membership)', () => {
    expect(canViewResearchWorkspace(privateWs, new Set(['ocsga-boundary-research']), false)).toBe('membership');
  });

  it('an unrelated caller\'s reach (a DIFFERENT workspace id) still denies — no cross-workspace leak', () => {
    expect(canViewResearchWorkspace(privateWs, new Set(['some-other-workspace']), false)).toBeNull();
  });

  it('reach === "all" (unrestricted research-lab grant) grants membership to any private workspace', () => {
    expect(canViewResearchWorkspace(privateWs, 'all', false)).toBe('membership');
  });

  it('a workspace scoped by its own experimentId is reachable via a grant naming the raw experiment id', () => {
    expect(canViewResearchWorkspace(experimentWs, new Set(['EXP-P1']), false)).toBe('membership');
  });

  it('a workspace with an experimentId still denies a reach that names neither the workspace id nor the experiment id', () => {
    expect(canViewResearchWorkspace(experimentWs, new Set(['EXP-P2']), false)).toBeNull();
  });
});

// ─── getParticipantResearchWorkspaceAccess — the server projection ──────────

describe('getParticipantResearchWorkspaceAccess', () => {
  it('an anonymous caller (personaId: null) sees only workspaces declared visibility: "public" — none exist today, so the projection is empty', async () => {
    const admin = mockAdmin([]);
    const entries = await getParticipantResearchWorkspaceAccess(admin, null, false);
    const publicWorkspaces = listResearchWorkspaces().filter((w) => w.visibility === 'public');
    expect(entries.length).toBe(publicWorkspaces.length);
    for (const e of entries) expect(e.accessBasis).toBe('public');
  });

  it('an admin caller sees every registered research workspace', async () => {
    const admin = mockAdmin([]);
    const entries = await getParticipantResearchWorkspaceAccess(admin, 'persona-admin', true);
    expect(entries.length).toBe(listResearchWorkspaces().length);
    for (const e of entries) expect(e.accessBasis).toBe('admin');
  });

  it("a persona holding a research-lab grant scoped to OCSGA's workspace id sees ONLY that workspace (Ian's shape) — never EXP-P1/Validation", async () => {
    const admin = mockAdmin([
      { role: 'research-participant', allowed_experiments: ['ocsga-boundary-research'] },
    ]);
    const entries = await getParticipantResearchWorkspaceAccess(admin, 'persona-ian', false);
    const ids = entries.map((e) => e.workspaceId);
    expect(ids).toContain('ocsga-boundary-research');
    expect(ids).not.toContain('autonomi-review-exp-p1');
    expect(ids).not.toContain('irl-validation-programme-vp1');
  });

  it("a persona holding research-lab grants scoped to EXP-P1 and Validation sees BOTH (Austin's shape) — never OCSGA", async () => {
    const admin = mockAdmin([
      { role: 'reviewer', allowed_experiments: ['EXP-P1', 'irl-validation-programme-vp1'] },
    ]);
    const entries = await getParticipantResearchWorkspaceAccess(admin, 'persona-austin', false);
    const ids = entries.map((e) => e.workspaceId);
    expect(ids).toContain('autonomi-review-exp-p1');
    expect(ids).toContain('irl-validation-programme-vp1');
    expect(ids).not.toContain('ocsga-boundary-research');
  });

  it('revocation (an empty active-grant row set) removes every private workspace from the projection immediately', async () => {
    const admin = mockAdmin([]); // the "no active grants" shape a revoked persona resolves to
    const entries = await getParticipantResearchWorkspaceAccess(admin, 'persona-revoked', false);
    const ids = entries.map((e) => e.workspaceId);
    expect(ids).not.toContain('ocsga-boundary-research');
    expect(ids).not.toContain('autonomi-review-exp-p1');
  });
});

// ─── Structural — reuse, not a parallel authorization system ────────────────

describe('the resolver composes existing authority, never a parallel one', () => {
  it('getParticipantResearchWorkspaceAccess is implemented in terms of getBoundaryResearchReadableExperiments — no independent access_grants query', () => {
    const src = stripComments(readSource('services/passport/participationAccess.ts'));
    const fnAt = src.indexOf('export async function getParticipantResearchWorkspaceAccess(');
    expect(fnAt).toBeGreaterThan(-1);
    const fnBody = src.slice(fnAt, src.indexOf('\nexport ', fnAt + 1));
    expect(fnBody).toContain('getBoundaryResearchReadableExperiments(admin, personaId)');
    expect(fnBody).not.toContain(".from('access_grants')");
  });

  it('the projection route composes the resolver, never a second, hand-rolled visibility check', () => {
    const src = stripComments(readSource('app/api/participation/my-experiments/route.ts'));
    expect(src).toContain('getParticipantResearchWorkspaceAccess');
    expect(src).not.toContain(".from('access_grants')");
    // Never derives identity from the client — spine-only.
    expect(src).not.toContain('searchParams');
    expect(src).toContain('getActivePersona(req)');
  });

  it('PartnerProgrammesTab honours a workspace\'s researchVisibility === "public" independently of the caller\'s grant scope', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toContain('w.researchVisibility === "public"');
  });
});
