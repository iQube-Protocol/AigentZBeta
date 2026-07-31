# Commit Brief: `b7acd87` — Build DCIR D4: the universal substrate hook — surfaces adopt observation by declaration

| Field | Value |
|-------|-------|
| SHA | [`b7acd87`](https://github.com/iQube-Protocol/AigentZBeta/commit/b7acd87909cc65727f4f7cb158fd7e2ed3650bda) |
| Author | Claude |
| Date | 2026-07-07T18:31:21Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build DCIR D4: the universal substrate hook — surfaces adopt observation by declaration

Extract the DCIR observation seam (hand-wired identically through D1-D3 on
every instrumented surface) into ONE config-driven client hook,
services/dcir/useDcirSeam.ts. useDcirSeam({ surface, workflowStage?,
activeCapsule? }) returns { events, observe, groundObservation }, composing the
existing D1/D2 organs (appendDcirEvent, compactDcirEvents, buildStateSnapshot,
mineBehaviouralInvariants, compactBehaviouralInvariants) by import only — no
forked logic. Observe-mode-only: no affordances, no auto-act, no persistence in
the hook; those stay consumers of `events` on their surfaces.

groundObservation exposes EXACTLY the three server-contract field names —
recentEvents / stateSnapshot / observedPatterns — which the chat route's shared
pushDcirObservationLines reads by name (gc.recentEvents / gc.stateSnapshot /
gc.observedPatterns). Renaming any is a breaking change across every surface;
the hook header states this and tests/dcir-substrate.test.ts canaries it.

Adopted cleanly on all three originally-named surfaces:
- Dev Command Center (DevCommandCenterTab.tsx) — events aliased to dcirEvents so
  generateAffordances + the auto-act loop read the same array unchanged.
- aigentMe welcome split (AigentMeWelcomeSplitTab.tsx) — events aliased to
  dcirEvents so suggestionLive / dcirEventCountRef / the Feedback Coordinator
  read the same array. Capsule<->Layout contract untouched: no capsule/layout
  state, no engageCapsuleAndMount, no new effects, no layout resets.
- Studio Composer (ComposerStudio.tsx).

Each swapped its hand-wired [dcirEvents] state + observe callback + three
ground-context fields for useDcirSeam(...) + ...groundObservation. Behaviour
identical: every observe(...) call site is byte-for-byte unchanged; every other
reader of the old dcirEvents now reads the same array via the hook. Ground-
context memos keep all other fields and dependency arrays (dcirEvents ->
groundObservation; activeCapsuleId dropped from the aigentMe memo deps only
because it moved into the hook config and is referenced nowhere else in that
memo).

CCRL research copilot (CCRLResearchCopilotTab) keeps its hand-wired seam this
round — deliberately, to bound the blast radius to the three originally-named
surfaces; migrating it is a no-new-design follow-on. Noted in the CFS-020 D4
increment section, which also records the substrate hook, the three-field
server contract, the three adopted surfaces, and the rule that NEW surfaces
adopt via useDcirSeam (hand-wiring a fresh seam is now an Extend-Don't-Duplicate
violation).

Verified: esbuild parse gate passes on all touched files; tests/dcir-substrate
drilled via esbuild+node (7/7 pass).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Extract the DCIR observation seam (hand-wired identically through D1-D3 on
every instrumented surface) into ONE config-driven client hook,
services/dcir/useDcirSeam.ts. useDcirSeam({ surface, workflowStage?,
activeCapsule? }) returns { events, observe, groundObservation }, composing the
existing D1/D2 organs (appendDcirEvent, compactDcirEvents, buildStateSnapshot,
mineBehaviouralInvariants, compactBehaviouralInvariants) by import only — no
forked logic. Observe-mode-only: no affordances, no auto-act, no persistence in
the hook; those stay consumers of `events` on their surfaces.

groundObservation exposes EXACTLY the three server-contract field names —
recentEvents / stateSnapshot / observedPatterns — which the chat route's shared
pushDcirObservationLines reads by name (gc.recentEvents / gc.stateSnapshot /
gc.observedPatterns). Renaming any is a breaking change across every surface;
the hook header states this and tests/dcir-substrate.test.ts canaries it.

Adopted cleanly on all three originally-named surfaces:
- Dev Command Center (DevCommandCenterTab.tsx) — events aliased to dcirEvents so
  generateAffordances + the auto-act loop read the same array unchanged.
- aigentMe welcome split (AigentMeWelcomeSplitTab.tsx) — events aliased to
  dcirEvents so suggestionLive / dcirEventCountRef / the Feedback Coordinator
  read the same array. Capsule<->Layout contract untouched: no capsule/layout
  state, no engageCapsuleAndMount, no new effects, no layout resets.
- Studio Composer (ComposerStudio.tsx).

Each swapped its hand-wired [dcirEvents] state + observe callback + three
ground-context fields for useDcirSeam(...) + ...groundObservation. Behaviour
identical: every observe(...) call site is byte-for-byte unchanged; every other
reader of the old dcirEvents now reads the same array via the hook. Ground-
context memos keep all other fields and dependency arrays (dcirEvents ->
groundObservation; activeCapsuleId dropped from the aigentMe memo deps only
because it moved into the hook config and is referenced nowhere else in that
memo).

CCRL research copilot (CCRLResearchCopilotTab) keeps its hand-wired seam this
round — deliberately, to bound the blast radius to the three originally-named
surfaces; migrating it is a no-new-design follow-on. Noted in the CFS-020 D4
increment section, which also records the substrate hook, the three-field
server contract, the three adopted surfaces, and the rule that NEW surfaces
adopt via useDcirSeam (hand-wiring a fresh seam is now an Extend-Don't-Duplicate
violation).

Verified: esbuild parse gate passes on all touched files; tests/dcir-substrate
drilled via esbuild+node (7/7 pass).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` |
| Modified | `codexes/packs/ccrl/foundation/CFS-020_dcir-charter.md` |
| Modified | `components/composer/ComposerStudio.tsx` |
| Added | `services/dcir/useDcirSeam.ts` |
| Added | `tests/dcir-substrate.test.ts` |

## Stats

 6 files changed, 333 insertions(+), 80 deletions(-)
