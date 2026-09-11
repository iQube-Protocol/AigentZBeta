# OCSGA Delegated Completion & CTP-001 Delegability Correction (2026-08-30)

**Status:** Session record — implementation + doctrine correction.
**Amends:** `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md` §4's `ctp.exchange.artifact.confirm` object model (was illustratively `delegability: false`; corrected to `true`).
**Touches no ratified invariant.** `inv.constitutional.369` (Principal-Only Constitutional Acts) is unaffected and, on inspection, was never a rule that RAX's confirm/freeze/sign acts are non-delegable — see the audit below.

## Context

Following the 2026-08-29 record (`2026-08-29_ocsga-implementation-singularity-and-principal-only-acts.md`), Ian remained blocked at the Reciprocal Artifact Exchange's remaining principal-only acts — `confirm`, `freeze`, `sign` — despite already holding an established Passport, established personhood, an active delegation to his aigentMe, a bound exchange, and a registered Party B artifact.

## What was actually blocking him

`app/api/research/exchanges/[exchangeId]/actions/route.ts` derived `actorType` from `resolveConstitutionalContext(req).currentAigentMe` — a field that answers *"does this persona have an aigentMe assistant assigned to it"*, true for essentially every onboarded principal, not *"is the persona making this call itself an agent standing in for its principal"*. Every principal with an assigned aigentMe (i.e. every principal) was therefore refused `freeze`/`sign` as a "delegated agent," regardless of who was actually acting.

## The fix

`resolveExchangeActingPrincipal` (`services/research/reciprocalExchange.ts`) replaces that check. It resolves `personaId` + `actorType` directly from the exchange's own bound party: the caller's active persona if it is itself the bound party, else any sibling persona under the same auth profile that is already bound to this specific exchange (mirroring the sibling-lookup already proved for orientation, `resolveOrientationPrincipalGate`, `services/journey/ianJourneyState.ts`, but scoped to one exchange rather than "the most recent exchange any sibling is bound to"). This removes the dependency on which persona happens to be mounted in the browser/localStorage. Deployed to `dev` as `db76ccef7`.

## The constitutional audit

Before further changes, an audit asked: is "confirm/freeze/sign are principal-only, non-delegable" actually grounded in a ratified rule, or is it a code-level assumption? Findings:

- **No ratified invariant, PRD, or spec text anywhere in this repo declares `confirm`, `freeze`, or `sign` constitutionally non-delegable.**
- The only place the claim existed in a structured form was CTP-001 §4's `ctp.exchange.artifact.confirm` object-model illustration (`actor.requirement: AUTHORIZED_PRINCIPAL_IDENTITY`, `delegability: false`) — but CTP-001 is explicitly self-described as *"CHARTERED... no runtime is implemented"* and *"recorded, not ratified as built."* A design illustration, not doctrine.
- Code comments in `services/journey/ianBoundaryResearchJourney.ts` (freeze, sign, and separately deposit) cited a "constraint 2" / "CLAUDE.md 'Artifact Deposit Actor' constraint" that does not exist anywhere in CLAUDE.md — dangling citations to nothing, in both `ianBoundaryResearchJourney.ts` and `types/journey.ts`.
- `inv.constitutional.369`'s actual claim is narrower than "constitutional acts are non-delegable": it requires that a principal-only act be *correctly attributed* to the real principal at the execution boundary, and that delegability be an *explicit declaration* rather than assumed — its own empirical basis was Ian's orientation receipt landing on his agent's persona row (an identity-resolution bug), not an assertion that freeze/sign/confirm are inherently non-delegable. Invariant 370 (delegability as a per-act declaration) presupposes some acts *are* delegable.
- PRD-IRL-AX-001 only says the audit trail should *distinguish* principal signatures from delegated-agent operations — implying delegated signing is a legitimate, expected case that must be labeled, not one that is forbidden.
- The general delegation-authority model (`services/delegation/delegationAuthorityGate.ts`) is allowlist-based with no non-delegable-action-type concept at all — anything not explicitly granted is simply refused as ungranted, never flagged as constitutionally forbidden. RAX's acts (deposit/confirm/freeze/sign/withdraw/revoke) were never even entered into the existing `DelegatedActionId` vocabulary (`services/delegation/delegatedActionVocabulary.ts`, currently Google/Marketa-connector-scoped only) — this was an oversight, not a considered exclusion. `deposit` (`depositArtifact`) already has zero `actorType` check today, confirming at least one RAX act was already unconditionally delegable in the real implementation.

## The governing rule going forward

> **Delegability is explicit authority, not an exception to constitutional action. Non-delegability requires an explicit constitutional basis** — a ratified invariant, PRD, or spec text — never an assumption encoded only as a code comment.

The corrected model:

```
Ian personhood + valid Passport + active delegation + permitted action + valid state
        ↓
   authorize delegate
        ↓
  canonical constitutional act (existing confirm/freeze/sign implementation, unmodified)
        ↓
   attribution: principal = Ian, actor = aigentMe (where genuinely delegated)
        ↓
     evidence / receipt
```

## Documentation cleanup performed

Purely descriptive/comment changes — none of these fields are read by any runtime resolver (`resolveJourneyState` never reads `actorRole`/`originRequirements`; `tests/threshold-mcp-constitutional-rituals.test.ts` canaries this):

- `services/journey/ianBoundaryResearchJourney.ts` — the `freeze-attestation`, `exchange-ready`, and `create-deposit` stages' `actorRole` corrected from `ActorRole.PRINCIPAL` to `ActorRole.EITHER`, with their stale "per constraint 2" / "Only PRINCIPAL can deposit" comments replaced by an accurate explanation and a pointer to this record. `orient`, `passport`, `delegation-establish`, and `research-active` are untouched — none of their comments asserted a falsified claim, and `delegation-establish` in particular is self-evidently non-delegable (an agent cannot grant its own delegation).
- `types/journey.ts` — `ActorRole`'s and `ConditionExpression`'s doc comments no longer cite the nonexistent "CLAUDE.md constraint 1" / "Artifact Deposit Actor constraint"; `ActorRole`'s comment now states plainly that it is display-only, never a runtime gate.
- `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md` §4 — amended before the charter becomes active implementation, per operator direction ("amend the charter while it is still chartered than let that example harden into implementation"). `ctp.exchange.artifact.confirm`'s `actor`/`delegability`/`control` fields corrected to permit `AUTHORIZED_DELEGATE` under an active delegation grant scoped to `exchange.artifact.confirm`, with an inline amendment note.
- `tests/threshold-constitutional-navigator.test.ts` — one assertion (`state.nextAct?.actor`) updated from `'principal'` to `'either'` for the `create-deposit` stage, matching the corrected label.

No new receipts, no new Passport checks, no new delegation ceremonies, and no bridge-specific transition logic were introduced. `declareFreeze`, `signInstrument`, and `confirmOperatorAssistedArtifact` are unmodified.
