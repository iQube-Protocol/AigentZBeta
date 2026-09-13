# Threshold 007 — Mandatory Lineage Anchors: Aegis, TII, Golden Cycle, Horizen

**Date:** 2026-09-12
**File:** `docs/qriptopian/thresholds/007-research-edition.md`, `docs/qriptopian/thresholds/007-editions-manifest.json`

## What happened

Following the Aletheon-draft citation-hardening pass (`2026-09-12_threshold-007-aletheon-draft-citation-hardening.md`), the operator flagged that four bodies of evidence — Aegis, TII/Trusted
Intelligence, the Golden Cycle, and the Horizen/Horizon pilot — were only implicitly covered by the
general "carry forward all valid evidence from 007.1" instruction, and asked for them to be made
explicit, mandatory, visibly-enumerated citations rather than an assumption the Evidence Agent could
miss.

The research edition now states an explicit **"Mandatory lineage preservation"** clause in the
Aletheon Handoff section, plus the two ancestral-lineage relationships the operator specified:

```
Golden Cycle → PoTS/RoR → Horizen Consequential Environment
Aegis → TII → Trusted Intelligence → Trusted Superintelligence
```

## New anchors resolved in this pass

| ID | Component | Resolution | Status |
|---|---|---|---|
| II007-IA26 | Horizen/MoneyPenny journey | `services/journey/horizenMoneyPennyJourney.ts`, `services/journey/horizenMoneyPennyJourneyAdapted.ts` | Implementation |
| II007-IA27 | Horizen Constitutional Admission Pilot doctrine | `codexes/packs/irl/foundation/CFS-055_proof-of-state-in-time-and-state-coherence.md` (ratified 2026-08-10; states "The Horizen pilot is the first reference implementation, not the boundary of the doctrine") | Doctrine (Ratified) |
| II007-IA28 | TII — Trusted Intelligence Index | `codexes/packs/agentiq/items/FACTOR_AEGIS_MONEYPENNY_PRD_0.1.md` — named as a goal the Factor+Aegis assessment framework "can later support"; no standalone TII module exists | Doctrine (Planned, not implemented) |
| II007-IA29 | Trusted Intelligence lineage (Threshold 005) | Same citation as 007.1's [T005] (content ID `c25eb589-65f3-46af-b840-af544e8bf8ae`, slug `trusted-intelligence`), reaffirmed as a named mandatory anchor rather than left only in the References section | Research Evidence (prior canonical publication) |

Aegis itself was already resolved in the prior pass (II007-IA11, Factor Aegis operational
implementation) — this pass adds the surrounding TII/Trusted-Intelligence lineage the operator asked
to be made explicit, and re-confirms (searching again) that the standalone "Aegis 0.0 Constitutional
Admission and Calibration Doctrine" document still does not exist in this repository, distinct from
the real Factor Aegis code.

## What remains genuinely unresolved (searched again in this pass, not found)

- A standalone **"Golden Cycle Research Thesis v0.1"** document. The operational programme label
  ("Golden Cycle" = P1→P2→P3→P4) is resolved via `docs/vela/accelerator/constitutional-financial-services/README.md` and PoTS is resolved via `services/venture/ventureOutcomeAccrual.ts` (both
  already II007-IA19), but the original standalone thesis document itself — which
  `01_CONSTITUTIONAL_YIELD_AND_RISK_THESIS_v0.2.md` calls itself "a v0.3 extension" of — was not
  found in this repository.
- **AEGIS-0.0** (the standalone doctrine document, as opposed to the real Factor Aegis code).

Both are carried forward unresolved, unchanged from 007.1, and are explicitly disambiguated in the
file's new note so a future reader does not conflate the resolved operational label with the still-
missing standalone document.

## Not yet done

- The Supabase `content` row (the one the live app and Threshold MCP actually serve) has not been
  re-synced with this addendum — the last sync predates these lineage-anchor additions. The write was
  denied earlier in this session; needs explicit go-ahead to retry.
- Independent Adversarial Research Review remains unperformed.
