# Scope vs. Context-Binding — Operator Ruling and Design Requirement

**Date:** 2026-08-15
**Programme:** Homecoming III — Phase 5 (invariant-evidence / failure-learning loop)
**Trigger:** Architectural clarification requested mid-Phase-5; audited before continuing.
**Base:** `claude/compassionate-planck-vz7x29` @ `5c2880d20`

---

## What was asked

Before hardening DevOn/IDE 2.0, the operator asked for an audit confirming that Smart Triad
Copilot and DevOn are not independent invariant-resolution consumers, and that DevOn is a
development specialist of the same substrate rather than a fork of it. The audit
(`2026-08-15_homecoming-iii-bootstrap-architecture-audit.md`'s Phase 5 continuation) confirmed the
substrate-sharing and the Agent Z/C routing, and surfaced one open question: whether the pinned
Phase 1 `INVARIANT_SCOPES` ladder (`constitutional → cross-domain → software-development →
agentic-development → project-runtime → repository → intent`) needed a `developer`/`user` rung to
represent personal/project context, per the operator's stated 8-rung ladder.

## The ruling

**`INVARIANT_SCOPES` is not extended. Scope and context-binding are orthogonal axes, and the ladder
governs only the first:**

- **Invariant scope** — WHERE a causal proposition applies (the existing seven rungs, unchanged).
- **Context binding** — WHICH authorized person's/developer's/project's state is relevant to the
  present resolution. Not a causal scope; a separate axis entirely.

Personal/developer state must never be added to `INVARIANT_SCOPES` as an eighth rung. Doing so
would make "this is my project's context" look like a claim about where a proposition holds
causally, which it is not — conflating the two is precisely the defect this ruling forecloses.

### The design requirement (recorded, not implemented)

A future context-binding axis, capable of representing, where relevant:

```
platform / workspace / project / developer / principal-user / session-intent
```

This is **out of scope for Phase 5**. It is recorded here as an explicit **Crystal 2.0 /
post-threshold extension point**. If Phase 6 (live-model dogfood) needs personal/developer context,
it must reuse the existing `groundContext` / authorized-context mechanisms already wired to the
Copilot and DevOn — never a new session store — and preserve the scope/context distinction rather
than collapsing it under schedule pressure.

**T0/T2 discipline is preserved unconditionally.** Context binding must never carry raw `personaId`,
`rootDid`, or other prohibited identity material into `DevLoopState` or any DCIR/evidence payload —
the existing `DEV_LOOP_FORBIDDEN_STATE_KEYS` guard (`types/devLoopLearning.ts`) already enforces
this for `DevLoopState` and is unaffected by this ruling. Context binding, when built, must use
existing authorized state, opaque references, or T2-safe derived context — the same discipline the
HMS locker-ref pattern already establishes elsewhere in this codebase.

### The learning direction this implies

```
context-specific observation → scoped evidence → governed portability/abstraction → broader Crystal
                                                                                     only when justified
```

One developer's or one project's observation must never become global software knowledge merely
because the same DevOn capability serves multiple users. This is exactly the failure mode
`services/devCommandCenter/failureLearning.ts`'s `assessRecurrencePortability` was tightened against
in commit `5c2880d20`: no production caller pools `RiskObservation`s across scope-authority
boundaries today, and the function's doc contract now states that any future caller wiring a
persistent store must pre-filter to an authorized scope first.

## Agent architecture ruling (accepted as canonical)

- Smart Triad Copilot is the generic interaction shell.
- Aigent C serves the customer/NBE side.
- Aigent Z is the engineering/platform intelligence.
- DevOn is a development-specialist Smart Triad Copilot backed by Aigent Z — consistent with the
  existing contract (`docs/agent-harness/aigent-z-aigent-c-contract.md`, `app/data/personas.ts`)
  under which Aigent C explicitly routes engineering/codebase work to Aigent Z.

DevOn is not refactored under Aigent C to fit the earlier conceptual lineage diagram. "A user's own
DevOn" means a user-specific, contextualized instance of the common DevOn/Aigent-Z capability — not
a fork of Aigent Z, and not a private copy of Crystal.

## Disposition

No Phase 1 contract is reopened. No code implements the context-binding axis yet — it is a recorded
design requirement only, revisited when Phase 6 or a later phase demonstrates a real need. Phase 5
continues on the existing plan; this ruling removes the one open question the prior audit held open.

## Evidence

- `types/invariantEnvelope.ts:159-168` — `INVARIANT_SCOPES`, unchanged, seven rungs.
- `tests/invariant-envelope-contract.test.ts:374` — pins the seven-rung order; unchanged.
- `types/devLoopLearning.ts` — `DEV_LOOP_FORBIDDEN_STATE_KEYS` (T0-isolation, pre-existing, unaffected).
- `services/devCommandCenter/failureLearning.ts` (commit `5c2880d20`) — scope-authority boundary
  documented on `assessRecurrencePortability`.
- `docs/agent-harness/aigent-z-aigent-c-contract.md`, `app/data/personas.ts:130-171` — Agent Z/C
  routing contract, confirming DevOn↔Aigent-Z is the contract's own design, not a drift.
