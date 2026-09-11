# EXP-004 — Sovereignty (self-hosted reasoning)

**Family:** Foundational Validation Series (extension) · **Status:** run complete; canonical publication via the Results record

## Aim
Test whether the platform's invariant-grounded reasoning **holds under a sovereign (self-hosted) model provider**, not only a frontier one — i.e. that the value is in the *constitutional substrate + composition*, not in a single proprietary model. Sovereignty is a first-class platform claim (a citizen's reasoning must not depend on one vendor).

## Method
The same grounded task is run through the **sovereign-floored model router** (`callSovereign`) and compared against a frontier arm at equal grounding. The experiment records the provider/model per arm (never merged across models) and scores whether the grounded outcome is preserved under the sovereign provider. A **rehearsal/frontier-fallback arm** exists to unblock the drill when a self-hosted provider is unavailable, recorded transparently as such.

## Reproduce
- Runner: `components/composer/Exp004SovereigntyRunner.tsx` (Experiment Lab → Foundational Series → EXP-004).
- Publish → the run is content-hashed and DVN-anchorable in the canonical Results record; the Findings Report auto-includes it.

## Honest limits
Deltas are within the tested provider pair; cross-provider generalisation is the scale-up step (see EXP-005 Provider Choice, which isolates outcome stability across *interchangeable* providers).
