# Commit Brief: `e3b0bd0` — AVL → MVL Pass 2: /api/avl/* directory + FE callsites + log tags

| Field | Value |
|-------|-------|
| SHA | [`e3b0bd0`](https://github.com/iQube-Protocol/AigentZBeta/commit/e3b0bd05c56ff71d2fc3fd438de5f57cf99fe0c7) |
| Author | Claude |
| Date | 2026-05-31T19:48:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
AVL → MVL Pass 2: /api/avl/* directory + FE callsites + log tags

Companion to Pass 1 (dc9ec96c). Renames the API route directory and
the FE callsites that hit it so the URL path matches the codebase
naming: AgentiQ Venture Lab → metaMe Venture Lab.

Server (git mv app/api/avl → app/api/mvl):
  app/api/mvl/comms-packs/route.ts
  app/api/mvl/compose/route.ts
  app/api/mvl/customers/route.ts
  app/api/mvl/customers/[personaId]/route.ts
  app/api/mvl/customers/pipeline-candidates/route.ts
  app/api/mvl/partners/route.ts
  app/api/mvl/partners/[id]/route.ts
  app/api/mvl/partners/[id]/stage/route.ts
  app/api/mvl/partners/by-email/route.ts
  app/api/mvl/partners/pipeline/route.ts
  app/api/mvl/send/route.ts
  + their docstring references and console-log tags
    '[avl/customers]' → '[mvl/customers]', etc.

FE callsites:
  app/triad/components/CodexPanelDynamic.tsx — /api/avl/partners/by-email
  app/triad/components/codex/tabs/RelationshipBuilderTab.tsx — 5 fetches
  app/(shell)/marketa/components/MarketaPartnersAdminTab.tsx — 2 fetches
  app/(shell)/marketa/components/MarketaMyCampaignTab.tsx — fetches
  app/(shell)/marketa/components/MarketaCartridge.tsx — fetches

Not touched (intentionally, defer to a future Pass):
  - DB table names `avl_partner_contacts`, `avl_comms_packs`,
    `avl_customers` etc. — renaming these in code without a
    coordinated DB migration breaks every read/write. A follow-up
    will: (1) ALTER TABLE … RENAME TO …; (2) sweep code refs;
    (3) drop the renamed-table aliases. Safer as one atomic pass.
  - Historical migration SQL files (immutable).
  - codexes/packs/alpha-knyt/*-avl-*.md PRDs (history; will be
    replaced by metaMe Venture Lab equivalents if/when the operator
    wants the docs renamed).
```

## Body

Companion to Pass 1 (dc9ec96c). Renames the API route directory and
the FE callsites that hit it so the URL path matches the codebase
naming: AgentiQ Venture Lab → metaMe Venture Lab.

Server (git mv app/api/avl → app/api/mvl):
  app/api/mvl/comms-packs/route.ts
  app/api/mvl/compose/route.ts
  app/api/mvl/customers/route.ts
  app/api/mvl/customers/[personaId]/route.ts
  app/api/mvl/customers/pipeline-candidates/route.ts
  app/api/mvl/partners/route.ts
  app/api/mvl/partners/[id]/route.ts
  app/api/mvl/partners/[id]/stage/route.ts
  app/api/mvl/partners/by-email/route.ts
  app/api/mvl/partners/pipeline/route.ts
  app/api/mvl/send/route.ts
  + their docstring references and console-log tags
    '[avl/customers]' → '[mvl/customers]', etc.

FE callsites:
  app/triad/components/CodexPanelDynamic.tsx — /api/avl/partners/by-email
  app/triad/components/codex/tabs/RelationshipBuilderTab.tsx — 5 fetches
  app/(shell)/marketa/components/MarketaPartnersAdminTab.tsx — 2 fetches
  app/(shell)/marketa/components/MarketaMyCampaignTab.tsx — fetches
  app/(shell)/marketa/components/MarketaCartridge.tsx — fetches

Not touched (intentionally, defer to a future Pass):
  - DB table names `avl_partner_contacts`, `avl_comms_packs`,
    `avl_customers` etc. — renaming these in code without a
    coordinated DB migration breaks every read/write. A follow-up
    will: (1) ALTER TABLE … RENAME TO …; (2) sweep code refs;
    (3) drop the renamed-table aliases. Safer as one atomic pass.
  - Historical migration SQL files (immutable).
  - codexes/packs/alpha-knyt/*-avl-*.md PRDs (history; will be
    replaced by metaMe Venture Lab equivalents if/when the operator
    wants the docs renamed).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/marketa/components/MarketaCartridge.tsx` |
| Modified | `app/(shell)/marketa/components/MarketaMyCampaignTab.tsx` |
| Modified | `app/(shell)/marketa/components/MarketaPartnersAdminTab.tsx` |
| Deleted | `app/api/avl/comms-packs/route.ts` |
| Deleted | `app/api/avl/compose/route.ts` |
| Deleted | `app/api/avl/customers/[personaId]/route.ts` |
| Deleted | `app/api/avl/customers/pipeline-candidates/route.ts` |
| Deleted | `app/api/avl/customers/route.ts` |
| Deleted | `app/api/avl/partners/[id]/route.ts` |
| Deleted | `app/api/avl/partners/[id]/stage/route.ts` |
| Deleted | `app/api/avl/partners/by-email/route.ts` |
| Deleted | `app/api/avl/partners/pipeline/route.ts` |
| Deleted | `app/api/avl/partners/route.ts` |
| Deleted | `app/api/avl/send/route.ts` |
| Added | `app/api/mvl/comms-packs/route.ts` |
| Added | `app/api/mvl/compose/route.ts` |
| Added | `app/api/mvl/customers/[personaId]/route.ts` |
| Added | `app/api/mvl/customers/pipeline-candidates/route.ts` |
| Added | `app/api/mvl/customers/route.ts` |
| Added | `app/api/mvl/partners/[id]/route.ts` |
| Added | `app/api/mvl/partners/[id]/stage/route.ts` |
| Added | `app/api/mvl/partners/by-email/route.ts` |
| Added | `app/api/mvl/partners/pipeline/route.ts` |
| Added | `app/api/mvl/partners/route.ts` |
| Added | `app/api/mvl/send/route.ts` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/tabs/RelationshipBuilderTab.tsx` |

## Stats

 27 files changed, 1240 insertions(+), 1240 deletions(-)
