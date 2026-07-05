# EXP-002 — Invariant-Carried Video

**Chrysalis Foundation · Experiment 002 · Status: FULL PIPELINE VALIDATED IN PRODUCTION 2026-07-05 — 4×12s Sora render, stitched, operator first-viewing evaluation confirms temporal continuity. Formal judge-protocol scoring pending.**
Companion to EXP-001 (same KnowledgeQube 001 collection — the video artifacts of the Living KnowledgeQube).

## Production run 2 (complete) — 2026-07-05: the 48-second film exists

Full end-to-end run on Sora (`openai`, 4×12s segments, constitutional namespace,
style + narrative layers on, post-terminal-beat-fix brief). Sequence manifest
`4 segments · openai · 2026-07-05 19:06` — segments
`video_6a4ae370f6e…f84a6f`, `…f98c81909…a554`, `…7108108190918746e…fbbb9af`,
`…d3dc8190a84ecc…f322e`, all four persisted to storage at completion (19:08:51–54).

**Run timeline — and what each step validated:**

1. **Generation succeeded on all 4 segments** with distinct per-segment prompts
   from the invariant-composed brief.
2. **The native in-run stitch failed** (first container's ffmpeg cold path) —
   but unlike the two lost runs earlier the same day, **nothing was lost**:
   completion-time persistence had already stored all four clips, and the
   sequence manifest (written at submit time, before any segment completed)
   had already recorded their play order.
3. **On page refresh, the recovery panel presented the run as a sequence** with
   its recorded order, and the one-click in-order stitch produced the final
   48s film via the /tmp-fetched ffmpeg.
4. **Sequencing carried as data, not inference**: the storage listing orders
   clips newest-first — the reverse of play order. A recovery that inferred
   order from timestamps would have assembled the film backwards; the stitch
   honoured the manifest's recorded order instead. That is
   `inv.constitutional.078` (Constitutional Sequencing) operating as
   infrastructure: composition order is constitutional data that must travel
   with the composition, never be reconstructed from storage artifacts.

**Operator first-viewing evaluation (2026-07-05):**

- **Complete continuity of narrative, protagonist, settings, and constitutional
  context across all four segments** — the style continuity block (CFS-011) and
  endpoint-anchored narrative mapping (CFS-012 §4, post-fix) held across four
  independent 12-second generations stitched into one film.
- **Character persistence held at the class level, not the instance level**: the
  protagonist reads as the same person (a woman of African descent, consistent
  presentation) across all segments, with slight wardrobe variance and
  non-identical facial features between segments. This is exactly the v1
  Continuity Block's known granularity ceiling — prose-level identity
  description cannot pin instance-level phenotype across independent
  inferences. It strengthens the Law XV class-purity case for dissolving the
  mixed block: **identity continuity needs its own ratified invariant class**
  (likely with reference-image or seed-carrying mechanics, beyond prose), per
  the CFS-011 backlog.
- Caveat, stated honestly: this is the operator's first-viewing assessment, not
  the formal evaluation protocol below (independent evaluator, questions a/b/c,
  segment→invariant map scoring). The formal pass — including the reversed-order
  sequencing control arm — remains open; its result updates this section.

**Frame-level evidence (operator-supplied stills at 0:08, 0:14, 0:29, and the
final segment, reviewed 2026-07-05):**

- **`inv.style.005` observably held — and held *intelligently*.** The recurring
  constitutional symbol (**the bearing mark**, a compass-rose) persists across
  three independent generations in three DIFFERENT material implementations:
  worn as a necklace by the protagonist in segment 2, as a lapel pin in
  segments 3 and 4, and additionally as a wall banner in segment 4's assembly
  hall. And it is **correctly absent from segment 1**, whose narrative context
  is standing/confirmation rather than bearing — that segment carries the
  octagonal "Confirmed" seal instead. This is stronger evidence than uniform
  persistence would be: the composition did not paste an icon invariantly, it
  deployed the *symbol* invariantly while varying its material expression and
  withholding it where narratively inapt. Motif persistence modulated by
  narrative context is exactly the field-composition behaviour Law XV predicts
  (style × narrative solved simultaneously, neither dominating), and the mark
  itself is the visual of CFS-014 §4a's orientation note: bearing worn on the
  body of the polity's citizens. A style invariant surviving four separate
  inference calls as *iconography*, not just palette, is the strongest single
  visual in the run.
- **World continuity is visible frame-to-frame**: civic/constitutional setting
  language (screens, council chamber, classical portico, community assembly)
  and consistent cinematic grade across all four segments — the CFS-011
  continuity block operating as designed.
- **Instance-level identity variance is more pronounced than first noted**: the
  protagonist's apparent age and styling shift visibly between segments (older
  presentation at 0:08; younger at 0:14 and the finale) while remaining
  class-consistent throughout. This sharpens — not weakens — the
  identity-continuity finding: prose can carry *who the character is
  constitutionally*; it cannot pin *which instance of them* renders. The
  dedicated identity-continuity class (CFS-011 backlog) is the answer, not a
  more adjectival continuity block.

