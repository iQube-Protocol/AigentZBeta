# Legacy `/registry` → Canonical SoT Integration Plan

**Date:** 2026-05-31
**Status:** Planning — no code changes. For operator review before implementation.
**Reads with:** PRD v1.0 + v1.1 + Stage 0–9 close reports (especially the v1.0 §3 source-of-authority matrix and v0.2 §B.2 view-model redaction).
**Branch:** would land on a fresh `claude/<session-id>` branch after operator sign-off.

---

## 1. Why this exists

The new **iQube Registry cartridge** at `/triad/embed/codex/iqube-registry/...` is now the canonical SoT for every iQube primitive (PRD v1.0 fully implemented). The legacy **`/registry`** platform view at `/registry` predates the canonical plane. It carries:

- A richer **authoring UI** (BlakQube schema editor, score sliders, business model picker, identity hints, MetaQube k/v extras editor, fork + library flows)
- A richer **card display** (5-dot Rel/Trust strips, Q¢ price pill, provenance count, persona-aware identity filter, view-mode toggle grid/list/table)
- A **mock minting flow** (`PATCH /api/registry/templates/[id]` with `visibility: public|private`) that only flips a database flag — does NOT integrate with the canonical mint saga or any chain action
- A separate **Ingestion Factory** intake flow for ToolQube / SkillQube / WorkflowQube / ConnectorQube / AigentQube
- A **trust/validation band** visualisation (`TrustPanel` + `ValidationPanel`) populated only in the Ingestion Factory flow
- A mocked **analytics page** (no real backend)
- An **admin content-qubes raw view** (operator verification table over `v_content_qube_registry`)

The legacy reads its own data (`/api/registry/templates/*`) and writes its own data, with no awareness of `iqube_id_map`, the canonical resolver, the lifecycle state machine, the mint saga, or the DVN block ledger.

**Goal:** make `/registry` a thin application view over the canonical SoT. Reads from the resolver. Writes through canonical routes. Mints through `mintSaga`. No parallel state.

---

## 2. Inventory — what the legacy carries

