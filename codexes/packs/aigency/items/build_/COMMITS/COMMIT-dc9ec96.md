# Commit Brief: `dc9ec96` — AVL → MVL rename (Pass 1): types, UI labels, NBE catalog, Venture iQube v0.3

| Field | Value |
|-------|-------|
| SHA | [`dc9ec96`](https://github.com/iQube-Protocol/AigentZBeta/commit/dc9ec96c1365c22024ee456c08dbecb24aa3d5b6) |
| Author | Claude |
| Date | 2026-05-31T19:24:18Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
AVL → MVL rename (Pass 1): types, UI labels, NBE catalog, Venture iQube v0.3

AgentiQ Venture Lab is now metaMe Venture Lab; rename avl/AVL across
the live code surface to mvl/MVL. Pass 1 = type union + UI strings +
NBE catalog + Venture iQube schema bump. Pass 2 (deferred) will rename
the /api/avl/* route paths and the FE callsites that hit them.

Type union
  services/iqube/experienceQube.ts:
    ActiveCartridgeSlug 'avl' → 'mvl'
    VALID_CARTRIDGES set updated to match

UI labels (15 files)
  components/metame/cards/{NextBestActionCard,ExperienceModelCard,
    ActivityReceiptCard,VentureProgressCard,ExpandedNBEPill,
    ApprovalCard}.tsx — cartridge-label maps 'avl:' key → 'mvl:'
    value 'AgentiQ Venture Lab' → 'metaMe Venture Lab'
  components/metame/setup/ExperienceModelSetupWizard.tsx — same
  components/metame/workbench/WorkbenchLedger.tsx — same
  services/orchestration/{nbeCatalog,ventureProgressBuilder,
    strategyInference,briefBuilder}.ts — slug literals + nbe ids
    'avl.generate-progress-report' → 'mvl.generate-progress-report',
    'avl.schedule-review-block' → 'mvl.schedule-review-block'
  services/activations/spineActivations.ts — slug
  app/triad/components/codex/tabs/{AigentMeWelcomeTab,
    _ventureLabData,IQubeRegistryMintsTab}.tsx — labels + slugs
  app/(shell)/marketa/components/{MarketaPartnersAdminTab,
    MarketaCartridge}.tsx — labels
  app/api/crm/webhooks/mailjet/route.ts — label
  app/api/marketa/campaigns/route.ts — label
  app/api/assistant/{bootstrap,brief,move-forward,venture-progress}/
    route.ts — slug
  app/data/personas.ts — label
  data/codex-configs.ts — label
  data/activation-catalog.ts — slug

Venture iQube schema v0.3
  codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md
    — new spec doc: cartridgeSlug enum drops 'avl' and adds 'mvl'.
    All other v0.2 fields (operator, strategy, ventures, plan,
    specialistPreferences, kpiBoard) unchanged. Registered in
    collections.json under col_updates.
  app/api/persona/venture-iqube/ingest/route.ts — accepts v0.1, v0.2,
    AND v0.3 payloads. SUB_SURFACE_MAP gains 'avl' → 'mvl' so legacy
    payloads still hydrate against the current ActiveCartridgeSlug
    enum. v0.4 will drop the avl fallback and reject 'avl' outright.

Data fix
  supabase/migrations/20260529000001_active_cartridges_avl_to_mvl.sql
    — rewrites any existing experience_qubes.active_cartridges row
    containing 'avl' to 'mvl' in place (array_replace), idempotent.
    OPERATOR ACTION: paste into Supabase SQL editor once.

Not touched (intentionally)
  - supabase/migrations/*_avl_*.sql historical migrations (immutable)
  - /api/avl/* route directory paths (Pass 2 — needs FE callsite
    coordination so the rename doesn't break in-flight callers)
  - codexes/packs/alpha-knyt/*-avl-*.md historical PRDs (history)
  - codexes/packs/agentiq/items/venture-iqube/operation-metawill-
    v0.2.json fixture (operator will re-emit as v0.3)
  - codexes/packs/aigency/items/build_/COMMITS/* (append-only history)

Operator action checklist:
  1. Run the SQL migration above in Supabase dev SQL editor.
  2. Re-emit Operation metaWill Venture iQube as v0.3 (cartridgeSlug
     enum 'avl' → 'mvl', bump schemaVersion). Prompt for ChatGPT is
     in the v0.3 spec doc.
  3. Re-ingest the v0.3 file via the UploadDrawer ✨ button.
```

## Body

AgentiQ Venture Lab is now metaMe Venture Lab; rename avl/AVL across
the live code surface to mvl/MVL. Pass 1 = type union + UI strings +
NBE catalog + Venture iQube schema bump. Pass 2 (deferred) will rename
the /api/avl/* route paths and the FE callsites that hit them.

Type union
  services/iqube/experienceQube.ts:
    ActiveCartridgeSlug 'avl' → 'mvl'
    VALID_CARTRIDGES set updated to match

UI labels (15 files)
  components/metame/cards/{NextBestActionCard,ExperienceModelCard,
    ActivityReceiptCard,VentureProgressCard,ExpandedNBEPill,
    ApprovalCard}.tsx — cartridge-label maps 'avl:' key → 'mvl:'
    value 'AgentiQ Venture Lab' → 'metaMe Venture Lab'
  components/metame/setup/ExperienceModelSetupWizard.tsx — same
  components/metame/workbench/WorkbenchLedger.tsx — same
  services/orchestration/{nbeCatalog,ventureProgressBuilder,
    strategyInference,briefBuilder}.ts — slug literals + nbe ids
    'avl.generate-progress-report' → 'mvl.generate-progress-report',
    'avl.schedule-review-block' → 'mvl.schedule-review-block'
  services/activations/spineActivations.ts — slug
  app/triad/components/codex/tabs/{AigentMeWelcomeTab,
    _ventureLabData,IQubeRegistryMintsTab}.tsx — labels + slugs
  app/(shell)/marketa/components/{MarketaPartnersAdminTab,
    MarketaCartridge}.tsx — labels
  app/api/crm/webhooks/mailjet/route.ts — label
  app/api/marketa/campaigns/route.ts — label
  app/api/assistant/{bootstrap,brief,move-forward,venture-progress}/
    route.ts — slug
  app/data/personas.ts — label
  data/codex-configs.ts — label
  data/activation-catalog.ts — slug

Venture iQube schema v0.3
  codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md
    — new spec doc: cartridgeSlug enum drops 'avl' and adds 'mvl'.
    All other v0.2 fields (operator, strategy, ventures, plan,
    specialistPreferences, kpiBoard) unchanged. Registered in
    collections.json under col_updates.
  app/api/persona/venture-iqube/ingest/route.ts — accepts v0.1, v0.2,
    AND v0.3 payloads. SUB_SURFACE_MAP gains 'avl' → 'mvl' so legacy
    payloads still hydrate against the current ActiveCartridgeSlug
    enum. v0.4 will drop the avl fallback and reject 'avl' outright.

Data fix
  supabase/migrations/20260529000001_active_cartridges_avl_to_mvl.sql
    — rewrites any existing experience_qubes.active_cartridges row
    containing 'avl' to 'mvl' in place (array_replace), idempotent.
    OPERATOR ACTION: paste into Supabase SQL editor once.

Not touched (intentionally)
  - supabase/migrations/*_avl_*.sql historical migrations (immutable)
  - /api/avl/* route directory paths (Pass 2 — needs FE callsite
    coordination so the rename doesn't break in-flight callers)
  - codexes/packs/alpha-knyt/*-avl-*.md historical PRDs (history)
  - codexes/packs/agentiq/items/venture-iqube/operation-metawill-
    v0.2.json fixture (operator will re-emit as v0.3)
  - codexes/packs/aigency/items/build_/COMMITS/* (append-only history)

Operator action checklist:
  1. Run the SQL migration above in Supabase dev SQL editor.
  2. Re-emit Operation metaWill Venture iQube as v0.3 (cartridgeSlug
     enum 'avl' → 'mvl', bump schemaVersion). Prompt for ChatGPT is
     in the v0.3 spec doc.
  3. Re-ingest the v0.3 file via the UploadDrawer ✨ button.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/marketa/components/MarketaCartridge.tsx` |
| Modified | `app/(shell)/marketa/components/MarketaPartnersAdminTab.tsx` |
| Modified | `app/api/assistant/bootstrap/route.ts` |
| Modified | `app/api/assistant/brief/route.ts` |
| Modified | `app/api/assistant/move-forward/route.ts` |
| Modified | `app/api/assistant/venture-progress/route.ts` |
| Modified | `app/api/avl/comms-packs/route.ts` |
| Modified | `app/api/avl/customers/pipeline-candidates/route.ts` |
| Modified | `app/api/avl/customers/route.ts` |
| Modified | `app/api/avl/partners/by-email/route.ts` |
| Modified | `app/api/avl/partners/route.ts` |
| Modified | `app/api/avl/send/route.ts` |
| Modified | `app/api/crm/webhooks/mailjet/route.ts` |
| Modified | `app/api/marketa/campaigns/route.ts` |
| Modified | `app/api/persona/venture-iqube/ingest/route.ts` |
| Modified | `app/data/personas.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` |
| Modified | `app/triad/components/codex/tabs/IQubeRegistryMintsTab.tsx` |
| Modified | `app/triad/components/codex/tabs/_ventureLabData.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/metame/cards/ApprovalCard.tsx` |
| Modified | `components/metame/cards/ExpandedNBEPill.tsx` |
| Modified | `components/metame/cards/ExperienceModelCard.tsx` |
| Modified | `components/metame/cards/NextBestActionCard.tsx` |
| Modified | `components/metame/cards/VentureProgressCard.tsx` |
| Modified | `components/metame/setup/ExperienceModelSetupWizard.tsx` |
| Modified | `components/metame/workbench/WorkbenchLedger.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/activations/spineActivations.ts` |
| Modified | `services/iqube/experienceQube.ts` |
| Modified | `services/orchestration/briefBuilder.ts` |
| Modified | `services/orchestration/nbeCatalog.ts` |
| Modified | `services/orchestration/ventureProgressBuilder.ts` |
| Modified | `services/strategy/strategyInference.ts` |
| Added | `supabase/migrations/20260529000001_active_cartridges_avl_to_mvl.sql` |

## Stats

 38 files changed, 159 insertions(+), 68 deletions(-)
