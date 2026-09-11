# Commit Brief: `f647b06` — Add the auto-act control surface to the Dev Command Center (opt-in, navigation-only, always-disablable, always-notifying)

| Field | Value |
|-------|-------|
| SHA | [`f647b06`](https://github.com/iQube-Protocol/AigentZBeta/commit/f647b06df9ce867dea367b59939453984d0b323b) |
| Author | Claude |
| Date | 2026-07-07T13:22:46Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add the auto-act control surface to the Dev Command Center (opt-in, navigation-only, always-disablable, always-notifying)

Consumes the ratified D3 auto-act policy engine (services/dcir/affordances.ts,
unmodified) to give the operator an opt-in control that honours every caveat:

- Opt-in toggle in the right-pane chrome, mirroring the existing chip/badge
  styling. Ships OFF (DEFAULT_AUTO_ACT_POLICY) — suggest-only is the default.
- Caveat 2a — the toggle IS the kill switch: whenever auto-act is ON the button
  reads "Auto-act ON · Disable" and one synchronous click routes through
  disableAutoAct(). Always visible, single click, no I/O.
- Caveat 2b — notify on flip AND on execute: every toggle surfaces
  autoActPolicyChangeNotice(next); every actual auto-execution surfaces
  autoActNotice(aff) via a dismissible inline notice banner.
- Caveat 3 — the execution loop is an effect keyed on the live affordances +
  policy that routes EVERY candidate through resolveAutoActable (the single
  affordances.ts choke-point; the class check is never hand-rolled). Only the
  navigation class can auto-act, and only opening its capsule via
  engageCapsuleAndMount (Capsule Containment — no orphan output). A no-op when
  policy is disabled; an at-most-once ref guards against loops/repeats.
- Observation: each auto-act fires devAutoActedEvent(label, scope) into the DCIR
  seam — a T2-safe summary (affordance label + capsule scope), never a T0 id.

Extends liveAffordanceScopes (from the intelligent-quick-actions increment) into
a full liveAffordances memo so the pulse gate and the execution loop share one
generateAffordances call. Adds a consuming-side canary to
tests/dcir-affordances.test.ts re-pinning: policy on → only navigation selected;
policy off/killed → nothing selected; both notice paths non-empty; no T0 leak.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Consumes the ratified D3 auto-act policy engine (services/dcir/affordances.ts,
unmodified) to give the operator an opt-in control that honours every caveat:

- Opt-in toggle in the right-pane chrome, mirroring the existing chip/badge
  styling. Ships OFF (DEFAULT_AUTO_ACT_POLICY) — suggest-only is the default.
- Caveat 2a — the toggle IS the kill switch: whenever auto-act is ON the button
  reads "Auto-act ON · Disable" and one synchronous click routes through
  disableAutoAct(). Always visible, single click, no I/O.
- Caveat 2b — notify on flip AND on execute: every toggle surfaces
  autoActPolicyChangeNotice(next); every actual auto-execution surfaces
  autoActNotice(aff) via a dismissible inline notice banner.
- Caveat 3 — the execution loop is an effect keyed on the live affordances +
  policy that routes EVERY candidate through resolveAutoActable (the single
  affordances.ts choke-point; the class check is never hand-rolled). Only the
  navigation class can auto-act, and only opening its capsule via
  engageCapsuleAndMount (Capsule Containment — no orphan output). A no-op when
  policy is disabled; an at-most-once ref guards against loops/repeats.
- Observation: each auto-act fires devAutoActedEvent(label, scope) into the DCIR
  seam — a T2-safe summary (affordance label + capsule scope), never a T0 id.

Extends liveAffordanceScopes (from the intelligent-quick-actions increment) into
a full liveAffordances memo so the pulse gate and the execution loop share one
generateAffordances call. Adds a consuming-side canary to
tests/dcir-affordances.test.ts re-pinning: policy on → only navigation selected;
policy off/killed → nothing selected; both notice paths non-empty; no T0 leak.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` |
| Modified | `services/dcir/eventStream.ts` |
| Modified | `tests/dcir-affordances.test.ts` |

## Stats

 3 files changed, 172 insertions(+), 3 deletions(-)
