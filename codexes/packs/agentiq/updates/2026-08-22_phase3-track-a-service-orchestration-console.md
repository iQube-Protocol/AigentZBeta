# Phase 3, Track A — Financial Service Orchestration Console

**Date:** 2026-08-22
**Status:** Code-complete, zero new `tsc` errors, existing regression suite unaffected. **UI not
verified in a browser** — this sandbox has no live Supabase credentials and no way to authenticate
a persona session, so the panel could not be exercised end-to-end against a running dev server.
Say so explicitly per this repo's UI-verification discipline rather than claiming a visual check
that didn't happen.

## What this is

The operator-facing "oversight console" ruled on in the same turn as the Stage 3.1/3.2 freeze: the
human principal observes/triggers/authorises an admitted, delegated agent's (MoneyPenny/Nakamoto/
Kn0w1) consumption of a MoneyPenny Financial Service. **The human is never the
`requestingAgentId`** — this is enforced structurally, not just by UI convention: the new route
always sets `requestingAgentId` to the agent selected in the console, never to the caller's own
persona id.

## Files

| File | Role |
|---|---|
| `app/api/moneypenny/service-orchestration/route.ts` | GET (catalog + registrable agents; or, with `?agentId=`, real per-agent discovery/eligibility) and POST (triggers `requestFinancialService()` unchanged for the named agent). Spine-authenticated via `getActivePersona`, mirroring `/api/moneypenny/architect`'s existing gate. |
| `app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx` | The console UI — agent picker, per-service eligibility/status badges, a Trigger button, and outcome/receipt-ref display. Slate house style (no white hairlines). Links out to the existing `?panel=architect`/`?panel=runtime` PRD-MPY-001 panels per providerMode rather than re-implementing them. |
| `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` | New `"service-orchestration"` panel key added to the existing dispatcher — no new dispatch mechanism. |
| `data/codex-configs.ts` | New `moneypenny-service-orchestration` tab entry (`slug: 'service-orchestration'`, `group: 'service'`, `order: 3`) alongside the existing Architect/Runtime tabs. |

## Naming, deliberately not "Financial Services"

The operator's own phrasing was "provisionally 'Financial Services' or 'Service Orchestration.'"
**"Financial Services" was already taken** — `FinancialServicesTab.tsx` is the existing PRD-driven
"Financial Services Capability Suite" for the OLD `constitutionalServicePipeline`/
`constitutionalAgreement.ts` ontology (Domain 3, 12-step trace, agreement gate). Reusing that name
for this Phase 3 console would have recreated the exact naming collision the same turn's
providerMode/serviceClass split was written to fix. The tab label is **"Orchestration"** and the
panel title is **"Financial Service Orchestration"** — distinct from, and coexisting with,
`FinancialServicesTab.tsx`.

## Known, documented gap: Standing persona resolution

`services/horizen/registrableAgents.ts`'s `RegistrableAgentConfig` carries no agent-to-CRM-persona
mapping. The route accepts an optional `standingPersonaId` in the POST body but does not derive one
from `agentId` — for Runtime (`minimumStandingScore: 25`), eligibility honestly reports
`STANDING_PERSONA_UNRESOLVED` rather than fabricating a mapping. This is a real, named gap, not
silently worked around; closing it (adding a `crmPersonaId` field to `RegistrableAgentConfig`, or a
resolver) is future work, out of scope for this ruling's "no new primitives absent a proven gap"
constraint — it would need to be raised as its own candidate refinement.

## What was NOT built

- No change to PRD-MPY-001's `ArchitectPanel.tsx`/`RuntimePanel.tsx` or their routes/ontology.
- No new authority/projection/authorisation/execution/orchestration primitive — the route is glue
  over `services/financialServices/`, calling `requestFinancialService()` and
  `discoverFinancialServicesForConsumer()` unchanged.
- No confidential-evidence sourcing (Vela) at this console layer — `confidentialEvidence: null` is
  passed deliberately; for Runtime this composes `UNRESOLVED` under `REQUIRED` confidentiality,
  which is the correct, visible, fail-closed result this console exists to surface, not a
  placeholder to fill in later at this layer (Stage 3.3 is where real confidential evidence enters).