**New finding — content-duration adherence (segment 2→3 boundary):** some of
segment 2's audio truncates at the stitch boundary. The stitched film is
exactly 48s, so the stitcher preserved durations — the truncation means
**segment 2's generated content (speech) overran its 12-second window**, a
known provider behaviour. This is a composition-layer gap, not a stitch
defect: nothing in the brief currently constrains spoken content to complete
within the segment duration. Candidate fixes, in invariant terms: a
duration-adherence clause in the per-segment prompt (cheap, immediate) and/or
a ratified experience/style invariant of the form *"spoken content resolves
within the segment's duration bound"* — plus, at the engineering layer, a
per-segment duration/audio-tail check at persistence time so overruns are
flagged before stitching. Logged for the next brief iteration.

**Infrastructure validated incidentally by this run** (each a same-day fix from
the two failed runs earlier on 2026-07-05): completion-time segment persistence
(both providers), submit-time sequence manifests, the recovery panel's
sequence-first stitching, and the /tmp cold-start ffmpeg fetch. One open item:
the native in-run stitch still failed once before the recovery path succeeded —
suspected first-container race between the warm-up download and the stitch
call's budget; watch the next run's logs before changing anything.

## Production run 1 (partial) — 2026-07-04: the brief pipeline validated, and the Coherence Engine earned its keep

The operator ran `/admin/studio/invariant-video` end-to-end up to the generation call
(4 segments, constitutional namespace, style + narrative layers on). Everything up to
the video provider worked in production:

- **Grounding resolved live** — semantic invariants distributed round-robin across 4
  distinct segment prompts (the original "same clip twice" defect visibly gone), the
  7-invariant style continuity block rendered identically into every segment, and the
  5-beat narrative arc mapped sequentially.
- **CCS 93.3 — PASS** (semantic 100, style 100, narrative 80), with one warning that
  turned out to be **a real defect, correctly caught by CFS-014 on its first production
  use**: *"arc does not open on the first beat and close on the last."* The v1
  proportional mapping `floor(i × beatCount / N)` dropped the TERMINAL beat whenever
  beats exceeded segments — 5 beats over 4 segments rendered N-001..N-004 and the
  transformation (N-005) never resolved. The validator saw the missing resolution the
  humans reading the brief did not.
- **Fixed same day** (endpoint-anchored mapping — first and last beats always anchor;
  interior beats compress first; CFS-012 §4 amended per its own evidence-driven tuning
  rule; canary test updated). Post-fix, the same brief maps N-001, N-002, N-004, N-005
  and should score narrative 100 / CCS 100.
- **Blocked at the provider**: Venice video generation returned insufficient-credits;
  the final render awaits credits at venice.ai/settings/api. The LLM prose pass also
  fell back to the deterministic template (grounding-only by construction) — expected
  behaviour with providers down.

This partial run is itself flywheel evidence: the composition laws (CFS-013), the
coherence field (CFS-014), and the fix loop operated exactly as specified — a
constitutional validator catching a constitutional-composition bug before a single
frame was generated.

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

## Sequencing arm — extension of the coherence test (added 2026-07-05)

Constitutional Sequencing (the Law XV corollary, `inv.constitutional.078`) predicts a
failure class that EXP-002's coherence evaluation can test directly with **zero new
generation cost**: correct components arranged in an invalid sequence do not
constitute a coherent experience.

**Design.** The Experiment Lab's recovery panel stitches a recorded sequence two ways
from the identical clip set:

1. **In recorded order** — the manifest's play order, honoured verbatim (the treatment).
2. **Reversed** — the "Stitch reversed (sequencing control)" button: every segment
   locally correct, every pairwise style/semantic relationship intact, only the
   temporal ordering violated (transformation before establishment; completion never
   arrives last).

**Prediction.** The in-order stitch scores normally on the EXP-002 evaluation; the
reversed stitch degrades specifically on the *narrative continuity / story
coherence* questions while passing the hallucination and principle-recovery checks —
i.e. the evaluator sees the right principles asserted with the story broken. That
dissociation (semantic fidelity intact, temporal coherence destroyed) is the
sequencing corollary's signature, and it isolates the third correctness kind
(CFS-013 §7: temporal) from the two the original protocol already measures.

**Protocol.** Score both stitches with the same evaluator questions as the main run,
plus: (c) do events occur in an order that makes sense? Record the two as separate
experiment instances sharing a `clipSetRef` (the sequence id). The reversed arm is a
CONTROL — its receipts feed the flywheel as validation evidence for
`inv.constitutional.078`, never as a production artifact.
