# 2026-07-21 — MoneyPenny D5 + D6 foundation (finance namespace + QriptoCENT sub-corpus scaffold)

**Workstream:** PRD-MPY-001 (Agent MoneyPenny — the Constitutional Financial Services Agent), ratified 2026-07-21.
**Scope:** the RATIFIED, unblocked foundational pieces only — D5 (`finance` namespace + composition law) and D6 (QriptoCENT sub-corpus scaffold). No derivation run, no corpus content, no `inv.finance.*` invariants, no MoneyPenny runtime/money-moving wiring — those are later phases gated on operator-provided sources (D2).

## D5 — the `finance` invariant namespace + composition law

Widened `InvariantNamespace` to include `finance`, mirroring the `polity` widening precedent exactly (2026-07-17). Three coordinated edits in `types/invariants.ts` plus a SQL migration:

1. **Type union** (`InvariantNamespace`) — added `| 'finance'` with a doc comment explaining it is the class of the FS Invariant Library derived from the QriptoCENT Corpus by the Invariant Discovery Engine (CFS-048), widened ahead of the derivation run per CFS-013 §3.
2. **`INVARIANT_NAMESPACES` array** — appended `'finance'` (now 14 entries).
3. **`COMPOSITION_LAWS` record** — declared `finance: 'normative'` with a real, authored rationale (NOT a stub). Financial-services invariants (spend caps, custody/settlement guarantees, principal–delegate separation, delegation-envelope bounds, consequence ordering, the x409 authorization gate) do not distribute and carry no fixed order — they bind **every** financial act simultaneously, law-like. Same "no-partial-compliance" algebra family as `engineering`, `sovereignty`, and `epistemology`. A settlement satisfying four of five finance invariants is not four-fifths lawful; it is unlawful.
4. **SQL migration** `supabase/migrations/20260721000000_finance_invariant_namespace.sql` — additively widens the three namespace CHECK constraints (`invariants`, `ontology_classes`, `invariant_collections`) to admit `finance`, exactly following the polity migration (`20260720000000`).

**Canary extended:** `tests/invariant-substrate.test.ts` — the namespace canary asserted `toHaveLength(7)`, which was already **stale** (the array had grown to 13 via the 2026-07-13 five-namespace widening and the 2026-07-17 polity widening without the test being updated). Corrected it to `toHaveLength(14)` and added `toContain('polity')` + `toContain('finance')` so the true set is pinned. Flagged separately below as a pre-existing drift this change also fixes.

`INVARIANT_NAMESPACES` is consumed dynamically elsewhere (`services/research/invariantFieldQuery.ts` `.includes`/`.join`; API validators), so the widening required no other code changes.

## D6 — the QriptoCENT sub-corpus scaffold

Created `codexes/packs/irl/foundation/qriptocent/` as a **sub-corpus** under the existing FS foundation (NOT a standalone `codexes/packs/qriptocent/` pack), per D6. In the Discovery-Engine scope ladder it is the `finance/qriptocent` sub-domain under the `finance` domain.

Tree:

```
codexes/packs/irl/foundation/qriptocent/
  collections.json                 # self-contained col_qriptocent_corpus registration
  protocol/README.md               # → finance/qriptocent/protocol
  commerce/README.md               # → finance/qriptocent/commerce
  payments/README.md               # → finance/qriptocent/payments
  financial-services/README.md     # → finance/qriptocent/financial-services
  economic-governance/README.md    # → finance/qriptocent/economic-governance (refs inv.polity.160/161/162)
  runtime/README.md                # → finance/qriptocent/runtime
```

Each `README.md` names its corpus area, states its Discovery-Engine sub-domain mapping, and **explicitly marks source content as "operator-to-provide via the Invariant Discovery Engine (D2) — not yet ingested; no source invented in the interim."** No fabricated QriptoCENT protocol content, doctrine, or invariants were written — these are structure-only placeholders. `economic-governance/` **references** the already-seeded `inv.polity.160` (Proof of Work Potential) / `inv.polity.161` (Proof of Time Saved) / `inv.polity.162` (verification-accrual gate) rather than redefining PoWP/PoTS (D1).

**Registration:** the IRL pack is skip-listed in `packRegistry.ts` (hand-curated `IRL_CARTRIDGE` consumes `codexes/packs/irl/collections.json` via `AgentiqCartridgeTab`), so the sub-corpus is surfaced by adding a `col_qriptocent_corpus` collection to the parent `codexes/packs/irl/collections.json` (items point at `foundation/qriptocent/*/README.md`). A self-contained `qriptocent/collections.json` documents the sub-corpus as its own registration artifact.

## Spelling discipline

Canonical **QriptoCENT** (capital Q, capital CENT) everywhere. QriptoCENT (the protocol/micro-stablecoin) ≠ Q¢ (the $1 = 100 Q¢ cent-unit pricing surface). `protocol-economics.md` remains the single binding QriptoCENT↔Q¢ definition (D3); this scaffold mints no competing definition.

## Flagged for the operator

- **Pre-existing canary drift (now fixed):** `tests/invariant-substrate.test.ts` asserted 7 namespaces while the array already held 13 before this change — the test was not updated during the 2026-07-13 and 2026-07-17 widenings. This change corrects it to 14. Worth a glance to confirm the true set is intended.
- **D2 corpus sources remain operator-inbound:** every QriptoCENT source area is a placeholder pending operator ingestion via the Discovery Engine. Phases 1–2 (corpus authoring + derivation run) cannot proceed until real sources land.

## What was NOT touched

No `services/threshold/*`, `app/api/threshold/*`, `app/threshold/*`, `app/.well-known/oauth*`, or `tests/threshold*` (parallel workstream). No discovery-engine run, no `inv.finance.*` authoring, no MoneyPenny runtime/specialistRouter money-path wiring.