(Code-grounded; line counts from the Explore agent's report.)

### 2.1 Routes (4)

| Path | Component | What it does today |
|---|---|---|
| `/registry` | `RegistryHome.tsx` (830 LOC) | Browse grid/list/table; 6-filter row (Search / Type / Instance / Biz Model / Persona / Reputation); cart counter; New iQube; tabs (Catalog / Ingestion Factory) |
| `/registry/add` | `AddIQuBeForm.tsx` (445 LOC) | Template authoring — MetaQube + BlakQube + optional TokenQube fields; POST `/api/registry/templates` |
| `/registry/analytics` | analytics page (206 LOC) | 4 KPI cards + bar charts + 3 score histograms; **mocked** (`/api/registry/analytics` returns simulated data with 1.2s latency) |
| `/registry/content-qubes` | admin page | Raw `v_content_qube_registry` dump; admin-only |

### 2.2 Components in `components/registry/` (15)

| File | LOC | Role | Canonical equivalent? |
|---|---|---|---|
| `RegistryHome.tsx` | 830 | Shell — tabs, filters, view modes, paginated grid | Cartridge `IQubeRegistryBrowseTab` (table-only, lighter) |
| `RegistryClient.tsx` | — | Thin client wrapper for the shell | Cartridge mounts directly |
| `AddIQuBeForm.tsx` | 445 | Template create form | **None** — Stage 2 POST `/api/registry/iqube` takes only `{name, primitive_type}` |
| `IQubeDetailModal.tsx` | 1055 | View/edit modal with score sliders, BlakQube editor, mint+fork+save-to-library | **None** — cartridge tab opens a thin admin-projection panel only |
| `IQubeCard.tsx` | ~150 | Grid card with badges + score dots + action icons | Cartridge tab has table row only |
| `scoreUtils.tsx` | 71 | Score rendering + colour ramp + derived Rel/Trust calc | **None** — Stage 7 governance is structural, not visual |
| `TrustPanel.tsx` | ~80 | L1–L5 trust band badge + factor breakdown | **None** |
| `ValidationPanel.tsx` | ~50 | Per-stage validation status | **None** |
| `IngestionFactoryPanel.tsx` | 800 | Asset intake from GitHub/npm/MCP/workflow_def/Make.com | Backed by canonical `services/registry/intakeService.ts` (Stage 1 services) — but the UI lives only here |
| `ComponentRegistryPanel.tsx` | ~50 | QubeTalk component validation rules display | None |
| `FilterSection.tsx` | — | 6-filter green-glass row | Cartridge has 6 primitive chips only |
| `IdentityFilterSection.tsx` | — | Persona + Reputation dropdowns (DiDQube hints) | **None** |
| `RegistryBrowserDrawer.tsx`, `AssetDetailPanel.tsx`, `ViewModeToggle.tsx`, `Pagination.tsx` | — | Supporting UI | Cartridge has none of these |

### 2.3 APIs the legacy consumes

| Endpoint | Status | Canonical equivalent |
|---|---|---|
| `GET /api/registry/templates` (paginated list with filters) | ✅ Healthy (memory fallback + Supabase) | `GET /api/registry/iqube?expand=cartridge&limit=300` (Stage 8 C12) |
| `GET /api/registry/templates/[id]` (detail) | ✅ Healthy | `GET /api/registry/iqube/[id]?projection=cartridge` or `?projection=admin` (Stage 2 C8) |
| `POST /api/registry/templates` (create) | ✅ Healthy | `POST /api/registry/iqube` (Stage 2 C8) — **but only accepts `{name, primitive_type, slug?, description?, tags?, ...}`; does NOT accept scores / business model / blakqube schema / metaExtras / parent lineage** |
| `PATCH /api/registry/templates/[id]` (edit + mint visibility) | ✅ Healthy | **No canonical PATCH route** for iQube records yet; would need Stage 8+ work |
| `DELETE /api/registry/templates/[id]` | ✅ Healthy | **No canonical DELETE** — lifecycle uses `revoked` / `archived` states via canonization queue + lifecycle.ts |
| `POST /api/registry/library` (save to library) | ✅ Healthy | **No canonical library concept** — the legacy "library" is a localStorage flag + a private template copy |
| `GET /api/registry/analytics` | ❌ Mocked (1.2s simulated latency) | **None** |
| `GET /api/identity/persona` (filter dropdown) | ✅ Healthy | Same endpoint, no change |
| `GET /api/registry/content-qube/browse` | ✅ Healthy admin | Same endpoint, no change |
| `POST /api/registry/intake`, `GET /api/registry/intake/[id]`, `POST /api/registry/intake/package-skill` | ✅ Healthy (Stage 1 services/registry/intakeService.ts) | Same endpoints; no canonical UI replacement yet |
| `POST /api/registry/studio-artifacts` | ✅ Healthy | Same; orthogonal |

### 2.4 Legacy-only mint flow

The legacy "Mint to Registry" button is a **visibility-flag flip**, not a real chain mint:

- `PATCH /api/registry/templates/[id]` with `{ visibility: 'public'|'private' }`
- Sets `localStorage.minted_{id}=1`, `owner_minted_{id}=1`
- Does NOT call the canonical `POST /api/registry/iqube/[id]/mint` (Stage 5 C21)
- Does NOT create a `mint_sagas` row
- Does NOT emit a DVN receipt
- Does NOT trigger any chain action

This is the single biggest correctness gap between legacy and canonical.

---

## 3. The B1 vs B2 question — recommendation

The operator framed this as: "kill `/registry` and redirect to the cartridge" (B2) vs "keep `/registry` as a top-level page but make it a SoT consumer" (B1).

**Recommendation: B1 — keep `/registry` as a top-level page, swap its data layer to the canonical resolver, share the rich modals between `/registry` and the cartridge.**

Reasons:

1. **`/registry` and the cartridge tab serve different operator contexts.** `/registry` is a top-level page operators land on directly (no codex shell, no breadcrumbs, no tab navigation overhead). The cartridge tab is one of seven inside the `iqube-registry` codex shell. Both audiences are real:
   - Top-level `/registry`: operators / agents who want the canonical iQube grid without codex-shell chrome (admin tooling, automation, support flows).
   - Cartridge tab: operators inside the codex shell who arrived via cross-cartridge navigation, governance flows (canonization queue → Browse), or want the tab adjacents (Receipts, Mints+Sagas, Health, Vocabulary, Docs).
2. **The rich modals are reusable assets.** `IQubeDetailModal.tsx` (1,055 LOC) is the deepest authoring UI in the codebase. Killing it would either lose those affordances or force a parallel rebuild. Shared component lets both surfaces mount it.
3. **B2 increases risk surface.** Killing `/registry` means breaking every external bookmark + automation script + operator muscle memory that targets `/registry`. The auto-redirect would need to handle modal-deep-link URLs (`/registry?template=<uuid>` → `/triad/embed/codex/iqube-registry/browse?modal=...`), which adds complexity.
4. **B1 enables a future B2 if we still want it.** Once `/registry` is a SoT consumer, killing it later is a 1-commit redirect; killing it now requires solving every reason-to-keep-it first.

The plan below assumes B1.

---

## 4. Migration phases

Three phases, sequenced. Each phase is independently shippable. Each phase respects the source-of-authority matrix (PRD v1.0 §3) — `/registry` never decides access, ownership, or receipts; it composes via the canonical resolver and spine helpers.

### Phase A — Read-path migration (smallest blast radius)

Goal: `/registry` shows canonical data without changing the operator UX.

**Phase A commits (~5 commits, est. 2 days):**

A1. **Wrap legacy template fetch to the canonical resolver.** `RegistryHome.tsx`'s `GET /api/registry/templates` call becomes `GET /api/registry/iqube?expand=cartridge&limit=300`. Map the canonical response shape (`{entries: RegistryCartridgeView[]}`) to the legacy `IQubeTemplate` shape that the card components expect. Keep the existing `/api/registry/templates` route alive as a fallback for one observation window.

A2. **Wrap legacy detail fetch.** `IQubeDetailModal.tsx`'s `GET /api/registry/templates/[id]` becomes `GET /api/registry/iqube/[id]?projection=admin`. Same shape-map.

A3. **Identity filter — wire to canonical primitive enum.** The legacy "Type" filter already maps cleanly to `primitive_type`. The "Persona" + "Reputation" filters need decisions:
   - Persona: read from `getActivePersona` (already happens elsewhere) — filter by `creator_identity_state` on the canonical record.
   - Reputation: AigentQubes only; surface from the Stage 7 governance block `trust_band`.
   - Non-iQube primitives without these fields ignore the filter.

A4. **Card display — extend canonical projections.** The legacy card shows Rel + Trust dot strips. The canonical resolver doesn't surface these today. Two options:
   - **(preferred)** Add `derived_scores` to the cartridge projection: `{ reliability, trust }` computed server-side via `scoreUtils.calculateReliabilityScore` and `calculateTrustScore` against the source row. Pure derivation; no new data.
   - Or compute client-side from the source's `sensitivity` / `accuracy` / `verifiability` / `risk` fields — but those fields aren't on the canonical `RegistryCartridgeView` either, so the projection has to surface them first.

A5. **Analytics page — flag as deprecated.** No canonical analytics surface exists. Add a deprecation banner with link to the cartridge `Health` tab; leave the mock data in place until a real analytics surface lands.

**Verification gate:** the existing `tests/registry-authority.test.ts` (Stage 2 C9) is re-run; legacy `/registry` must not introduce any direct SELECT on `persona_token_qube_ownership` or `orchestration_events` from client-bundled code.

### Phase B — Write-path + mint canonicalisation (medium blast radius)

Goal: every legacy write goes through the canonical write surface; the mock mint becomes a real saga.

**Phase B commits (~6 commits, est. 3 days):**

B1. **Extend `POST /api/registry/iqube` to accept the full template surface.** Today the route accepts `{name, primitive_type, slug?, description?, tags?, ...}`. Stage 8+ work: add optional fields for `score_axes: {sensitivity, accuracy, verifiability, risk}`, `business_model`, `blakqube_labels`, `metaExtras: [{k, v}]`, `parent_template_id`, `identity_state`, `min_reputation_bucket`, `require_human_proof`, `require_agent_declare`. Store these on the canonical record via `iq_meta_qubes.metadata` JSONB (no schema migration needed).

B2. **Add `POST /api/registry/iqube/[id]/fork`.** New route. Creates a draft via `createMetaQube` with `parent_template_id` set + auto-increment provenance counter. Returns the new `iqube_id`. Then `IQubeDetailModal.tsx`'s Fork button calls this.

B3. **Add `PATCH /api/registry/iqube/[id]`.** New route. Admin-gated (lifecycle transitions still go through the canonization queue, not this PATCH). Updates the same fields B1 added on POST. Emits an orchestration_events receipt with `event_type='iqube_edited'`, mode=`async`.

B4. **Replace the mock mint flow.** `IQubeDetailModal.tsx`'s "Mint to Registry" button:
   - **Before:** PATCH `/api/registry/templates/[id]` with `{visibility}` + localStorage flag.
   - **After:** POST `/api/registry/iqube/[id]/mint` (Stage 5 C21). The Stage 5 saga handles everything — registry draft confirm → chain mint → DVN receipt → card publish. The dialog still asks Public/Private, but that's a `visibility_state` choice fed into the saga's `idempotency_keys.visibility`, not a backend flag flip. Real chain action when contracts are deployed; graceful `skipped: 'contract_unconfigured'` otherwise (same pre-deploy fallback as the existing CanonicalMintPanel).

B5. **`POST /api/registry/library` migration.** The "Save to Library" concept maps to `visibility_state='unlisted'` per the shipped legibility surface (PRD v0.3 §B.3). Replace the library POST with a PATCH on the iQube setting `visibility_state='unlisted'` + a new `library_member_persona_id` field on `iqube_id_map.notes`. Same UX, canonical state.

B6. **DELETE → revoke transition.** `/api/registry/templates/[id]` DELETE becomes a canonization queue submission with `decision='revoke'` once the canonization queue handler (Stage 3 C17) is extended to accept revocation requests, OR a direct `POST /api/registry/canonization` with action `'revoke'`. Per Stage 3, revocation requires `platform_admin`. Operator UX changes: "Delete" button becomes "Request revocation" with the explanatory tooltip.

**Verification gate:** every write now produces a `orchestration_events` row (or a `mint_sagas` row for mint flows). After Phase B, querying `/api/registry/receipts?cartridge=<scope>` should show legacy `/registry` write events alongside cartridge-emitted events.

### Phase C — Shared-component lift + cleanup (largest blast radius)

Goal: `IQubeDetailModal.tsx` and `AddIQuBeForm.tsx` lift into `components/iqube/` and mount in both `/registry` AND the cartridge `IQubeRegistryBrowseTab`. Legacy template endpoints retire after observation window.

**Phase C commits (~5 commits, est. 2-3 days):**

C1. **Lift modals to `components/iqube/`.** Move `IQubeDetailModal.tsx`, `AddIQuBeForm.tsx`, `IQubeCard.tsx`, `scoreUtils.tsx` to `components/iqube/`. Re-export from `components/registry/` for backwards compat (one-rev). No behaviour change.

C2. **Mount `IQubeCard` grid in the cartridge Browse tab.** Add view-mode toggle (table/grid) to `IQubeRegistryBrowseTab.tsx`. Grid mode reuses the lifted `IQubeCard`. Same data source (canonical resolver), same projection.

C3. **Mount the rich detail modal in the cartridge Browse tab.** Click a row → opens `IQubeDetailModal` (lifted). Reuses the same Fork / Mint / Save buttons that B1–B5 just made canonical.

C4. **Move `IngestionFactoryPanel.tsx` into the cartridge** as a sibling tab `intake` next to `browse`. The legacy `/registry` keeps the `Ingestion Factory` tab via cartridge-iframe embed, OR retires it (operators get it via the cartridge). Operator decision.

C5. **Retire legacy template endpoints after observation window.** `/api/registry/templates/*` and `/api/registry/library` get `@deprecated` headers. After 30-day observation window with zero traffic: hard delete. Parallel to the Stage 4 cleanup pattern for `useOwnedEntitlements` + `/api/codex/owned`.

**Verification gate:** `/registry` and cartridge `IQubeRegistryBrowseTab` both mount the same `IQubeCard` + `IQubeDetailModal` components. Operator UX parity confirmed via screenshot diff on dev.

---

## 5. Specific decisions to make before implementation starts

These need operator sign-off; they shape Phase A/B/C work:

1. **Library = unlisted visibility?** Per shipped legibility, `visibility_state='unlisted'` already means "accessible by id but not enumerated in catalog". This is functionally what "library" is — a private operator copy with no public surface. Confirm we collapse the concepts.

2. **Cart concept future.** The legacy cart is a localStorage counter only — no batch mint UI is wired. Two options: (a) build batch-mint in Phase B6 (operator selects N items, single POST → batch saga); (b) drop the cart UI entirely. Recommend (b) — single-mint via the saga is the canonical flow; the cart was an unfulfilled promise.

3. **Analytics surface ownership.** The mocked `/registry/analytics` page never had a real backend. Two options: (a) build a real one via `orchestration_events` aggregation in a future Stage 6+ extension; (b) retire the page entirely and link operators to the cartridge Health tab. Recommend (b) — real analytics belongs in a future product workstream, not the registry plane.

4. **Identity filter scope.** Legacy "Persona" + "Reputation" filters expect every iQube to have an identity tier + reputation band. ContentQube doesn't have a `reputation` field today. AigentQube has `trust_band` (Stage 7). Other primitives have nothing. Recommend: surface the filters but make them no-op for primitives that don't carry the field; document this in the tooltip.

5. **Trust / Validation panels for non-ingested iQubes.** `TrustPanel` + `ValidationPanel` are populated only via the ingestion factory's per-stage validation. They render nothing useful on a hand-curated ContentQube or AigentQube card. Recommend: keep them in IngestionFactoryPanel only; don't surface them on regular iQube cards.

6. **Mock BlakQube schema inference (`getBlakQubeMockSchema`).** The legacy modal auto-infers a BlakQube field list from the template name (e.g. "personal" → firstName/lastName/email). This is a UX nicety with no canonical equivalent. Recommend: preserve it as a client-side helper in `components/iqube/scoreUtils.tsx`; explicitly mark it as a placeholder until the canonical record carries authored BlakQube schemas.

7. **Forks — provenance increment rules.** The legacy fork auto-increments a `provenance` counter. The canonical record's `template_lineage: [{parent_id, version}]` (Stage 1 C5) is richer. Recommend: fork populates `template_lineage` with the parent + new version; the displayed "provenance count" becomes `template_lineage.length`. Backwards-compatible.

---

## 6. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Operator workflows that rely on the legacy `/api/registry/templates` shape break in Phase A | Keep the legacy endpoints alive with a shape-map shim during all of Phase A and Phase B; only deprecate in Phase C |
| Phase B mint change accidentally fires real chain mints on existing template-flag rows | Stage 5 saga's chain step is no-op pre-deploy (`skipped: 'contract_unconfigured'`); operator confirms Base RPC env vars before the cutover |
| Shared component lift in Phase C breaks the cartridge tab while debugging the legacy page | Lift components to `components/iqube/` first as a no-op move (C1); only swap mounts in subsequent commits (C2, C3); use feature flag if needed |
| Identity filter `Reputation` surfaces a meaningless value for ContentQube | Per §5 item 4, filter is no-op for primitives without the field; tooltip explains |
| Operator surprise: "Mint to Registry" now does a real chain action | The Stage 5 saga's dialog already warns; reuse it. Pre-deploy: action shows as `skipped: 'contract_unconfigured'` so no actual surprise; post-deploy: dialog is explicit |

---

## 7. Effort + rollout summary

| Phase | Commits | Days | Reversibility | Operator action required |
|---|---|---|---|---|
| Phase A — read path | 5 | 2 | Trivial (revert) | Verify cartridge data appears in `/registry` after deploy |
| Phase B — write + mint | 6 | 3 | Possible per-commit revert; the deployed saga calls are idempotent | Verify Stage 5 saga drives MINT_COMPLETE for a legacy-page mint; canonization queue handles revoke |
| Phase C — shared lift + retire | 5 | 2–3 | Component lift is reversible; endpoint retirement is post-30-day-window | Approve endpoint deprecation timeline; confirm `/registry` redirect strategy if any |

**Total: ~16 commits, ~7–8 working days.** Three deploy windows. Each phase ends with a smoke-test checklist for the operator.

---

## 8. What this plan deliberately does NOT do

- Does not build a new analytics backend (§5 item 3 says retire the page).
- Does not build batch-mint UI (§5 item 2 says drop the cart).
- Does not auto-redirect `/registry` to the cartridge (B2 rejected per §3).
- Does not change the canonical resolver's surface contract — only the projections gain `derived_scores` (Phase A A4).
- Does not touch `IngestionFactoryPanel` until Phase C; the asset intake flow keeps working unchanged through Phases A + B.
- Does not modify the shipped legibility profile (`docs/iqube-agent-legibility-profile.md`) — that contract stays frozen per Appendix A of PRD v1.0.

---

## 9. Next step

If operator approves the B1 framing + §5 decisions, the implementation lands on a fresh branch (`claude/legacy-registry-canonical-integration-<session>`). Each phase pushes as its own batch; close report per phase parallels the Stage 1–9 pattern.

If operator wants B2 instead (redirect-to-cartridge), I'll rewrite this doc with a different shape — much shorter, mostly redirect-handler + bookmark-compat work.

If operator wants a hybrid (kill `/registry/analytics`, keep `/registry` but lift modals immediately, etc.), name the deltas and I'll fold them in.

---

**End of plan. No code changes pending operator sign-off.**
