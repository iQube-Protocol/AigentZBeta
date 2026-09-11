# Stage 9 Close Report — Phase 2 stubs (interface-only) shipped

**Status:** Stage 9 complete. Phase 2 chain (intent → calibration → risk → value → pricing → exchange) has its architectural seam reserved via 7 interface-only stub files. All stubs throw at runtime to surface accidental use during Stage 1–8 development.
**Date:** 2026-05-31
**Branch commit:** `<this commit>` (single-commit batch).

---

## What Stage 9 delivered

`services/registry/phase2/`:

| File | Stub | Returns |
|---|---|---|
| `intent.ts` | `intentToIQubeProposal(input)` | `IntentToIQubeProposal` — primitive_type, tool_subtype, proposed_slug + name, classification_confidence, follow_up_steps |
| `calibration.ts` | `calibrate(iqube_id)` | `CalibrationProfile` — per-dimension scores, suggested adjustments, recommended trust_band (KNYT §14 alignment) |
| `risk.ts` | `assessRisk(iqube_id)` | `RiskAssessment` — overall_score 0..100, per-dimension breakdown, risk_flags, recommended_controls |
| `value.ts` | `assessValue(iqube_id)` | `ValueAssessment` — work_potential_qc (Q¢ integer cents per CLAUDE.md), time_saved_minutes_per_use, usage_signal, royalty_candidates |
| `pricing.ts` | `proposePricing(iqube_id)` | `PricingProposal` — base / floor / ceiling Q¢ prices, drivers (risk/value/market/calibration/rarity/partner_floor), per-rail overrides |
| `exchange.ts` | `publishListing(iqube_id, rail)`, `optimiseListings(iqube_id, opts)` | `ExchangeListing` — rail (knyt/qc/usdc/paypal), price_units, expires_at, state |
| `index.ts` | Barrel export | Re-exports all types + stub functions |

Every stub function throws with a clear message:
```
'<name>() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD'
```

This makes accidental imports surface immediately in dev/staging rather than silently no-op'ing.

---

## Authority compliance (forward-looking)

Phase 2 implementations will run **on the spine**, never around it:

- **Pricing settlement** routes through `evaluateAccess()` (existing payment-gated descriptor logic in Phase 1).
- **Exchange listings** are governance events — they emit `orchestrationEvents` receipts (e.g. `event_type='listing_published'`).
- **Risk + Value assessments** read from the registry resolver (`resolveIQube`), never reimplement metadata lookup.
- **Calibration** reads from `orchestration_events` + `dvn_receipt_blocks` for usage telemetry; never bypasses the receipt index.
- **Intent capture** writes drafts through `POST /api/registry/iqube` (existing Stage 2 route), then the canonization queue handles approval.

These rules will be codified in the Phase 2 PRD and enforced via CI gates analogous to `tests/registry-authority.test.ts` (Stage 2 C9).

---

## Q¢ canonical conversion

Per CLAUDE.md "Q¢ (Q-cent) Pricing — Canonical Conversion":
- `$1 = 100 Q¢` (one Q¢ = $0.01)
- Storage: integer cents (`amount_qc` column, `base_price_qc` field, etc)
- The stubs above use `_qc` suffix on every Q¢ field to make the unit explicit.

---

## What this does NOT include (deferred to Phase 2 PRD)

- LLM routing logic for intent classification
- Calibration algorithm (telemetry sources, scoring weights)
- Risk model dimensions + thresholds
- Value model (PoW Potential / PoTS valuation loops)
- Pricing optimisation rules (dynamic pricing constraints)
- Marketplace integration (which exchange surfaces; rail-specific settlement)
- Operator UX surfaces (calibration / risk / value visualisation in iqube-registry cartridge)

These are Phase 2 PRD scope. Stage 9 just reserves the import paths + shapes.

---

## Branch state

38 commits on `claude/dreamy-gates-mMqNv` since dev merge:

