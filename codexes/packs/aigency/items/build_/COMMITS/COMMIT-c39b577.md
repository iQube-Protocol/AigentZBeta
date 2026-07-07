# Commit Brief: `c39b577` — Build DCIR D3: dynamic affordance service (suggest-only default, navigation-class auto-act boundary)

| Field | Value |
|-------|-------|
| SHA | [`c39b577`](https://github.com/iQube-Protocol/AigentZBeta/commit/c39b577fb6e9266e4465d2331103c351d0b7a1cb) |
| Author | Claude |
| Date | 2026-07-07T10:16:37Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build DCIR D3: dynamic affordance service (suggest-only default, navigation-class auto-act boundary)

services/dcir/affordances.ts — a pure, write-free recommendation layer that,
given the D1 DcirEvent stream + the D2 ConstitutionalStateSnapshot, derives the
LIVE affordances the runtime could surface next ("what should the operator do
next"). No execution, no mutation, no network, no fs/DB — isomorphic and
deterministic (no clock, no randomness), mirroring eventStream.ts / stateEngine.ts.

Ratified affordance policy (operator, 2026-07-07), enforced in code:
1. Suggest-only is the default and always-available posture (DEFAULT_AUTO_ACT_POLICY = { enabled: false }).
2. Opt-in auto-act ships OFF, with a trivial synchronous kill switch (disableAutoAct())
   and required notifications on every change (autoActPolicyChangeNotice on a setting
   flip, autoActNotice on an actual auto-execute).
3. Auto-act is boundaried to a single class: AUTO_ACTABLE_CLASSES = ['navigation'].
   resolveAutoActable() is the single choke-point — policy.enabled && aff.autoActable
   && class ∈ AUTO_ACTABLE_CLASSES — so mutation/deployment/external/governance/
   informational are suggest-only ALWAYS, even with auto-act enabled.

Completion/relevance contract (the intelligent-buttons dependency): an action already
executed or made irrelevant by observed events is NOT emitted. generateAffordances
derives (A) navigation "open the <capsule>" for a received-but-undecided proposal,
(B) suggest-only "record a deployment proposal" for a generated implementation pack
with no deployment proposed since, and (C) suggest-only "produce the next proposal"
for a stalled stage after a dismissal. isAffordanceLive(id, events, snapshot) re-derives
to answer "is action X still live?" truthfully. Every affordance carries a non-empty
capsuleScope (Capsule Containment) and outputs carry no T0 identifiers.

tests/dcir-affordances.test.ts — canaries pinning: AUTO_ACTABLE_CLASSES === ['navigation'];
resolveAutoActable false for non-navigation even when enabled; false for navigation when
disabled; completed actions are not emitted; and purity (same input → same output, no
throw on empty inputs).

Verification (vitest unavailable in sandbox): esbuild bundle gate on both files + a
node-assert drill (15 assertions) — all pass; tsc --noEmit clean.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

services/dcir/affordances.ts — a pure, write-free recommendation layer that,
given the D1 DcirEvent stream + the D2 ConstitutionalStateSnapshot, derives the
LIVE affordances the runtime could surface next ("what should the operator do
next"). No execution, no mutation, no network, no fs/DB — isomorphic and
deterministic (no clock, no randomness), mirroring eventStream.ts / stateEngine.ts.

Ratified affordance policy (operator, 2026-07-07), enforced in code:
1. Suggest-only is the default and always-available posture (DEFAULT_AUTO_ACT_POLICY = { enabled: false }).
2. Opt-in auto-act ships OFF, with a trivial synchronous kill switch (disableAutoAct())
   and required notifications on every change (autoActPolicyChangeNotice on a setting
   flip, autoActNotice on an actual auto-execute).
3. Auto-act is boundaried to a single class: AUTO_ACTABLE_CLASSES = ['navigation'].
   resolveAutoActable() is the single choke-point — policy.enabled && aff.autoActable
   && class ∈ AUTO_ACTABLE_CLASSES — so mutation/deployment/external/governance/
   informational are suggest-only ALWAYS, even with auto-act enabled.

Completion/relevance contract (the intelligent-buttons dependency): an action already
executed or made irrelevant by observed events is NOT emitted. generateAffordances
derives (A) navigation "open the <capsule>" for a received-but-undecided proposal,
(B) suggest-only "record a deployment proposal" for a generated implementation pack
with no deployment proposed since, and (C) suggest-only "produce the next proposal"
for a stalled stage after a dismissal. isAffordanceLive(id, events, snapshot) re-derives
to answer "is action X still live?" truthfully. Every affordance carries a non-empty
capsuleScope (Capsule Containment) and outputs carry no T0 identifiers.

tests/dcir-affordances.test.ts — canaries pinning: AUTO_ACTABLE_CLASSES === ['navigation'];
resolveAutoActable false for non-navigation even when enabled; false for navigation when
disabled; completed actions are not emitted; and purity (same input → same output, no
throw on empty inputs).

Verification (vitest unavailable in sandbox): esbuild bundle gate on both files + a
node-assert drill (15 assertions) — all pass; tsc --noEmit clean.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `services/dcir/affordances.ts` |
| Added | `tests/dcir-affordances.test.ts` |

## Stats

 2 files changed, 541 insertions(+)
