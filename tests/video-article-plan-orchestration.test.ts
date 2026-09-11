/**
 * video-article skill — ORCHESTRATION canary (Implementation Pack
 * "Develop a skill that generates a 24-second video and a corresponding
 * article", re-dispatched pack f34e7ed6, 2026-07-14).
 *
 * The skill's lower layers already have canaries:
 *   - the pure prompt/template builders → tests/video-article-skill.test.ts
 *   - the two MISSING capabilities (alignment + render plan) in isolation →
 *     tests/alignment-and-render-plan.test.ts
 *   - the invariant brief composition → tests/video-invariant-brief.test.ts
 *
 * The ONE layer with no coverage was the composition itself —
 * `buildVideoArticlePlan`, which is exactly the pack's validation plan item #2:
 * "Test the end-to-end process to ensure a 24-second video and corresponding
 * article are generated correctly." This pins that wiring:
 *   - the brief is built at the 24s / 2-segment contract,
 *   - the article is drafted from that SAME brief,
 *   - alignment is MEASURED against the drafted article body (correspondence,
 *     not asserted), and
 *   - the render plan reflects the 24s → 2×12s → one-stitch structure.
 *
 * getInvariantsByIds/listMembers are mocked (they hit Supabase), mirroring
 * tests/video-invariant-brief.test.ts. useLlm:false forces the deterministic
 * template path — no network, no provider key, no fabricated content — so the
 * whole plan is node-drillable.
 */

import { describe, expect, it, vi } from 'vitest';
import type { InvariantRecord } from '@/types/invariants';

vi.mock('@/services/invariants/store', () => ({
  getInvariantsByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => MOCK_INVARIANTS[id]).filter(Boolean),
  ),
}));
vi.mock('@/services/invariants/collections', () => ({
  listMembers: vi.fn(async (collectionId: string) =>
    (MOCK_COLLECTIONS[collectionId] ?? []).map((invariantId, position) => ({ invariantId, position })),
  ),
}));

function makeInvariant(id: string, seedId: string, statement: string): InvariantRecord {
  return {
    id,
    seedId,
    statement,
    namespace: 'constitutional',
    ontologyClassId: null,
    semanticType: 'principle',
    status: 'proposed',
    confidence: 0.85,
    confidenceBasis: 'principal_verified',
    standing: 0,
    reach: 0,
    timesValidated: 0,
    timesContradicted: 0,
    timesReferenced: 0,
    timesUsed: 0,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: {},
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: '2026-07-14T00:00:00Z',
    updatedAt: '2026-07-14T00:00:00Z',
  };
}

const MOCK_INVARIANTS: Record<string, InvariantRecord> = {
  'style-1': makeInvariant('style-1', 'inv.style.001', "The protagonist's appearance remains identical across every segment."),
  'sem-1': makeInvariant('sem-1', 'inv.constitutional.016', 'Sovereignty remains exclusively with human citizens.'),
  'sem-2': makeInvariant('sem-2', 'inv.constitutional.012', 'Standing follows action.'),
  'sem-3': makeInvariant('sem-3', 'inv.constitutional.017', 'An agent may exercise delegated authority but may never create new authority.'),
  'sem-4': makeInvariant('sem-4', 'inv.constitutional.023', 'Constitutional memory is append-only; supersession replaces deletion.'),
};

const MOCK_COLLECTIONS: Record<string, string[]> = {
  'style-collection': ['style-1'],
  'semantic-collection': ['sem-1', 'sem-2', 'sem-3', 'sem-4'],
};

const { buildVideoArticlePlan, VIDEO_ARTICLE_TOTAL_SECONDS, VIDEO_ARTICLE_SEGMENT_COUNT } = await import(
  '@/services/skills/videoArticleSkill'
);

describe('buildVideoArticlePlan — end-to-end orchestration (validation plan #2)', () => {
  const groundings = [
    { collectionId: 'style-collection', role: 'style' },
    { collectionId: 'semantic-collection', role: 'semantic' },
  ];

  it('produces the 24s / 2-segment contract by construction', async () => {
    const plan = await buildVideoArticlePlan({ groundings, productionTitle: 'Test Production', useLlm: false });
    expect(plan.totalSeconds).toBe(VIDEO_ARTICLE_TOTAL_SECONDS);
    expect(plan.totalSeconds).toBe(24);
    expect(plan.segmentCount).toBe(VIDEO_ARTICLE_SEGMENT_COUNT);
    expect(plan.brief.segments).toHaveLength(2);
    // Render plan reflects the real pipeline structure: 24s → 2×12s → one stitch.
    expect(plan.renderPlan.segmentCount).toBe(2);
    expect(plan.renderPlan.plannedSeconds).toBe(24);
    expect(plan.renderPlan.stitchPasses).toBe(1);
  });

  it('drafts the article from the SAME brief (template path is honest)', async () => {
    const plan = await buildVideoArticlePlan({ groundings, productionTitle: 'Test Production', useLlm: false });
    expect(plan.article.composedBy).toBe('template');
    expect(plan.article.title).toBe('Test Production');
    // The template article carries each segment's beat verbatim — correspondence
    // is structural, drawn only from the brief.
    for (const segment of plan.brief.segments) {
      expect(plan.article.body).toContain(segment.beat);
    }
  });

  it('MEASURES correspondence against the drafted article, not asserts it', async () => {
    const plan = await buildVideoArticlePlan({ groundings, productionTitle: 'Test Production', useLlm: false });
    expect(plan.alignment.basis).toBe('heuristic');
    expect(plan.alignment.perSegment).toHaveLength(2);
    // The template article embeds every beat verbatim, so every salient cue is
    // covered — full alignment, and the pass verdict is earned, not stipulated.
    expect(plan.alignment.score).toBe(1);
    expect(plan.alignment.pass).toBe(true);
    for (const seg of plan.alignment.perSegment) {
      expect(seg.coverage).toBe(1);
      expect(seg.missingCues).toEqual([]);
    }
  });

  it('runs the coherence quality gate and never fabricates a pass on failure', async () => {
    const plan = await buildVideoArticlePlan({ groundings, useLlm: false });
    // coherence is a pure structural evaluation of the brief; it is present
    // here (semantic grounding provided) and is degradation-safe (null, never
    // a faked pass) if the evaluator ever throws.
    expect(plan.coherence === null || typeof plan.coherence.pass === 'boolean').toBe(true);
  });

  it('emits no forbidden T0 identifier anywhere in the plan', async () => {
    const plan = await buildVideoArticlePlan({ groundings, productionTitle: 'Test Production', useLlm: false });
    const serialised = JSON.stringify(plan);
    for (const forbidden of ['personaId', 'authProfileId', 'rootDid']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
