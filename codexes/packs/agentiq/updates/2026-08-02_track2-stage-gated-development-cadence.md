# Track 2 — stage-gated development cadence (operator-ratified, 2026-08-02)

**Status:** ratified working agreement. Binds every agent working on the Track 2 programme
(Claude Code, Codex, Lovable, any future agent).

---

## The directive, verbatim

> We are now entering the scientific execution phase of Track 2. After each completed stage,
> stop. Do not implement downstream stages based on assumptions. Wait until the outputs of the
> current stage exist, then build only the operator workflow required to steward the next stage.
> Preserve the constitutional separation between scientific discovery and governance throughout.

> That keeps the UI evolving from real data instead of hypothetical data.

---

## What it changes

The prior instruction was to build Stages 2–11 as one implementation. That is now explicitly
**withdrawn**. Stage 2 (Review & Admit) shipped because it was the blocker and its inputs
existed — 47 discovered sources, 41 awaiting a decision. Stages 3–11 do **not** get built until
the stage before them has produced real output.

| | Old cadence | Ratified cadence |
|---|---|---|
| Trigger to build a stage | The plan says so | The **previous stage's outputs exist** |
| What gets built | The whole ladder | Only the operator workflow for the **next** stage |
| Between stages | Continue | **Stop**, and report |

## Why this is the correct discipline, not merely slower

A workflow surface built ahead of its data is designed against an **imagined** shape of that
data. Three things follow, and all three have already cost this programme time:

1. **The surface asserts a shape the data does not have.** The Stage 8 assignment control asks
   the operator to type invariant IDs, because when it was written there were no validated
   invariants to list. A field that exists because nothing could populate it is a design frozen
   around an absence.
2. **It cannot be dry-run.** A stage with no inputs cannot be exercised, so its refusals, its
   empty states and its error paths are all unverified — the class of defect this session has
   spent most of its time on.
3. **It reads as progress.** A rendered stage looks finished. The whole reason the crystal
   surface was rebuilt around a lifecycle ladder was that a state machine displayed as a single
   verdict let the operator believe work had happened that had not.

Building from real data inverts all three: the shape is observed, the surface is exercised the
moment it exists, and nothing renders until it is genuinely reachable.

## The separation this must not erode

Scientific acts and governance acts stay visibly distinct at every stage, as they are today in
`services/research/track2Programme.ts` (`workKind: 'scientific' | 'governance'`). The cadence
does not relax that; it makes it easier to hold, because each stage is built while the
distinction for that stage is concretely in front of us rather than remembered from a plan.

## Constraints that remain in force

Unchanged and non-negotiable, from the 2026-08-02 implementation directive:

- no automatic admission · no automatic promotion · no automatic validation
- no automatic assignment · no automatic freeze
- every governance act explicit, receipted and attributable
- scientific and governance acts visibly separated

## Where the programme stands

| Stage | State | Gate on the next build |
|---|---|---|
| 1 · Discover Sources | ✅ complete — 47 sources | — |
| 2 · Review & Admit | ▶ **current** — steward queue shipped, search + canon export shipped | 41 decisions are the operator's to make |
| 3 · Extract Candidates | ⏸ not built | **Build when sources have been admitted and extraction has produced candidates** |
| 4–11 | ⏸ not built | Each gated on the stage before it |

## Known debt, deliberately not fixed ahead of its stage

**Stage 8 still asks for invariant IDs by hand.** Al flagged this and it is real. It is *not*
fixed yet, because the checkbox list it should become must be built against the validated
invariants that will actually exist — which is the output of Stage 6. Fixing it now would repeat
the exact mistake this cadence exists to stop. It is recorded here so it is not forgotten, and
it is the first thing to build when Stage 6 produces output.

---

## Related

- `services/research/track2Programme.ts` — the eleven-stage projection (derived, never stored)
- `components/research/Track2ProgrammePanel.tsx` — the operator surface
- `tests/track2-steward-workflow.test.ts` — the constitutional canaries
- PRD-ICA-001 §6/§8/§9 — Corpus Scout review, the decision vocabulary, the human-approval rule
