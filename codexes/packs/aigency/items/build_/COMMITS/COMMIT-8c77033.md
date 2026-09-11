# Commit Brief: `8c77033` — add style + narrative invariant classes (CFS-011/012): brief generator, api, studio runner

| Field | Value |
|-------|-------|
| SHA | [`8c77033`](https://github.com/iQube-Protocol/AigentZBeta/commit/8c7703310e6e3cc0b999b82e8baf751c1fd1b109) |
| Author | Claude |
| Date | 2026-07-04T01:23:36Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add style + narrative invariant classes (CFS-011/012): brief generator, api, studio runner

Two new invariant classes, ratified together as a rendering architecture: KnowledgeQube -> Knowledge Invariants -> Narrative Invariants -> Style Invariants -> Rendering Model -> Video. The video model becomes a renderer; the storyteller is the KnowledgeQube, the director is Narrative Invariants, the cinematographer is Style Invariants.

CFS-011 Style Invariants ('style' namespace) -- Visual/Narrative(surface)/Semantic/Transition Identity; the coherence gate reuses the existing 'constrains' edge type (style invariant constrained by semantic invariant), no new edge taxonomy. 7 seed invariants (the default house style).

CFS-012 Narrative Invariants ('narrative' namespace) -- fixed structural beats (opening state -> inciting realization -> constitutional tension -> resolution -> constitutional transformation), decomposing 'continuity' into four distinct problems (character/narrative/semantic/stylistic). Key implementation distinction: narrative beats are SEQUENTIAL, never round-robin -- services/video/invariantVideoBrief.ts orders a narrative grounding by seed ordinal and maps segment i of N to beat floor(i*beatCount/N), always monotonic regardless of how segment/beat counts relate. 5 seed invariants (the canonical 5-beat arc).

services/video/invariantVideoBrief.ts composes: one continuity block from style groundings (identical every segment), sequential beats from narrative groundings, round-robin foregrounding from semantic groundings -- Anthropic-composed prose (reusing llmDraftHelper + GROUNDING_MANDATE, Law II) with an always-available deterministic template fallback. Generalized: role is a free label, not an enum (CFS-011 Sec5) -- accepts raw invariantIds, no pre-existing collection required.

POST /api/video/invariant-brief (spine-gated) + /admin/studio/invariant-video (InvariantVideoExperimentRunner) -- a self-contained Studio-adjacent page that mounts the real, fixed SkillVideoPlayer seeded with the generated segment_prompts, deliberately not wired into ComposerStudio.tsx's 9000-line manual-form state machine (scoped as a separate follow-up). 11 new canary tests (continuity isolation, round-robin distribution, narrative sequencing/monotonicity at 1:1/compression/stretch ratios, isolation from the semantic pool).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Two new invariant classes, ratified together as a rendering architecture: KnowledgeQube -> Knowledge Invariants -> Narrative Invariants -> Style Invariants -> Rendering Model -> Video. The video model becomes a renderer; the storyteller is the KnowledgeQube, the director is Narrative Invariants, the cinematographer is Style Invariants.

CFS-011 Style Invariants ('style' namespace) -- Visual/Narrative(surface)/Semantic/Transition Identity; the coherence gate reuses the existing 'constrains' edge type (style invariant constrained by semantic invariant), no new edge taxonomy. 7 seed invariants (the default house style).

CFS-012 Narrative Invariants ('narrative' namespace) -- fixed structural beats (opening state -> inciting realization -> constitutional tension -> resolution -> constitutional transformation), decomposing 'continuity' into four distinct problems (character/narrative/semantic/stylistic). Key implementation distinction: narrative beats are SEQUENTIAL, never round-robin -- services/video/invariantVideoBrief.ts orders a narrative grounding by seed ordinal and maps segment i of N to beat floor(i*beatCount/N), always monotonic regardless of how segment/beat counts relate. 5 seed invariants (the canonical 5-beat arc).

services/video/invariantVideoBrief.ts composes: one continuity block from style groundings (identical every segment), sequential beats from narrative groundings, round-robin foregrounding from semantic groundings -- Anthropic-composed prose (reusing llmDraftHelper + GROUNDING_MANDATE, Law II) with an always-available deterministic template fallback. Generalized: role is a free label, not an enum (CFS-011 Sec5) -- accepts raw invariantIds, no pre-existing collection required.

POST /api/video/invariant-brief (spine-gated) + /admin/studio/invariant-video (InvariantVideoExperimentRunner) -- a self-contained Studio-adjacent page that mounts the real, fixed SkillVideoPlayer seeded with the generated segment_prompts, deliberately not wired into ComposerStudio.tsx's 9000-line manual-form state machine (scoped as a separate follow-up). 11 new canary tests (continuity isolation, round-robin distribution, narrative sequencing/monotonicity at 1:1/compression/stretch ratios, isolation from the semantic pool).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/admin/studio/invariant-video/page.tsx` |
| Added | `app/api/video/invariant-brief/route.ts` |
| Added | `codexes/packs/agentiq/foundation/CFS-011_style-invariant-specification.md` |
| Added | `codexes/packs/agentiq/foundation/CFS-012_narrative-invariant-specification.md` |
| Modified | `codexes/packs/agentiq/foundation/experiments/exp-002-invariant-video/README.md` |
| Added | `components/composer/InvariantVideoExperimentRunner.tsx` |
| Added | `services/video/invariantVideoBrief.ts` |
| Added | `supabase/migrations/20260704000000_style_invariant_namespace.sql` |
| Added | `supabase/migrations/20260704010000_narrative_invariant_namespace.sql` |
| Modified | `tests/invariant-substrate.test.ts` |
| Added | `tests/video-invariant-brief.test.ts` |
| Modified | `types/invariants.ts` |

## Stats

 12 files changed, 1075 insertions(+), 6 deletions(-)
