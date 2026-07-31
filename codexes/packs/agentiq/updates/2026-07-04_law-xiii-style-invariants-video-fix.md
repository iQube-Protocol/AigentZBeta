# Law XIII (Individualization) + CFS-011/012 (Style + Narrative Invariants) + Video Pipeline Fix

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Builds on:** Phases 1–3 + Law XII (2026-07-03).

## 1. The video bug — investigated and fixed

**Report:** "the new video skill for combining videos... they actually share 1 url."

**Root cause, found by reading `SkillVideoPlayer.invokeMultiSegment`:** every segment of a multi-clip video (`duration > 12`) submitted an **identical** request body to `/api/skills/invoke` — same `prompt`, same `duration`, same everything, N times in parallel. There was no mechanism for per-segment prompts at all. A "24s video" was therefore mechanically the same 12s clip generated twice — the manual EXP-002 briefs (hand-written continuity blocks + distinct per-segment prose) existed specifically to route around this gap by hand.

A second, compounding limit: `MAX_SEGMENTS = 2` (24s ceiling) and `/api/skills/video/stitch` accepts only 2–3 clips per call — so a 48s/4-segment request would have failed the stitch call outright even if attempted.

**Fix — `components/composer/SkillVideoPlayer.tsx`:**
- New `segment_prompts?: string[]` prop — each segment submits its own prompt when provided (falls back to repeating `prompt`, so existing callers are unaffected).
- `MAX_SEGMENTS` raised 2 → 4 (48s ceiling).
- New `stitchHierarchical()` — a generic reducer that chunks by the stitch route's 3-clip cap and stitches recursively (order-preserving) so any segment count works, not just 4.
- Threaded through `components/composer/ExperienceLiquidRenderer.tsx` (`packet.skill.segment_prompts`) and the Studio duration field (`services/composer/composerStore.ts`, new "48 seconds (4 clips, stitched)" option).

## 2. Law XIII — Individualization (CFS-009 amendment)

The constitutional gap the video work exposed a real name for: Standing must attach to *someone*, but "someone" doesn't require "someone named." Ratified as Law XIII with three corollaries:

