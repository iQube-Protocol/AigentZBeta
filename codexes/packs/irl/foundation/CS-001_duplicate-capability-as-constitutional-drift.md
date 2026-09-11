# CS-001 — Duplicate Capability as Constitutional Drift

**Canonical case study · Chrysalis 2.0 / Consequence Engineering · 2026-07-13**
**Status: recorded by operator direction ("I'd actually turn this into a canonical case study"). Candidate for formal CPS publication when the operator schedules it.**

## The one-sentence lesson

> Without constitutional awareness of existing capability, intelligence naturally trends toward duplication rather than composition.

## What happened (the full observed sequence, same day)

1. **An Implementation Pack was generated blind.** The pack for *"Develop a skill that generates a 24-second video and a corresponding article"* shipped with `empty-canon` grounding, no invariant bindings, and *"areas to touch: not drafted."* It was honest about its blindness (risk 59, `low_confidence_knowledge`) — but blind.
2. **A highly capable implementation agent executed it** — and, finding no article generator in its own reconnaissance, **built one** (`draftArticleFromBrief` via the sovereign router).
3. **The platform already had one.** `skill:article_generation` existed in the Studio catalog, marked `use_directly` in the very Gap Analysis the dev-loop session had produced. The session *knew*; the pack didn't; the agent didn't.
4. **The pipeline's own Consequence Canvas had predicted the failure class in advance**: its first should-never-happen entry was *"Creation of duplicate capabilities leading to redundancy."* The boundary existed — it just never travelled to where the work happened.

## Why this is not a model failure

The implementing agent did competent reconnaissance (it found and composed the video pipeline, the coherence engine, the fixed player). It missed one asset in a large codebase because **the constitutional state that named that asset died in the session that produced it**. Any intelligence — human or model — recreates what it cannot see. The defect class is *state amnesia between pipeline stages*, and it is precisely the class Chrysalis 2.0 exists to eliminate.

## The engineering response (all shipped 2026-07-13)

| Gap | Fix |
|---|---|
| Stage findings died in the session | **Capability Evidence** — a persisted constitutional primitive (`capability_evidence` table): evidence outlives sessions; pack generation persists fresh evidence and reads it back for future generations of the same goal |
| The pack couldn't say "don't build this" | **Constitutional Decision** — an explicit pre-draft stage deciding the realization mechanism over the nine mechanisms + `none` ("capability exists — compose, build nothing"), recorded on the pack with rationale and alternatives |
| The drafter had no anti-duplication mandate | The evidence block folds into the draft prompt with *"re-implementing an existing capability is a defect"* stated verbatim |
| The canon was invisible | Seed invariants advanced `proposed → validated`; namespace drift fixed (12 namespaces); `empty-canon` retired |

## The measured before/after (same goal, same day)

| | Blind pack | Evidence-informed pack |
|---|---|---|
| Areas to touch | not drafted | the session-named paths |
| What exists | absent | 3 EXISTING with reuse dispositions |
| Validation | generic quality checks | capability-specific (alignment, render, bundle) |
| Receipts | generic | mapped to integration milestones |
| Anti-duplication boundary | absent | carried + enforced in the mandate |

The downstream plans reorganized themselves around the evidence without any change to the drafting model — **constitutional context altering downstream reasoning**, which is the hypothesis Chrysalis set out to test.

## The invariant this case grounds

Proposed for the seed crystal (constitutional namespace): *"Capability evidence persists across pipeline stages and sessions; a constitutional pipeline never forgets what exists. Realization decisions precede implementation plans, and composition precedes construction."*
