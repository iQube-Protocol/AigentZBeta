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
