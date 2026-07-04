# EXP-002 — Invariant-Carried Video

**Chrysalis Foundation · Experiment 002 · Status: briefs authored; generator + runner shipped 2026-07-04; production pending**
Companion to EXP-001 (same KnowledgeQube 001 collection — the video artifacts of the Living KnowledgeQube).

## Update 2026-07-04 — the bug this experiment surfaced, and the fix

Reviewing this experiment against the deployed skill surfaced a real defect: `SkillVideoPlayer.invokeMultiSegment` had **no per-segment prompt mechanism** — every segment of a multi-clip video submitted an identical request body (same prompt, duration, style), so a "24s video" was mechanically the same 12s clip generated twice. That is why the manual briefs below exist as hand-authored prose in the first place.

Fixed in `components/composer/SkillVideoPlayer.tsx`: a new `segment_prompts?: string[]` prop carries a distinct prompt per segment, `MAX_SEGMENTS` raised 2→4 (48s), and stitching is now hierarchical (2–3 clips per pass, any depth) so 4-segment productions work within the stitch route's per-pass cap.

This also promoted "continuity block + per-segment prompt" into a first-class, code-generated primitive: **CFS-011 Style Invariants** (`../CFS-011_style-invariant-specification.md`) — the continuity block is now composed from a `style`-namespace invariant collection, not hand-written per experiment. See `services/video/invariantVideoBrief.ts` and the runnable surface at `/admin/studio/invariant-video` (renders the real, fixed `SkillVideoPlayer`, seeded with a generated brief).

## Hypothesis

The same core invariants can underpin multiple video segments whose **prose varies** while the **invariants stay fixed**, producing one continuous story — proving that an invariant collection is a narrative substrate, not a script. Segment N and segment N+1 share no sentences; they share invariants.

## The capability envelope (verified against the deployed stitcher)

- Single generation (Sora / Venice incl. Wan): **≤ 12s per clip**
- Stitcher `POST /api/skills/video/stitch`: **2–3 clips per pass** (`{ clips: string[] (URLs in play order), experience_id?, tenant_id? }`), returns one public URL; ~60MB/clip cap
- **24s** = one pass (2×12s)
- **48s** = **two-pass hierarchical stitch**: (A+B → 24s) + (C+D → 24s) → stitch the two 24s outputs → 48s. Stitched outputs are ordinary clip URLs, so pass 2 is legal.

## Deliverables

- `video-brief-24s.md` — 2×12s, one continuous story bridged by the same core invariants, varied prose
- `video-brief-48s.md` — 4×12s progressive story arc, same core invariants throughout, each segment advancing the arc

## Production run (operator) — two paths

**Path A — code-generated (recommended now that the runner exists).** Visit `/admin/studio/invariant-video`: pick a `style`-namespace collection (the 7 CFS-011 seed invariants make a ready-made "house style" — group them into a collection first) and a semantic collection (e.g. the 18 EXP-001 invariants), choose 2/3/4 segments, generate the brief, then use the mounted `SkillVideoPlayer`'s own Generate button to run the real pipeline end to end (generation → per-segment prompts → hierarchical stitch).

**Path B — manual (the original briefs, still valid).**
1. Generate each 12s segment via the video skill (Sora or Venice) using the per-segment prompts verbatim from `video-brief-24s.md` / `video-brief-48s.md`.
2. Stitch per the plan in each brief (`/api/skills/video/stitch`).
3. Continuity keys (carry across ALL segments so the model treats them as one film): same protagonist descriptor, same palette/style line, same closing motif. These are in each brief's "Continuity block" — prepend it to every segment prompt.

## Evaluation (extends EXP-001's protocol)

Show the stitched video to the independent evaluator; ask: (a) which principles does this film assert? (b) is the story continuous? Score against the segment→invariant map in each brief: every asserted principle must map to a collection invariant (hallucination check), and each segment's intended invariants should be recovered (compression-fidelity check). Feed results back through the flywheel exactly as EXP-001.

## Phase 3b hook

The production run can be driven by the `consequence-operating-model.v1` chain: preflight grounds the intent in KnowledgeQube 001 (curation + forecast + disposition), the operator approves, generation/stitching executes, and the flywheel step records the observed outcome against the grounding invariants. The briefs are the `intentRef` payload.
