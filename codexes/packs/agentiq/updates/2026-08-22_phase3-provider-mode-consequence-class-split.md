# Phase 3 — providerMode / serviceClass Split (Operator Ruling)

**Date:** 2026-08-22
**Supersedes:** the `FinancialServiceClass = 'advisor' | 'architect' | 'runtime'` design described in
`2026-08-22_phase3-moneypenny-financial-services-runtime.md`. That doc's architecture (catalog,
eligibility, orchestrator, discovery, receipts, Standing) is unchanged — only the naming/typing of
one field is corrected here.

## The problem this fixes

While scoping Track A ("operator-facing MoneyPenny service experience"), research surfaced a
pre-existing, already-live **PRD-MPY-001** MoneyPenny system with its own canonical **Architect
mode** (`services/constitutional/moneyPennyArchitect.ts::draftFinancialStructure`, exposed at
`/api/moneypenny/architect`) and **Runtime mode**
(`services/constitutional/constitutionalServicePipeline.ts::runConstitutionalServicePattern`,
exposed at `/api/moneypenny/runtime`) — separate UI panels (`ArchitectPanel.tsx`,
`RuntimePanel.tsx`), separate ontology (`constitutionalAgreement.ts`'s agreement/authorization/
settlement flow), already wired into codex tabs.

Stage 3.1's `FinancialServiceClass` used the exact same three names (`advisor`/`architect`/
`runtime`) for a DIFFERENT concept — a generic execution-mode selector over the VELA-001
`constitutionalCommerce` ontology. Left uncorrected, Track A's UI would have shipped a second
"MoneyPenny Architect" and a second "MoneyPenny Runtime" under the same names but a different
mechanism — exactly the class of defect CLAUDE.md's Core Principle ("a parallel implementation of
an existing capability is a defect") and Source-of-Truth Parity section exist to catch.

## The ruling

PRD-MPY-001's Advisor/Architect/Runtime names are canonical and belong to MoneyPenny as a
**provider**. Phase 3's contribution is a *generic, provider-neutral* consequence taxonomy that
happens to map onto MoneyPenny's three modes today, one-to-one, but does not require any future
provider to adopt MoneyPenny's mode vocabulary.

```
providerMode   (provider-specific — "how this provider performs the service")
  MoneyPenny's canonical modes: ADVISOR | ARCHITECT | RUNTIME

serviceClass   (generic, provider-neutral — "what constitutional consequence this service can create")
  INFORMATIONAL | PROPOSAL | CONSEQUENTIAL

Mapping (services/financialServices, NOT PRD-MPY-001's own modules — see below):
  ADVISOR   -> INFORMATIONAL
  ARCHITECT -> PROPOSAL
  RUNTIME   -> CONSEQUENTIAL
```

The mapping is expressed exactly once —
`MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS` in `types/financialServices.ts` — and every catalog
entry (`services/financialServices/serviceCatalog.ts`) derives its `serviceClass` from it rather
than authoring the two fields independently, so they cannot drift apart.

## What changed

| File | Change |
|---|---|
| `types/financialServices.ts` | `FinancialServiceClass` renamed `FinancialServiceConsequenceClass` (`INFORMATIONAL`\|`PROPOSAL`\|`CONSEQUENTIAL`); `SERVICE_CLASS_EXECUTION_MODE`/`SERVICE_CLASS_EXECUTION_REACHABLE` reindexed to it. New `MoneyPennyProviderMode` type and `MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS` mapping. `FinancialServiceDefinition`/`FinancialServiceOutcome` gain a `providerMode: string` field (deliberately untyped to any specific provider's vocabulary in the shared contract). |
| `services/financialServices/serviceCatalog.ts` | Each definition now sets `providerMode: 'ADVISOR'\|'ARCHITECT'\|'RUNTIME'` and derives `serviceClass` from the mapping table. |
| `services/financialServices/serviceRequestOrchestrator.ts` | Threads `providerMode` through every `FinancialServiceOutcome` (including refusals — `null` only for the unknown-serviceId case, where no definition exists to read it from). |
| `tests/financial-services-runtime.test.ts` | Updated all `serviceClass`/`providerMode` assertions; added a canary proving both fields are derived from the single mapping table, never authored independently. |

**No route, UI, or other module referenced the old `FinancialServiceClass` values before this
change** (confirmed by repo-wide grep before refactoring) — this was caught before any external
surface could depend on the collision, which is why it is a rename/re-typing rather than a
migration.

## What this does NOT change

- PRD-MPY-001's Architect/Runtime routes, panels, and `constitutionalAgreement.ts` ontology are
  untouched. They remain canonical for MoneyPenny's existing Architect/Runtime UI experience.
- Stage 3.1/3.2's frozen behavior (eligibility, Gate 2 mapping, the attestation hard dependency,
  genericity, Marketa boundary) is unchanged — only the field names/types describing it.
- Track A's operator-facing surface (in progress) is an **oversight console**: the human principal
  observes/triggers/authorises their admitted, delegated agents (MoneyPenny/Nakamoto/Kn0w1)
  consuming Financial Services — never a first-person human `requestingAgentId`. This was an
  explicit operator ruling in the same turn: `services/financialServices/eligibility.ts`'s
  admission check (`resolveRegistrableAgentByRuntimeId`) is correct as-is and is NOT to be loosened
  to accept human persona IDs.
