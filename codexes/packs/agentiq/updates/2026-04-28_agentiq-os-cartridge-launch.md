# AgentiQ OS Cartridge — Phase 1–3 Launch

**Date:** 2026-04-28  
**Branch:** `claude/confirm-aigentz-access-VnNTK`  
**Status:** Complete — all Phase 1–3 deliverables shipped to `dev`

---

## Summary

Implemented the full AgentiQ OS Cartridge (`agentiq-os-cartridge`) — a public developer-facing onboarding surface for the open-source AgentiQ OS layer. Distinct from the existing AgentiQ engineering KB cartridge (different audience, different KB, different persona).

---

## New Cartridge

**ID:** `agentiq-os-cartridge` | **Slug:** `agentiq-os` | **Color:** green  
**File:** `data/codex-configs.ts` — `AGENTIQ_OS_CARTRIDGE` constant added and exported

### Tab Structure (7 grouped tabs, 20+ sub-tabs)

| # | Tab | Component | Sub-tabs |
|---|-----|-----------|---------|
| 0 | Home | `AgentiqOSHomeTab` | Start Here, Aigent C |
| 1 | Bind | `AgentiqOSBindTab` | Persona, Delegation |
| 2 | Build | `AgentiqOSBuildTab` | SDK/API, SmartTriad, Liquid UI, Runtime Ref, Studio Ref |
| 3 | Deploy | `AgentiqOSDeployTab` | Build Dashboard, Ingestion Factory, Codex, nanOS Bridge |
| 4 | Mission Boards | `DevMissionBoardTab` | Beginner, Builder, Registry, Advanced, Ecosystem |
| 5 | Community | `AgentiqOSCommunityTab` | Dev Resources, Updates, Qriptopian |
| 6 | Docs / KB | `AgentiqCartridgeTab` | (agentiq-os pack, col_docs_kb) |

Prior design had 17 flat tabs; restructured to 7 grouped tabs on operator request.

---

## New Components

### 5 Wrapper Tab Components
All in `app/triad/components/codex/tabs/`:

- `AgentiqOSHomeTab.tsx` — Start Here (cartridge KB) + Aigent C (AigentCOSTab)
- `AgentiqOSBindTab.tsx` — Developer Persona + Bounded Delegation
- `AgentiqOSBuildTab.tsx` — SDK/API, SmartTriad, Liquid UI (cartridge KB) + Runtime/Studio Ref tabs
- `AgentiqOSDeployTab.tsx` — Build Dashboard (AgentiQOSTab), Ingestion Factory, Codex KB, nanOS Bridge
- `AgentiqOSCommunityTab.tsx` — Dev Resources (Kn0wdZTab), Updates (agentiq pack), Qriptopian (FeaturesTab)

All wrappers use the same pill-nav sub-tab pattern from `AigentMissionsBoardTab` (green-500/20 active state).

### Previously Built Tab Components (Phase 1–2)
- `AigentCOSTab.tsx` — Aigent C persona overview + activation CTA
- `DevPersonaTab.tsx` — developer persona create/view + wallet state + iQube mint CTA
- `BoundedDelegationTab.tsx` — delegation grant/revoke UI + audit log + policy enforcement display
- `DevMissionBoardTab.tsx` — 5 mission categories with type-aware iQube registration
- `NanOSBridgeTab.tsx` — open/proprietary comparison table
- `RefRuntimeTab.tsx`, `RefStudioTab.tsx` — reference pattern docs

---

## Content Pack

**Path:** `codexes/packs/agentiq-os/`  
**Pack ID:** `pack_agentiq_os_v0` | **Visibility:** public

### Collections
`col_start_here`, `col_docs_kb`, `col_sdk_api`, `col_smarttriad`, `col_liquid_ui`, `col_reference`, `col_codex`

### Items (14 markdown files)
`start-here.md`, `what-is-agentiq-os.md`, `what-is-nanos.md`, `protocols.md`, `stack-overview.md`, `dev-standards.md`, `governance.md`, `sdk-quickstart.md`, `reference-runtime.md`, `reference-studio.md`, `smarttriad.md`, `liquid-ui.md`, `agentiq-os-codex.md`, `bounded-delegation.md`, `identity-sovereignty.md`

---

## API Routes

### Aigent C-OS Chat (`app/api/codex/chat/agentiq-os/route.ts`)
- Reads only from `codexes/packs/agentiq-os/` — never from aigency KB
- Persona: `aigent-c-os`
- Temperature: 0.2
- Includes `DelegationGuard` — rejects prompt injection patterns with 403

