/**
 * OCSGA experiment visibility scoping + Boundary Research destination
 * (items 6 and 7, semantic repair 2026-08-25).
 *
 * Item 6: OCSGA reuses the existing access_grants.allowed_experiments
 * mechanism through a generic resolver shared with the reviewer path —
 * never a second, hand-rolled OCSGA experiment list.
 *
 * Item 7: research-active no longer defaults to the generic platform-wide
 * IRL Welcome + Dashboard — it presents the active persona's own assigned
 * experiment workspace(s), reusing PartnerProgrammesTab's lockedWorkspaceId
 * pattern exactly as the Validation Programme's "Experiment Progress" stage
 * does.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getReadableExperimentsForRoles,
  getReviewReadableExperiments,
  getBoundaryResearchReadableExperiments,
  REVIEW_VIEW_READABLE_ROLES,
} from '@/services/passport/participationAccess';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
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
  } as unknown as Parameters<typeof getReadableExperimentsForRoles>[0];
}

describe('getReviewReadableExperiments and getBoundaryResearchReadableExperiments share ONE resolver', () => {
  it('both are implemented in terms of getReadableExperimentsForRoles — no independent query', () => {
    const src = stripComments(readSource('services/passport/participationAccess.ts'));
    const reviewFnAt = src.indexOf('export async function getReviewReadableExperiments(');
    const reviewFnBody = src.slice(reviewFnAt, src.indexOf('\n}', reviewFnAt));
    expect(reviewFnBody).toContain('getReadableExperimentsForRoles(admin, personaId,');
    expect(reviewFnBody).not.toContain(".from('access_grants')");

    const ocsgaFnAt = src.indexOf('export async function getBoundaryResearchReadableExperiments(');
    const ocsgaFnBody = src.slice(ocsgaFnAt, src.indexOf('\n}', ocsgaFnAt));
    expect(ocsgaFnBody).toContain('getReadableExperimentsForRoles(admin, personaId,');
    expect(ocsgaFnBody).not.toContain(".from('access_grants')");
  });

  it('getReviewReadableExperiments still filters to review-readable roles', async () => {
    const admin = mockAdmin([
      { role: 'research-participant', allowed_experiments: ['EXP-P1'] },
      { role: 'reviewer', allowed_experiments: ['EXP-P2'] },
    ]);
    const result = await getReviewReadableExperiments(admin, 'persona-1');
    expect(result).toEqual(new Set(['EXP-P2']));
  });

  it('getBoundaryResearchReadableExperiments is role-agnostic — a non-reviewer participant role still counts', async () => {
    const admin = mockAdmin([{ role: 'research-participant', allowed_experiments: ['EXP-P1'] }]);
    expect(REVIEW_VIEW_READABLE_ROLES).not.toContain('research-participant');
    const result = await getBoundaryResearchReadableExperiments(admin, 'persona-1');
    expect(result).toEqual(new Set(['EXP-P1']));
  });

  it('an unrestricted grant resolves to "all" for both resolvers', async () => {
    const reviewAdmin = mockAdmin([{ role: 'reviewer', allowed_experiments: null }]);
    expect(await getReviewReadableExperiments(reviewAdmin, 'p')).toBe('all');
    const ocsgaAdmin = mockAdmin([{ role: 'research-participant', allowed_experiments: [] }]);
    expect(await getBoundaryResearchReadableExperiments(ocsgaAdmin, 'p')).toBe('all');
  });

  it('no grant at all resolves to an empty set — never "all" by default', async () => {
    const admin = mockAdmin([]);
    expect(await getBoundaryResearchReadableExperiments(admin, 'p')).toEqual(new Set());
  });
});

describe('no OCSGA-specific experiment API does client-side hide-after-fetch', () => {
  it('BoundaryResearchProgressPanel scopes via the SAME server-resolved participation-access read PartnerProgrammesTab uses — never a raw unscoped experiment fetch', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('useParticipationAccess(personaId)');
    expect(src).toContain('scopesGrantedIn(access, RESEARCH_ACCESS_DOMAIN');
    // Never fetches an unscoped experiment list directly.
    expect(src).not.toMatch(/fetch\(['"`]\/api\/(research\/)?experiments/);
  });

  it('treats "not loaded yet" as distinct from "confirmed zero" (MS-11)', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('if (!access.loaded)');
  });
});

describe('research-active reuses PartnerProgrammesTab — never a forked Boundary Research engine', () => {
  it('the registry surface mounts BoundaryResearchProgressPanel as a component, not a new embed', () => {
    const descriptor = JOURNEY_SURFACES['boundary-research-progress'];
    expect(descriptor.kind).toBe('component');
    if (descriptor.kind !== 'component') throw new Error('unreachable');
    expect(descriptor.component).toBe('BoundaryResearchProgressPanel');
  });

  it('the research-active stage references the new surface, not the retired generic embeds', () => {
    const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === 'research-active')!;
    const refs = stage.surfaces.map((s) => s.ref);
    expect(refs).toContain('boundary-research-progress');
    expect(refs).not.toContain('boundary-research-entry-panel');
    expect(refs).not.toContain('participant-dashboard');
  });

  it('the retired registry entries no longer exist — no dangling dual implementation', () => {
    expect(JOURNEY_SURFACES['boundary-research-entry-panel']).toBeUndefined();
    expect(JOURNEY_SURFACES['participant-dashboard']).toBeUndefined();
  });

  it('composes the SAME PartnerProgrammesTab component the Validation Programme uses (Pipeline + Evidence)', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain("import { PartnerProgrammesTab } from '@/app/triad/components/codex/tabs/PartnerProgrammesTab';");
    expect((src.match(/<PartnerProgrammesTab/g) ?? []).length).toBe(2);
    expect(src).toContain('initialSurface="pipeline"');
    expect(src).toContain('initialSurface="evidence"');
    expect(src).toMatch(/workspaceDomain="research"/);
  });

  it('never invents a new workspace id — lockedWorkspaceId always comes from listResearchWorkspaces()', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('listResearchWorkspaces()');
    expect(src).not.toMatch(/lockedWorkspaceId=\{['"`]/); // never a hardcoded literal id
  });

  it('keeps "Explore IRL OS" as the explicit route into the larger body of work', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('Explore IRL OS');
    expect(src).toContain("buildCodexUrl('irl-cartridge', { tab: 'irl-welcome'");
  });

  it('renders a designed empty state for zero assigned experiments, never a silent fallback', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('No experiment is assigned yet');
  });

  it('renders a persona-scoped selector for several assigned experiments', () => {
    const src = stripComments(readSource('components/journey/BoundaryResearchProgressPanel.tsx'));
    expect(src).toContain('Which experiment?');
  });
});
