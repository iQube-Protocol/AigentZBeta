# Constitutional Capability Brief — MoneyPenny Constitutional Runtime

**Per CFS-049.** Source: PRD-MPY-001 (Agent MoneyPenny: the Constitutional Financial Services Agent), CRP-003a (Constitutional Financial Services Programme), CFS-043 (agent-guided passport & delegation — the World-ID grade invariant). Status: BUILT, live on dev, money-moving gate open per explicit operator authorization. Owner: Aigent Z workstream.

---

## 1. Executive Summary

MoneyPenny's Runtime is her Constitutional Financial Services Agent mode made real: a domain-scoped driving agent over the platform's built constitutional service pipeline, gated by a real Constitutional Agreement, that can now — for the first time, with an explicit operator-authorized pause point cleared — actually bind a real (zero-value, ceilinged) settlement intent for Investment/Market actions, never just Financial Intelligence.

## 2. What Was Built

- **Runtime as a driving agent** (P4-1) — MoneyPenny drives the 12-step constitutional service pipeline in shadow mode across all three domains (Financial Intelligence, Investment, Market).
- **Agreement lifecycle + authority-boundary canary** (P4-2) — the same `constitutionalAgreement.ts` primitive the Financial Services Suite uses, with a canary pinning that MoneyPenny can never self-authorize.
- **First authoritative flip** (P4-3) — Domain 3 (Financial Intelligence, read-only) could run for real, gated by an authorized agreement.
- **Standing + settlement receipt + DVN action type** (P4-4) — authoritative executions accrue Standing and write a DVN-anchorable receipt.
- **The money-moving grade gate** (P4-5) — `authorizeAgreement` now actually enforces the World-ID-verification requirement PRD-MPY-001 always specified but no code previously checked, for MoneyPenny and the generic Suite alike.
- **The real flip for Investment/Market** (P4-6) — a second, independent capability reference (`cap-moneypenny-financial-services-settlement`) so money-moving domains are gated by their own agreement, separate from Domain 3's; a real (operator-typed, zero-value-default) settlement intent is bound once authorized.

## 3. Why It Exists

MoneyPenny was, before this workstream, a pricing specialist with hand-authored responses — not grounded in any invariant library, not driving the constitutional pipeline. PRD-MPY-001 specializes her into the platform's named Financial Services agent: same rails as the generic Suite, but with her own corpus grounding and her own capability references, in three modes (Advisor, Architect, Runtime). This Brief covers Runtime — the mode that actually executes.

## 4. Where To Find It

```
metaMe → Aigent MoneyPenny cartridge → Runtime tab (last of her 10 tabs)
```

