# Legacy `/registry` Integration — Phase C Close Report

**Status:** Phase C complete on `claude/dreamy-gates-mMqNv`. Shared registry UI primitives are lifted to `components/iqube/`. The cartridge `Browse` tab gained a grid view + shared detail modal. A new `Intake` cartridge tab mounts the Ingestion Factory. Legacy `/api/registry/templates/*` routes carry deprecation headers for the observation window.
**Date:** 2026-05-31
**Phase C commits:** `b13f2ea4` (C1 lift), `ec9afdaf` (C2+C3 grid + modal), `60a59351` (C4 Intake tab), `67e4f543` (C5 deprecation), `<this commit>` (C6 close report).
**Plan:** `codexes/packs/agentiq/updates/2026-05-31_legacy-registry-canonical-integration-plan.md` §Phase C.

---

## What shipped — Phase C (component lift + cleanup)

### C1 — Lift shared components to `components/iqube/`

Moved with `git mv` (history preserved):
- `components/registry/scoreUtils.tsx` → `components/iqube/scoreUtils.tsx`
- `components/registry/IQubeCard.tsx` → `components/iqube/IQubeCard.tsx`
- `components/registry/AddIQuBeForm.tsx` → `components/iqube/AddIQuBeForm.tsx`
- `components/registry/IQubeDetailModal.tsx` → `components/iqube/IQubeDetailModal.tsx`

Re-export shims at the old paths keep existing callers (RegistryHome, RegistryClient, ExperienceDashboardTab, SkillVideoPlayer, registry/add page) compiling without an import-rewrite pass. `components/iqube/` already housed the per-context drawer set (Persona, Identity, Connections, Memory) — this lift completes that namespace as the canonical home for shared iQube UI primitives.

### C2 — Cartridge Browse tab grid view

`app/triad/components/codex/tabs/IQubeRegistryBrowseTab.tsx`:
- View-mode toggle (Table / Grid) at the top of the tab
- Grid mode mounts the lifted `IQubeCard` using `cartridgeViewToLegacyTemplate` to map the canonical view → legacy template shape (so scores attach + Rel/Trust dots render from real data)
- Same data source as the table (one `/api/registry/iqube?expand=cartridge` fetch); the toggle just swaps render shape — no new network calls

### C3 — Cartridge Browse tab shared detail modal

`IQubeRegistryBrowseTab.tsx`:
- Clicking a card in grid view opens the same `IQubeDetailModal` the legacy `/registry` mounts
- Fork / Mint / Edit flows are identical across both surfaces — every action routes through the canonical write endpoints from Phase B (`POST /iqube`, `/fork`, `/mint`, `/mint-batch`, `/revoke`; `PATCH /iqube/[id]`)

### C4 — Cartridge Intake tab

New tab `IQubeRegistryIntakeTab.tsx`:
- Wraps the existing `IngestionFactoryPanel` (same component the legacy `/registry` Factory tab renders)
- Admin-gated (intake is operator-bound)
- Slug: `/triad/embed/codex/iqube-registry/intake`
- Wired through `TabRenderer.tsx` component registry + `CODEX_DEFINITIONS` tab array (order 1, group `browse`)

Legacy `/registry` Factory tab stays mounted during the observation window for UX parity; full retirement is a follow-up cleanup when the cartridge Intake tab has proven equivalent.

### C5 — Deprecation headers on legacy template routes

New helper `services/registry/legacy/deprecation.ts`:
- `withDeprecation(handler, { route, replacement })` wraps a Next.js handler
- Attaches `X-Deprecated: true`, `X-Deprecation-Replacement: <canonical-route>`, `X-Deprecation-Phase: c5-observation-window` to every response
- Logs a single warning per Lambda cold start (CloudWatch surfaces ongoing legacy traffic)

Wrapped routes:
- `GET /api/registry/templates` → `GET /api/registry/iqube?expand=cartridge`
- `POST /api/registry/templates` → `POST /api/registry/iqube`
- `GET /api/registry/templates/[id]` → `GET /api/registry/iqube/[id]?projection=admin`
- `PATCH /api/registry/templates/[id]` → `PATCH /api/registry/iqube/[id]`
- `DELETE /api/registry/templates/[id]` → `POST /api/registry/iqube/[id]/revoke`

**Not wrapped:** `/api/registry/library` remains canonical (per-user library SoT lives in `user_library` table; Phase B B5 added the canonical audit trail via `iqube_library_added` orchestration events).

Per the plan: 30-day observation window; hard-delete after zero observed traffic. The CloudWatch warning + headers give the operator the visibility to make that call.

