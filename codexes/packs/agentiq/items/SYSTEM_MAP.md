# System Map — AigentZBeta (High-Level)

This document describes the runtime shape, module boundaries, and core flows.

## 1) Mental model
AigentZBeta is a unified system where:
- Next.js provides UI and server API routes.
- Agent/orchestration services provide intent handling and tool calls.
- iQubes provide context packaging (meta/token/blak).
- SmartWallet enforces identity, entitlements, payments, and receipts.
- Codex Runtime renders content packs (KNYT, Qriptopian, Agentiq).
- Autodrive mirrors the curated Agentiq Cartridge.

## 2) Module map (conceptual)
### Frontend/UI
- `app/` routes and layouts
- `components/` and `ui/` shared UI
- `packages/` reusable UI/SDKs

### Service/API layer
- `app/api/...` API routes
- `services/...` supporting services
- `orchestration/...` intent and UI assembly

### Storage/state
- Supabase (or equivalent) for app state, content, entitlements
- Autodrive for cartridge distribution

## 3) Core flows
### Flow A: Intent to UI
1) User intent captured (chat or UI action)
2) Orchestrator selects template + actions
3) Liquid UI renders via UI Assembly Packet
4) SmartWallet gates state-changing actions
5) Receipts + provenance recorded

### Flow B: Codex content retrieval
1) Client requests shelves/collections/items
2) Server applies entitlements and access_state
3) Client renders preview/full content

### Flow C: PR merged to cartridge update
1) CI generates PR brief + index update
2) Outputs synced to Autodrive
3) Agents retrieve updated truth

## 4) Guardrails
- No secrets in cartridge or Autodrive
- Locked content never leaks
- Policy gates win over UI requests

## 5) Inter-Cartridge Identity — Core Flow

When a user navigates between cartridges (e.g. Venture Lab α → KNYT, KNYT → Qriptopian), their identity context travels with them.

**Flow:**
1. Source cartridge constructs link via `buildCodexUrl(slug, { personaId, tab, from, fromTab })` (`utils/codex-nav.ts`)
2. URL carries `?personaId=<id>&tab=<slug>&from=<source>&fromTab=<sourceTab>`
3. Target embed route (`/triad/embed/codex/[codexSlug]/page.tsx`) reads all params from `searchParams`
4. `useCodexEmbedAuthBridge` resolves personaId (URL param takes priority over localStorage fallback)
5. Target `TabRenderer` receives `personaId`, `isAdmin`, `isPartner` and passes to all tab components

**Access gate rule:** `isAdmin`/`isPartner` in the URL only drive *optimistic* client UI. Server-side re-validates from the persona record — gates cannot be bypassed via URL manipulation.

**Back-links:** Source slug/tab are carried as `?from=&fromTab=` so the receiving cartridge can construct a correct back-button without hardcoding the origin.

**Canonical helper:** `utils/codex-nav.ts` — `buildCodexUrl()`. All inter-cartridge links MUST use this function. Never hand-write `?personaId=` strings.
