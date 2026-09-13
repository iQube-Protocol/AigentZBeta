# OCSGA Exchange — Mistaken Revoke, Restore, and a Confirmation Guard

**Status:** Shipped. Restores a live, mistakenly-revoked exchange and adds a confirmation dialog to
prevent the same accidental one-click mistake going forward.

## What happened

The operator, acting through their Aigent Z persona, clicked "Revoke my future access" on the live
CI/IRL × OCSGA exchange (`0b4134a6-6246-48a8-98f6-e3a22fcd18b3`) without intending to. The button was
a plain, unstyled text link (`text-[11px] text-slate-500`) with no confirmation step and a label that
undersells the consequence — "Revoke **my** future access" reads as self-scoped, but
`revokeAccessPostExchange` flips the exchange's single, shared `status` column, which
`getExchangeView` then treats as revoked for **both parties symmetrically** — neither side could any
longer read either party's deposited artifact through the exchange, not just the clicking party's
counterparty view.

## Restoring access

`types/reciprocalExchange.ts`'s own `FORWARD_TRANSITIONS` table has **no forward transition out of
`REVOKED_ACCESS_POST_EXCHANGE`** — its existing comment states this is deliberate: exception states
are terminal for forward progress, and reversal is "an operator-governed act outside this state
machine's own vocabulary," not something the PRD models as a first-class product transition. Rather
than invent one against that documented intent, the fix was performed exactly as that comment
anticipates:

1. `reciprocal_exchanges.status` restored directly to `COMPARISON_OPEN` — its state immediately
   before the mistaken revoke, confirmed from the exchange's own `activity_receipts` history
   (`exchange_comparison_opened` → `exchange_receipt_acknowledged` → the mistaken
   `exchange_access_revoked`).
2. A new receipt type, `exchange_access_restored_operator_correction`, records the correction itself
   — added to `ActivityActionType` and the `activity_receipts_action_type_check` constraint
   (migration `20261001000600_exchange_access_restored_correction_receipt_type.sql`, rebuilt
   wholesale per this repo's own governing rule for that constraint).
3. The original mistaken-revoke receipt is left untouched on record — the correction is additive
   evidence, not a rewrite of history, mirroring how `revokeAccessPostExchange` itself never touches
   `exchange_receipts`/`exchange_attestations`.

## The UI guard

`app/triad/components/codex/tabs/IRLExchangeTab.tsx`'s revoke control now:

- Opens a `ConfirmDialog` (the canonical shared primitive, `components/ui/ConfirmDialog.tsx` — CLAUDE.md
  already names it as a component to reuse, not fork) before calling the action, instead of firing on
  first click.
- States plainly, in the dialog body, that this is a **mutual, one-way** action affecting both
  parties' access to both artifacts, that the historical Exchange Receipt is unaffected, and that
  there is no undo button in the UI (restoring it requires the manual correction path above).
- Is now styled as an actual button (bordered, rose-accented) rather than a bare text link, so the
  control reads as a deliberate destructive action rather than incidental page text.
- Relabeled from "Revoke my future access" (reads as self-scoped) to "Revoke reciprocal access…"
  (states the real, mutual scope; the ellipsis signals a confirmation follows).

Scope note: only the revoke control was touched. "Withdraw before exchange" (the pre-crossing
counterpart) was left as-is — it wasn't the action that was mistakenly triggered, and widening the
fix to a control nobody reported a problem with would be unrequested scope.

## Verified

- `npx tsc --noEmit`: clean for both touched files.
- `tests/reciprocal-exchange.test.ts`, `irl-exchange-focus-contract.test.ts`,
  `activity-receipts-action-type-parity.test.ts`, `ocsga-exchange-actions-route.test.ts`,
  `ocsga-exchange-principal-gate.test.ts` — 86 tests, all passing, no regressions.
- Exchange status confirmed restored to `COMPARISON_OPEN` via direct read-back after the correction.