---

## Verification gate

Per the plan's Phase C exit criterion: "/registry and cartridge `IQubeRegistryBrowseTab` both mount the same `IQubeCard` + `IQubeDetailModal` components."

Confirmed:
- `components/registry/RegistryHome.tsx` → renders `IQubeCard` from `./IQubeCard` shim (→ `components/iqube/IQubeCard`)
- `components/iqube/IQubeDetailModal.tsx` → mounted from both `RegistryClient.tsx` (legacy) and `IQubeRegistryBrowseTab.tsx` (cartridge) via the lifted module
- Same fetch path through `cartridgeViewToLegacyTemplate` in both surfaces

---

## Authority compliance

Phase C touched UI structure only. No spine files modified. No access gates removed. The canonical resolver + the Phase B write routes are the same on both surfaces — the lift is a render-layer change.

---

## What's deferred to a follow-up

| Item | Why deferred |
|---|---|
| Hard delete of `/api/registry/templates/*` routes | 30-day observation window — operator decision after CloudWatch surfaces zero legacy traffic |
| Retire `RegistryHome` Factory tab | Cartridge Intake tab needs operator validation in production before legacy mount can drop |
| Per-user library count surface on cartridge view | Roll up `iqube_library_added` events into a count column on `RegistryAdminView` |
| Revoke action column on `iqube_canonization_requests` | If revocation volume warrants, replace the `[REVOKE]` notes prefix with a dedicated `action` column |
| Visibility_state column on `iqube_id_map` | So the mint saga can flip it post-MINT_COMPLETE instead of stashing on `idempotency_keys.visibility` |
| Resolver list pagination + server-side text search | Phase A flagged these; natural follow-up |
| Import-rewrite pass | Migrate `components/registry/scoreUtils|IQubeCard|IQubeDetailModal|AddIQuBeForm` imports to `components/iqube/...` and delete the shims |

---

## Branch state

61 commits on `claude/dreamy-gates-mMqNv` since dev merge:

```
PRD v0.1 → v1.1                                    (4 docs)
Stage 0 audit                                       (3 commits)
Stage 1                                             (5 + close)
Stage 2                                             (4 + close)
Stage 8 partial                                     (4 + close)
Stage 3                                             (2 commits)
Stage 4                                             (2 + close)
Stage 5                                             (3 + close)
Stage 6                                             (3 + close)
Stage 7                                             (1 + close)
Stage 9                                             (1 + close)
Vocabulary + Docs tabs                              (1 commit)
ECONNRESET retry trigger                            (1 commit)
Lambda file-trace fix + dependency hygiene backlog  (1 commit)
Legacy /registry integration plan                   (1 + 1 update + 2 backlog items)
Score Data Backfill                                 (4 + close report)
Legacy /registry integration Phase A                (5 + close report)
Legacy /registry integration Phase B                (9 + close report)
Legacy /registry integration Phase C                (5 + this close report)
```

---

## End state — the integration goal achieved

The original integration plan goal (operator decision §0 item 1, B1):

> Keep `/registry` as a top-level page, swap the data layer to the canonical resolver, share rich modals across both surfaces.

Status across the three phases:

| Surface | Pre-integration | Post-Phase C |
|---|---|---|
| Read path | Legacy `/api/registry/templates` | Canonical resolver via `cartridgeViewToLegacyTemplate` adapter |
| Write path | Legacy `/api/registry/templates` POST/PATCH/DELETE | Canonical `/api/registry/iqube` POST/PATCH + `/fork` + `/revoke` + `/mint` (Stage 5 saga) + `/mint-batch` |
| Mint | Mock visibility flag | Real Stage 5 saga with chain-mint skip + DVN receipts |
| Cart | localStorage counter | Real batch-mint orchestration with batch-level + per-iqube audit |
| Components | `components/registry/` only | Lifted to `components/iqube/` and shared with cartridge Browse tab |
| Cartridge parity | Browse tab is table-only; no detail modal | Browse tab has Table + Grid + shared detail modal + Intake tab |
| Audit | Mock + localStorage flags | Every write emits `orchestration_events` with `iqube_id` correlation |
| Identity filters | UI only | Surfaced + tracked through adapter; ready for Phase B+ server-side wiring |
| Analytics page | Mocked, no banner | Deprecation banner pointing to canonical Health tab |
| Hard-delete | DELETE removed canonical row | Canonization queue revoke request; canonical record preserved |

---

**End of Legacy `/registry` Phase C close report.**
**End of Legacy `/registry` → canonical SoT integration. All three phases shipped.**