(A separate, already-tracked follow-on will align MoneyPenny's own tab bar with the platform's shared two-level group+subtab navigation — Runtime's location inside that flat bar is unaffected by that pending change.)

## 5. How To Use It

1. Open the **Aigent MoneyPenny** cartridge → **Runtime** tab.
2. Pick a domain: **Financial Intelligence**, **Investment**, or **Market**.
3. Click **Run (shadow)** — always available, no agreement required.
4. To run for real: **Form** the agreement for that domain (Investment/Market forms carry real `settlementTerms` + a `valueCeiling`), **Accept** it (MoneyPenny's side), then have the operator **Authorize** it.
   - For **Investment/Market**, Authorize requires a **World-ID-verified Polity Passport** on the authorizing operator — it refuses with a clear reason otherwise.
5. Toggle to **Authoritative** and **Run** — the gated call executes; a settlement intent is bound (never a live transfer) and a DVN-anchorable receipt is written.

## 6. Screens

See the published Artifact version. (No fresh screenshot captured for Runtime specifically this session — the Financial Services Suite screenshot in that Brief shows the identical trace/agreement UI pattern this tab reuses.)

## 7. User Journey

```
Open MoneyPenny → Runtime tab → pick Investment or Market
  → Run (shadow) → see the trace, blocked at the agreement step
    → Form the settlement-tier agreement (terms + ceiling) → Accept
      → Authorize (requires World-ID-verified Passport) → toggle Authoritative → Run
        → settlement intent bound, DVN receipt written
```

## 8. Constitutional Behaviour

- **Domain-scoped agreements**: Financial Intelligence keeps its original capability reference (`cap-moneypenny-financial-services`); Investment/Market resolve to a **second, independent** one (`cap-moneypenny-financial-services-settlement`) — an authorized read-only Domain-3 agreement can never silently gate open a money-moving call.
- **The money-moving grade**: enforced in exactly one place — `authorizeAgreement` — by checking `hasVerifiedWorldIdPassport(personaId)` against the agreement's own `verificationRequirements`. No parallel check exists anywhere else in the codebase.
- **Principal–delegate separation**: MoneyPenny may `form` and `accept`; only the human operator `authorize`s — this is a hard invariant, not a UI convention (canary-pinned).
- **Settlement intent only**: `settlementExecutor.ts` is unchanged by this work — it still only ever builds a deterministic, hash-committed intent. No step in this chain signs, broadcasts, or moves real funds; the actual transfer remains a separate, human-supervised wallet step (Base-USDC checkout / Q¢-x402 rail).
- **Standing + receipts**: authoritative runs accrue Standing and write a `finance_authoritative_execution` DVN-anchorable receipt.

## 9. Technical Summary

- `app/api/moneypenny/runtime/route.ts` — the driving route; resolves the domain to the correct capability reference and passes `mode` straight through (no code-level domain clamp remains — the pipeline's own step-3 gate is the real safety boundary).
- `app/(shell)/moneypenny/components/RuntimePanel.tsx` — the UI; domain buttons, the Form/Accept/Authorize flow, settlement-terms + valueCeiling inputs for Investment/Market.
- `services/passport/personhoodProof.ts` — `hasVerifiedWorldIdPassport(personaId)`, reading the existing `world_id_verified_at` column on `polity_passport_records` (no new verification mechanism).
- `services/constitutional/constitutionalAgreement.ts` — `authorizeAgreement`'s new `verificationRequirements` check.
- `services/constitutional/settlementExecutor.ts` — unchanged; settlement-intent construction only.
- Canary: `tests/moneypenny-runtime-authority-boundary.test.ts`.

## 10. Dependencies

The generic Financial Services Capability Suite's underlying pipeline (N1/N2), a Polity Passport with World-ID verification completed (for Investment/Market authorization), the Identity & Access Spine.

## 11. New Registry Objects

No new Qube type. A second `capabilityRef` value (`cap-moneypenny-financial-services-settlement`) now exists alongside the original Domain-3 one; `finance_authoritative_execution` DVN receipt rows.

## 12. Related Capabilities

Financial Services Capability Suite (the generic pipeline MoneyPenny drives); the Identity & Access Spine; Polity Passport (World-ID verification).

## 13. Permissions

Not Observer-capability-gated. Investment/Market authorization requires a World-ID-verified Polity Passport on the authorizing persona — this is a standing property of the human (verified once, not re-proved per transaction), per CFS-043 §6's own framing.

## 14. Example Use Cases

- **Founder/Operator**: preview a treasury-settlement question in shadow mode before committing to any real agreement.
- **Operator with a verified Passport**: authorize a bounded, ceilinged settlement-tier agreement and run a real (zero-value, safest-first) Investment domain test.

## 15. Limitations

- The settlement amount/ceiling are operator-typed at Form time in RuntimePanel, not independently vetted against any external risk model — this is unchanged from how Domain 3's agreement has always worked.
- `hasVerifiedWorldIdPassport` checks general passport verification (any live, verified passport), not "verified specifically for this agreement's action" — a standing property, not a per-transaction re-proof, by design.
- This capability does not touch `settlementExecutor.ts`'s boundary, the Base-USDC checkout path, or the x402/Q¢ rail — real fund movement remains a wholly separate, human-supervised step.
- MoneyPenny's own tab bar (the flat 10-tab strip her cartridge currently renders) has not yet been migrated to the platform's shared two-level navigation template — a tracked, separate follow-on.

## 16. Future Roadmap

Align MoneyPenny's cartridge navigation with the shared group+subtab template used elsewhere on the platform; broader Investment/Market executor maturity beyond the current LLM-analysis + settlement-intent binding; eventual wiring to a real, human-supervised transfer step once the operator is ready to cross that boundary.

## 17. Registry Metadata

- Capability ID: `moneypenny-runtime`
- Source: PRD-MPY-001, CRP-003a (P3-1..4, P4-1..6)
- Version: live on `dev`
- Date: 2026-07-24
- Owner: Aigent Z workstream
- Ratification: RATIFIED 2026-07-21 (PRD-MPY-001); P4-5/P4-6 built 2026-07-24 per explicit operator authorization of the named pause point
- Deployment: DEPLOYED (dev)

## 18. Completion Receipt

```
Capability: MoneyPenny Constitutional Runtime
[x] Ratified
[x] Implemented
[x] Validated       (canary suite pinned against real file content; operator-authorized pause point cleared)
[x] Deployed
[x] Documented       (this Brief)
[ ] Registered       (Registry entry linking to this Brief — pending)
```

## 19. Capability Tour

1. Open the **Aigent MoneyPenny** cartridge → **Runtime** tab.
2. Pick **Financial Intelligence** and click **Run (shadow)** — see the read-only trace complete without any gate.
3. Pick **Investment** and click **Run (shadow)** — same trace, still no gate needed for shadow mode.
4. Click **Form** — notice the settlement terms and a spend ceiling are part of the agreement now, not just a capability name.
5. **Accept** (MoneyPenny's side), then **Authorize** (yours) — if your Passport isn't World-ID verified yet, you'll see exactly why it refuses.
6. Toggle **Authoritative** and **Run** — the call executes for real, within your declared ceiling, and a receipt is written.
7. Compare: Financial Intelligence's agreement and Investment's agreement are entirely separate — authorizing one never opens the other.