- **The Constitutional Subject Model**: Personhood → Individualization (the constitutional subject) → branches to Standing (capability) and Identity (recognizability → Reputation).
- **Corollary I**: individualization is defined by **continuity, not disclosure** — persistence across time/interaction is what lets validated action accumulate into Standing, independent of identifiability. *(Per your clarification: continuity is precisely what enables Standing to accrue without identifiability.)*
- **Corollary II**: identity is a branch of individualization, not its gate — inverts the current internet's identity-first model.
- **Corollary III**: the constitutional target is a **ZK continuity layer** under which even the server cannot re-identify the subject, while the same subject remains verifiably continuous. *(Per your further correction: this isn't just about the network/chain layer — even server-side re-identification must be prevented.)* The current T0 tier (`creator_persona_id`, server-internal) is named explicitly as the present engineering approximation, not the constitutional ceiling.

No schema change — this is a documentary/constitutional clarification of what the T0 tier already represents, pending the not-yet-built ZK layer. Seeded as `inv.constitutional.063–067`.

## 3. CFS-011 — Style Invariant Specification v1 (new invariant class)

A fourth invariant class alongside Knowledge (constitutional), Reasoning, and Experience: **Style Invariants**, preserving visual/narrative continuity rather than semantic meaning. Same primitive, new `style` namespace (migration `20260704000000_style_invariant_namespace.sql`, additive CHECK widening — the `epistemic` precedent).

- Four sub-domains: Visual Identity, Narrative Identity, **Semantic Identity** (the seam back to constitutional invariants — reuses the existing `constrains` edge type, no new edge taxonomy needed), Transition Identity.
- Seven canonical style invariants seeded (`inv.style.001–007`) — a ready-made "house style" collection.
- **Generalized per your request** ("stubbed to also be able to use other invariants"): the brief generator's `GroundingRef` takes a free-text `role`, not a hardcoded enum — any invariant class composes into a brief without a new code path.

## 3a. CFS-012 — Narrative Invariant Specification v1 (a fifth invariant class)

Mid-session refinement: narrative structure is its own class, distinct from Style. Four continuity problems, decomposed: **Character** (Style §3.1) · **Narrative** (this spec — the fixed shape of the arc) · **Semantic** (Knowledge invariants — what's asserted) · **Stylistic** (Style §3.4 — cinematography). The full rendering pipeline: `KnowledgeQube → Knowledge Invariants → Narrative Invariants → Style Invariants → Rendering Model → Video`. The video model becomes a renderer; the storyteller is the KnowledgeQube, the director is the Narrative Invariants, the cinematographer is the Style Invariants.

- New `narrative` namespace (migration `20260704010000_narrative_invariant_namespace.sql`).
- Seed: the canonical 5-beat arc (`inv.narrative.001–005`): opening state → inciting realization → constitutional tension → resolution → constitutional transformation. Beats remain fixed; prose, visuals, and camera vary freely beneath them.
- **The key implementation distinction**: narrative beats are **sequential**, never round-robin. `services/video/invariantVideoBrief.ts` orders a narrative grounding by seed ordinal and maps segment *i* of *N* to beat `floor(i × beatCount / N)` — proportional compression/stretching that is always monotonic (never reorders the arc), whether 5 beats map onto 4, 5, or 8 segments. 5 new canary tests pin this (1:1 mapping, 5-onto-4 compression, 5-onto-8 stretch, isolation from the semantic round-robin pool, absence when ungrounded).
- CFS-011 §3.2 amended with a cross-reference: it retains surface continuity (same world/motif/symbol); the shape of the arc moved to CFS-012.
- Runner UI (`InvariantVideoExperimentRunner.tsx`) gained a third, optional picker: Narrative Invariant Collection, alongside Style and Semantic.

## 4. The invariant-grounded video brief generator

`services/video/invariantVideoBrief.ts` + `POST /api/video/invariant-brief`:
- Composes ONE continuity block from `style`-role groundings (shared across every segment).
- Distributes semantic-role invariants round-robin across N segments (each foregrounds a distinct cluster; the others become an explicit "do not contradict" guardrail).
- Per-segment prompt composition: Anthropic-first (reusing the existing `llmDraftHelper`/`GROUNDING_MANDATE` pattern — Law II, no new LLM-calling convention invented) with an **always-available deterministic template fallback** (`useLlm: false` forces it; also the fallback on any LLM failure) — the function never throws for lack of an API key.
- Accepts a pre-existing `collectionId` or raw `invariantIds[]` directly — no collection has to exist first.

## 5. Studio-adjacent experiment runner

`/admin/studio/invariant-video` (`components/composer/InvariantVideoExperimentRunner.tsx`) — a self-contained page: pick style + semantic collections, segment count, generate the brief, review each segment's beat/prompt, then the page mounts the **real, fixed** `SkillVideoPlayer` pre-seeded with `segment_prompts` so its own Generate button runs the live pipeline.

**Scope note, stated plainly:** this is deliberately NOT wired into `ComposerStudio.tsx`'s manual-form state machine (~9,000 lines, deeply interdependent). That deeper integration — an invariant picker inside the main composer's video-prompt block — is a larger, separately reviewable change. This runner exercises the actual fix end-to-end today without touching that file.

## Tests

41 passing total (19 substrate + 11 pipeline + 11 video-brief: 6 style/semantic canaries + 5 narrative-sequencing canaries). The `INVARIANT_NAMESPACES` canary updated twice in-session (5→6→7, `style` then `narrative`).

**Caveat, stated as in prior sessions:** the video-player fix (client-side, browser + provider APIs) is parse-verified and logic-traced but not exercised against a live generation call from this sandbox (no network). The Supabase-backed brief generator paths are unit-tested with mocked stores; live verification is the operator's first real run at `/admin/studio/invariant-video`.

## Operator actions

1. Apply, in order: `supabase/migrations/20260704000000_style_invariant_namespace.sql`, then `supabase/migrations/20260704010000_narrative_invariant_namespace.sql`.
2. Re-run the seed to plant Law XIII (63–67), Style (001–007), and Narrative (001–005) invariants: `git pull && node scripts/ingest-canonical-invariants.mjs`.
3. Create two reusable collections via `POST /api/invariants/collections`: a `style` collection from the 7 seeded style invariants, and a `narrative` collection from the 5 seeded narrative invariants (the "house style" and "canonical arc" the runner page expects to pick from).
4. Visit `/admin/studio/invariant-video`, pick both collections + a semantic collection (e.g. EXP-001's 18), generate a brief, and run the real coherence test.
