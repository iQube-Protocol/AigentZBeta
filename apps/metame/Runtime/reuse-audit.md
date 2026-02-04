# metaMe Reuse Audit (Quick Map)

Status: Draft
Purpose: reuse-first inventory for metaMe Runtime + Studio implementation.

## Compass / Menu / Experience UI
- `services/content/smartMenuIntegration.ts`
  - Generates SmartMenuManifest (drawers + actions).
  - Menu actions logic for content + wallet state.
- `app/components/content/SmartTriadProvider.tsx`
  - Client-side SmartTriad state + manifest generation.
- `services/menu/*`
  - Menu fixtures + API (`app/api/menu/route.ts`) for app-level menu configs.
- `ui/smartLayout/*`, `components/drawer/*`, `components/smartDrawer/*`
  - Drawer layout + menu rail patterns (mobile/desktop behaviors).

## Templates / Liquid UI
- `app/data/knyt_liquid_ui_template_pack.json`
  - Liquid UI template pack (KNYT) with drawer/menu regions.
- `apps/theqriptopian-web/src/data/knyt_liquid_ui_template_pack.json`
  - Same template pack mirrored for qriptopian web app.
- `apps/theqriptopian-web/src/services/knytLiquidUIService.ts`
  - Template selection, drawer mode, wallet UI mounting.
- `apps/theqriptopian-web/src/services/liquidUIService.ts`
  - Liquid UI content/placement parsing utilities.
- `apps/theqriptopian-web/src/data/templates/*`
  - Issue/template schemas for content packs (v1.4).

## Packs / Registry
- `app/api/codex/registry/_lib/packRegistry.ts`
  - Codex pack registry loader and tab mapping.
- `codexes/packs/*`
  - Pack metadata, collections, and retrieval indices.
- `tests/pack-registry.test.ts`
  - Registry tests (pattern for schema/pack validation).

## Receipts / Audit / DVN
- `services/receipts/receiptService.ts`
  - Unified receipt creation (PoS, purchase, QubeTalk, SmartTriad).
- `app/api/receipts/*`
  - Receipt list/get/verify endpoints.
- `app/api/ops/*`
  - DVN receipt sync, batching, and repair flows.

## Wallet / Persona / Identity
- `services/wallet/personaService.ts`
  - Persona CRUD + active persona state.
- `types/persona.ts`
  - PersonaQube definitions and reputation/identity fields.
- `services/agentiq-wallet/*`
  - Wallet service (x402, DVN, smart menu manifests).

## Offers / Payments / x402
- `app/(shell)/copilot/actions/smartTriad.ts`
  - `triad_purchase_content` flow (x402 transfer + entitlements).
- `services/rewards/*`
  - Reward ledger integration and DVN balance updates.

## Invites / Sharing
- `app/api/invitations/route.ts`
  - Invitation creation + receipt logging.
- `services/composer/composerPersistence.ts`
  - Session storage reused for offer experience instances (in-memory fallback or Supabase).

## QubeTalk / Approvals
- `components/qubetalk/QubeTalkConsole.tsx`
  - Receipts + iQube refs display and QubeTalk activity.
- `app/api/qubetalk/*`
  - QubeTalk channels/messages/delegations + receipts.

## Known gaps to fill (MVP)
- Compass Menu Policy Engine (deterministic ranking, 3 primary + optional Be/Share).
- Micro-experience pack manifest schema aligned to existing registry.
- Experience instance + invite/join linking (same instance state).
- Smart Offer pack end-to-end receipt chain (consent + settlement).
