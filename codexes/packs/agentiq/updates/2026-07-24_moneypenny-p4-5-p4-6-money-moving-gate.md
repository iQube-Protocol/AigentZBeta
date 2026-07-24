# MoneyPenny P4-5/P4-6 — the money-moving gate + real flip

**Status:** BUILT 2026-07-24, per explicit operator authorization of the named pause point
("MoneyPenny P4-5/P4-6 — money-moving gate + real flip (PAUSE POINT)").
**Companion to:** PRD-MPY-001 (MoneyPenny Constitutional Financial Services Agent), CRP-003a
(Constitutional Financial Services Programme), CFS-043 (agent-guided passport & delegation
onboarding — the graded proof-of-humanity invariant).

---

## 0. What was actually missing (reconciliation before build)

P4-1 through P4-4 built MoneyPenny Runtime as a driving agent of the built 12-step constitutional
service pipeline, but hard-clamped `authoritative` mode to Domain 3 (Financial Intelligence) only
— Investment/Market (the money-moving domains) stayed shadow-only by a **code-level clamp**, not
a real constitutional gate. Reading PRD-MPY-001 §7's own stated guardrail — *"Graded
proof-of-humanity for money-moving — captcha-grade for read/write, World ID for money-moving...
Runtime mode requires the money-moving grade"* — against the actual code turned up that **this
grade was never enforced anywhere in the codebase**: `constitutionalAgreement.ts`'s
`authorizeAgreement` (the function that "OPENS the 409 gate") checked only that the requesting
operator owned the agreement — never the `verificationRequirements` token the agreement itself
already carries (`guidedOnboarding.ts`'s `PROOF_REQUIREMENT.world_id` = `'world-id-verified-
authorizer'`). This was true for MoneyPenny AND the generic Financial Services pipeline both —
not a MoneyPenny-specific gap.

A second, more subtle gap: the shared 409 gate (`requireAuthorizedAgreement`) is keyed only on
`(capabilityRef, selectedAgentRef, requestingPersonaId)` — it has **no domain awareness of its
own**. If MoneyPenny's Investment/Market calls had reused her existing Domain-3 `capabilityRef`,
an already-authorized Domain-3 agreement (read-only, harmless) would have silently gated open a
money-moving call too, since the gate just finds "the" authorized agreement for that triple.

## 1. What shipped

**P4-5 — the money-moving grade gate**, in the shared primitive (not MoneyPenny-specific):
- `services/passport/personhoodProof.ts` — new `hasVerifiedWorldIdPassport(personaId)`. Reads the
  **existing, persisted** `world_id_verified_at` column on `polity_passport_records` (the same
  column `/api/polity-passport/verify-worldid` stamps) — no new verification mechanism, no new
  store. Fails closed (missing client / query error / no row → `false`).
- `services/constitutional/constitutionalAgreement.ts` — `authorizeAgreement` now checks the
  agreement's `verificationRequirements`; if it contains `PROOF_REQUIREMENT.world_id`, it refuses
  to move the agreement to `authorized` unless `hasVerifiedWorldIdPassport` returns true. This is
  the **one** place delegated execution can be opened (per the function's own docstring), so it is
  the **one** place the grade is enforced — no parallel check elsewhere.

**P4-6 — the real flip**:
- `app/api/moneypenny/runtime/route.ts` — Domain 3 keeps its original `capabilityRef`
  (`cap-moneypenny-financial-services`, zero regression); Investment/Market now resolve to a
  **second, distinct** `capabilityRef` (`cap-moneypenny-financial-services-settlement`), so the
  two risk tiers are gated by two independent agreements. The route's own domain-based
  `authoritativeAllowed` clamp is removed — `mode` passes straight through, and the pipeline's own
  step-3 409 gate is the real safety boundary (an unauthorized or under-graded call fails closed
  with a clear reason, never a silent shadow downgrade).
- `app/(shell)/moneypenny/components/RuntimePanel.tsx` — Investment/Market domain buttons
  unlocked; a second Form/Accept/Authorize flow for the settlement-tier agreement, carrying real
  `settlementTerms` (rail `qc`, an operator-set amount defaulting to **0** — a zero-value
  settlement intent, the safest possible first real test) + a `valueCeiling` (defaulting to 1000
  Q¢ / $10.00) + `verificationRequirements: [PROOF_REQUIREMENT.world_id]`.
- `services/constitutional/settlementExecutor.ts` — **unchanged**. It already only ever builds a
  deterministic, hash-committed settlement *intent*; it does not sign or broadcast a transfer
  (its own file header: "MONEY IS PARAMOUNT... never an autonomous transfer from the constitutional
  layer"). Actual fund movement remains a separate, operator-supervised wallet step
  (Base-USDC checkout / Q¢-x402 rail) — this increment does not touch that boundary.

## 2. The full safety chain for a real Investment/Market authoritative run

1. Operator forms the settlement-tier agreement (RuntimePanel) — `settlementTerms` +
   `valueCeiling` + `verificationRequirements: [world-id-verified-authorizer]` are bound into the
   agreement object at this step.
2. MoneyPenny (server-side) may `accept` her own side — she can never `authorize`.
3. Operator clicks **Authorize**. `authorizeAgreement` now checks
   `hasVerifiedWorldIdPassport(personaId)` — refuses with a clear reason if the operator has never
   completed World ID verification on their Polity Passport.
4. Runtime call with `mode: 'authoritative'`, `domain: 'investment' | 'market'` — the route resolves
   the settlement-tier `capabilityRef`; the pipeline's step-3 gate looks up **that specific**
   agreement (never the Domain-3 one); step 9 enforces `spendWithinCap` against the declared
   `valueCeiling`, then binds a hash-committed settlement intent via the (unchanged)
   `settlementExecutor`.
5. A `finance_authoritative_execution` DVN-anchorable receipt is written (unchanged from P4-4).

No step in this chain signs, broadcasts, or moves real funds — the settlement intent is the
constitutional binding; the transfer itself remains a separate, human-supervised step, per
CRP-003a §6 and `settlementExecutor.ts`'s own unmodified design.

## 3. Canary coverage

`tests/moneypenny-runtime-authority-boundary.test.ts` (extended): the route still never imports
`authorizeAgreement`/`settlementExecutor` directly; the domain-scoped `capabilityRef` split is
pinned; the old domain-clamp assertion is replaced with a pass-through-mode assertion;
`authorizeAgreement`'s world-id enforcement + fail-closed shape are pinned;
`hasVerifiedWorldIdPassport`'s persisted-column read is pinned; RuntimePanel's settlement-tier
`verificationRequirements` and unlocked domain buttons are pinned. All assertions verified against
the real file content directly (this sandbox has no installed `node_modules`, so `vitest` itself
cannot run here — the same verification discipline used throughout this session's other
increments).

## 4. Honest limits

- The settlement amount/ceiling are operator-typed in RuntimePanel, not independently vetted
  against any external risk model — the enforced ceiling is exactly what the operator declares at
  Form time. This is unchanged from how Domain 3's agreement has always worked (a human-authored
  agreement object), just now carrying real settlement terms.
- `hasVerifiedWorldIdPassport` checks passport records generally (any live, non-revoked, verified
  passport tied to the persona) — it does not scope to "verified specifically for this
  agreement's action." This mirrors CFS-043 §6's own framing (a standing property of the human,
  not a per-transaction re-proof) and is not a new design decision introduced here.
- This increment does not touch `settlementExecutor.ts`, the Base-USDC checkout path, or the
  x402/Q¢ rail — the "supervised wallet step" boundary for actual fund movement is exactly as
  paramount and untouched as it was before this increment.