### Delegation Lifecycle (`app/api/codex/chat/agentiq-os/delegation/route.ts`)
- `POST` — grant HandoffPayload + sealed PolicyEnvelope; trust band validated against BAND_MIN_SCORE
- `GET` — read delegation state; fallback reconstruction from `orchestration_events` on server restart
- `DELETE` — revoke; emits `control_returned_to_metame` receipt-eligible event

**Trust band thresholds:** L1=0, L2=20, L3=50, L4=75, L5=100 (reputation_score 0–100)

### Registry Draft (`app/api/codex/agentiq-os/registry-draft/route.ts`)
- `POST { qube_type, name, description }` — returns structured JSON manifest scaffold
- DVN receipt emitted on generation
- Integrated into Mission Boards `m-register-agent` mission inline panel

### Ecosystem Signup (`app/api/codex/agentiq-os/ecosystem-signup/route.ts`)
- `POST { persona_id, bridge_stage }` — enrolls developer in open cohort
- Called automatically on persona creation

---

## Fixes

### SmartWalletDrawer overlay in DevPersonaTab
- Replaced broken `/shell/wallet?tab=iqube` navigation link with `SmartWalletDrawer variant="overlay"` — wallet slides in over the cartridge without navigation
- Added `initialTab` param support to `/triad/embed/wallet/page.tsx`

### SmartWalletDrawer auth fix  
- `handleStageMint` now fetches Supabase session and sends `Authorization: Bearer <token>` — fixes 401 on `/api/iqube/persona/qripto/mint`

### Delegation persistence
- GET delegation endpoint reconstructs DelegationRecord from `orchestration_events` when in-memory store is empty (server restart recovery) — no new DB table required

---

## Identity Docs

### Developer-facing (`codexes/packs/agentiq-os/items/identity-sovereignty.md`)
4-layer identity sovereignty model: DIDQube/Root DiD → DVN pipeline → blakQube encryption → Auto-Drive minting. Covers FIO handle as Root DiD anchor, ICP anonymous verification design intent, 4 sovereignty advantages of minting.

### Engineering KB (`codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md`)
Engineering implementation guide: correct actor_root_did metadata pattern, FIO registration flow, "do not resolve ICP" rule, blakQube limitations, mint CTA value prop correctness.

Both registered in their respective `collections.json` files.

---

## Public Mirror Workflow

**File:** `.github/workflows/sync-agentiq-os-to-public.yml`  
Triggers on push to `dev` touching `codexes/packs/agentiq-os/**` or `packages/agentiq-sdk/**`.  
Mirrors: `codexes/packs/agentiq-os/items/` → `docs/` and `packages/agentiq-sdk/` in `iQube-Protocol/AgentiQ-OS`.

**Prerequisite (operator action required):** Create `iQube-Protocol/AgentiQ-OS` repo on GitHub and add `AGENTIQ_OS_DEPLOY_TOKEN` (PAT with `repo` scope for that repo) to AigentZBeta GitHub Secrets. Workflow is safe to commit now — no-ops if secret is absent.

---

## Persona

**`aigent-c-os`** added to `app/data/personas.ts`:
- Root DiD: `aigent-c-os-root` (accountability anchor)  
- Bounded persona for `agentiq-os-cartridge` context  
- 5 modes: learn / build / persona / registry / ecosystem  
- Grounded in agentiq-os pack KB only — never aigency engineering KB  
- System prompt includes immutable POLICY ENVELOPE block (prompt injection defense-in-depth)

---

## Mission Board Improvements (DevMissionBoardTab)

### Type-aware iQube registration  
`m-register-agent` mission renamed to **"Register an iQube"**. Description and steps change dynamically based on `draftQubeType` selector:

| Type | Description focus | Steps |
|------|------------------|-------|
| AigentQube | Capabilities + policy bindings | AigentQubeRegistration, capabilities[], policyBindings[] |
| SkillQube | Input/output schema + entrypoint | SkillQubeRegistration, input_schema, output_schema, runtime entrypoint |
| WorkflowQube | DAG steps + trigger | WorkflowQubeRegistration, steps[], depends_on edges, trigger |
| ConnectorQube | Protocol + auth + endpoints | ConnectorQubeRegistration, protocol, auth model, endpoints[] |

Inline **Generate Draft** panel (collapsed by default) calls `POST /api/codex/agentiq-os/registry-draft` and renders the JSON scaffold with a copy button.
