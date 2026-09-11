# Commit Brief: `5f20157` — Re-home Ingest surface under Activate; remove Ingest consequence-fork prong

| Field | Value |
|-------|-------|
| SHA | [`5f20157`](https://github.com/iQube-Protocol/AigentZBeta/commit/5f201570c46b6f84f9e92a4fa45924b469abb28b) |
| Author | Claude |
| Date | 2026-08-11T01:43:35Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Re-home Ingest surface under Activate; remove Ingest consequence-fork prong

Activate Consolidation: the constitutional Activate stage (shipped previously)
and the legacy Ingest/deploy stage were left as two rendered concepts on the
same journey. Collapses them into one: the Ingest UI (Factory action +
registry catalogue) moves onto Activate verbatim, the visible Ingest fork
prong is removed (fork is Ratify + Stand only), and the old "Ingest into
Factory" action no longer requires Operate/aigentMe/Delegate — Factory
ingestion is technical-process tooling, never a second constitutional consent
ceremony after Passport. `deploy` survives internally only for
standing.prerequisites and historical capability_registered evidence; it
renders no stepper or fork node. Renames the registry catalogue's "Ingested
Assets" tab to "iQube Registry" across every consumer. Adds the missing
agent_registry_activated CHECK-constraint migration (drift-incident guard).
```

## Body

Activate Consolidation: the constitutional Activate stage (shipped previously)
and the legacy Ingest/deploy stage were left as two rendered concepts on the
same journey. Collapses them into one: the Ingest UI (Factory action +
registry catalogue) moves onto Activate verbatim, the visible Ingest fork
prong is removed (fork is Ratify + Stand only), and the old "Ingest into
Factory" action no longer requires Operate/aigentMe/Delegate — Factory
ingestion is technical-process tooling, never a second constitutional consent
ceremony after Passport. `deploy` survives internally only for
standing.prerequisites and historical capability_registered evidence; it
renders no stepper or fork node. Renames the registry catalogue's "Ingested
Assets" tab to "iQube Registry" across every consumer. Adds the missing
agent_registry_activated CHECK-constraint migration (drift-incident guard).

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/moneypenny-horizen/ingest/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `components/journey/IngestIntoFactoryPanel.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/registry/IngestionFactoryPanel.tsx` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Added | `supabase/migrations/20260930002600_agent_registry_activated_receipt_type.sql` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Modified | `tests/journey-ingest-route.test.ts` |
| Modified | `tests/journey-orient-stage.test.ts` |
| Modified | `tests/journey-single-copilot.test.ts` |
| Modified | `tests/participation-standing-ingestion-tab.test.ts` |

## Stats

 14 files changed, 423 insertions(+), 124 deletions(-)
