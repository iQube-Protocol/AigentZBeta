# Backlog — Generalise `services/content/claimEdition.ts` for the metaMe protocol-universal spine

**Status:** backlog · noted 2026-05-21 · target: when ContentQubes expand beyond comics
**Related:** spine identity-access primitives (CLAUDE.md), ContentQube schema, ActivationTab refactor

## Problem

`services/content/claimEdition.ts` currently encodes assumptions that are specific to KNYT comic ContentQubes:

- `ContentQubeRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'secret_black_rare'` — a comic-edition rarity scheme.
- Canonical claim path assumes a pre-seeded edition pool (1–1860).
- Common claim path appends sequentially numbered editions sharing the same global counter.
- `claimEditionForPurchase` signature presumes a `sourcePurchaseId`.
- `releaseEdition` (added with the ActivationTab refactor) supports only common-rarity DELETE; canonical-return-to-pool is unimplemented.

The Aigent Me ActivationTab work uses these primitives with `rarity: 'common'` for activation surfaces — which works, but it's stretching a comic-shaped API to do a generic "persona holds claim to this iQube" job.

## Why this matters

The metaMe client protocol is supposed to be **iQube-universal**, not ContentQube-specific. As ContentQubes expand beyond comics (ExperienceQube, IntentQube, PolicyQube, ToolQube, ActivationTab, future iQube subkinds), every consumer that needs a "persona ↔ iQube claim/release" primitive currently has to either:

1. Reuse `claimEditionForPurchase` and pretend its non-comic context fits (what ActivationTab does today), or
2. Build a parallel claim service for its iQube kind (the anti-pattern CLAUDE.md's identity-spine section explicitly warns against).

Either choice means the spine drifts further from "one canonical claim primitive". The first carries comic semantics into non-comic surfaces; the second forks the spine.

## What the generalised shape should look like

A spine-level primitive that:

- Takes `iqubeId` (any iQube type — ContentQube, ToolQube, ExperienceQube, …), not `contentQubeId` specifically.
- Drops rarity from the core signature; expose it as an optional "claim variant" hint for iQube kinds that use it (comics → `rarity`; ActivationTab → none; ToolQube → `licence_tier`; etc.).
- Lets each iQube kind register a claim strategy (canonical pool vs. append-only vs. single-instance vs. capped-cohort vs. payment-bound).
- Emits the same DVN receipt taxonomy (`transfer` / `burn`) so the audit trail stays uniform across iQube kinds.
- Lives under `services/access/` or a new `services/iqube/claim.ts`, not `services/content/`.

## Suggested staging when this is worked

1. **Audit consumers** — who calls `claimEditionForPurchase` today? (KNYT purchase flow, ActivationTab auto-grant / activate.)
2. **Lift comic specifics out** — move rarity-pool logic into a `comicClaimStrategy` module that the generalised primitive delegates to.
3. **Introduce iQube-kind registry** — each kind registers its claim/release strategy at load time.
4. **Re-point existing callers** — KNYT purchase → comic strategy; ActivationTab → `appendOnly` strategy. No behaviour change.
5. **Add canonical-rarity release** — the missing `persona_id = NULL` "return-to-pool" branch in `releaseEdition`, gated on the appropriate strategy.
6. **Move file** — rename `services/content/claimEdition.ts` → `services/iqube/claim.ts` (or similar). Update imports. Deprecate the old path with a re-export.

## Files most likely touched

- `services/content/claimEdition.ts` → split/move
- `types/contentQube.ts` (rarity type lives here today; comic-specific bits move to a comic types module)
- `services/access/contentQubeReceiptEmitter.ts` → generalise to `iqubeReceiptEmitter.ts`
- `services/rewards/purchaseHandler.ts` (consumer)
- `services/activations/spineActivations.ts` (consumer)

## Non-goals (now)

- Changing the DVN receipt schema. The `receipt_kind` enum (`creation | access | transfer | mint | burn`) is already iQube-generic and stays.
- Changing the ContentQube tables. The schema is fine; only the JS-layer claim primitive needs to be promoted from "comic edition claim" to "iQube claim".