```
PRD v0.1 → v1.1                                    (4 docs)
Stage 0 audit                                       (3 commits)
Stage 1                                             (5 + close)
Stage 2                                             (4 + close)
Stage 8 partial                                     (4 + close)
Stage 3                                             (2 commits)
Stage 4                                             (2 + close)
Stage 5                                             (3 + close)
Stage 6                                             (3 + close)
Stage 7                                             (1 + close)
Stage 9                                             (1 + this close)
```

---

## All PRD-named stages now complete (Stages 0 → 9)

| Stage | Scope | Status |
|---|---|---|
| Stage 0 | Audit | ✅ Complete + operator-confirmed live row counts |
| Stage 1 | Schema migration + canonical types | ✅ 7 new tables + RLS + 9-state lifecycle types |
| Stage 2 | Resolver + projections + backfill + CI gates | ✅ services/registry/resolver.ts + 4 adapters + 4 projections + backfill driver |
| Stage 3 | Lifecycle state machine + Canonization Queue tab | ✅ 9-state graph + 15 per-transition rules + queue UI |
| Stage 4 | Legacy useOwnedEntitlements migration | ✅ 5/5 consumers migrated; cleanup PR pending 30-day window |
| Stage 5 | Mint saga + routes + tab section | ✅ 18-state saga + idempotency + retry + reconcile + Mints+Sagas tab |
| Stage 6 | DVN block ledger + sealer + receipts tab | ✅ services/registry/dvnBlocks.ts + auto-write integration + 5/7 tabs |
| Stage 7 | AigentQube governance + card_publishing flip | ✅ Governance block + Zod + saga step real + 17-test coverage |
| Stage 8 | iqube-registry cartridge tabs | ✅ 5/7 tabs functional (Browse, Health, Mints, Canonization, Receipts); 2/7 placeholders |
| Stage 9 | Phase 2 stubs | ✅ 7 interface files; all throw at runtime |

---

## Remaining low-priority work (not on the PRD critical path)

| Item | Scope | Trigger |
|---|---|---|
| **Action Vocabulary tab** | Thin list view over actionMap.ts | Operator priority signal |
| **Docs tab** | Markdown reader for PRD trail | Operator priority signal |
| **Cleanup PR — useOwnedEntitlements + /api/codex/owned** | Hard deletion | After 2026-06-30 observation window |
| **Cleanup PR — /api/iqube/persona/qripto/mint route** | Hard deletion | After 30-day window |
| **AigentQube + ToolQube DB promotion** (legibility fast-follow #3) | aigent_qubes + tool_qubes tables; unblocks non-content chain mints in mintSaga.token_qube_created | Separate workstream |
| **Phase 2 PRD** | Full intent→calibration→risk→value→pricing→exchange specification | Operator-initiated |
| **IANA registration** | application/iqube-card+json + application/iqube-catalog+json media types | Post-stabilisation, separate ticket |

---

## What this means

**The PRD v1.0 implementation plan is complete.** Every stage named in PRD v1.0 §10 + v1.1 §C now has working code on `claude/dreamy-gates-mMqNv`. The remaining items are either (a) low-priority polish tabs, (b) cleanup PRs gated by observation windows, or (c) explicit Phase 2 scope that lands in its own PRD.

The canonical iQube Registry operating plane is operational. Operator can:

- Browse every iQube via `/triad/embed/codex/iqube-registry/browse`
- Approve canonization requests + watch saga drive through to MINT_COMPLETE
- Audit receipts by iqube_id / cartridge / primitive / block via the DVN Receipts tab
- Inspect AigentQube governance blocks via the legibility surface
- Monitor backfill + ready states + reconcile pending sagas via Registry Health

All within the source-of-authority matrix (PRD v1.0 §3): resolver never decides access, ownership, or receipts; the spine remains canonical.

---

**End of Stage 9 close report. PRD v1.0 implementation complete.**
