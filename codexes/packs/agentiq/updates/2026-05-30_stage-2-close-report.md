# Stage 2 Close Report — Canonical resolver + projections + backfill + CI gates

**Status:** Stage 2 complete on `claude/dreamy-gates-mMqNv`. Resolver live, projections T0-safe, backfill runnable, CI authority gates enforced. Stage 8 (cartridge UI consumers) is the operator's chosen next step.
**Date:** 2026-05-30
**Branch commits (this stage):** `4c2c3830` (C7), `55c7e554` (C8), `28a7674c` (C9), `3dae5144` (C10).
**Reads with:** Stage 1 Close Report + Stage 1→2 Transition.

---

## What Stage 2 delivered (4 commits)

### C7 — Resolver foundation (`4c2c3830`)

Created the full canonical resolver surface:

- `services/registry/adapters/types.ts` — adapter contract + `syntheticIQubeId()` for code-only sources
- `services/registry/adapters/contentQubeAdapter.ts` — wraps legibility ContentQube source, loads triad refs + edition_supply
- `services/registry/adapters/toolQubeAdapter.ts` — two source paths (code + DB), derives `tool_subtype` from supported_interfaces.mcp hint
- `services/registry/adapters/aigentQubeAdapter.ts` — defaultGovernance with `payment_authority=NULL` per v1.1 §B.6
- `services/registry/adapters/dataQubeAdapter.ts` — handles 20 LiquidUI seeds + DB DataQubes
- `services/registry/adapters/index.ts` — REGISTRY_ADAPTERS + lookups
- `services/registry/projections/{admin,cartridge,public}.ts` — three pure projection functions
- `services/registry/resolver.ts` — `resolveIQube` / `resolveIQubeByChainAnchor` / `listIQubes`, two-path resolution (iqube_id_map → adapter dispatch; fallback to legacy-id pattern)

Authority rule enforced structurally — resolver never decides access/ownership/receipts; uses spine via `callerOwnsViaSpine()` / `callerCanReadViaSpine()` helpers.

### C8 — Routes (`55c7e554`)

- **Replaced the mock** at `app/api/registry/iqube/route.ts`. POST now does real persona-auth + `createMetaQube` + `iqube_id_map` insert. Returns canonical iqube_id + meta_qube_id + initial state + card_url. Gated by `isAdmin || isPartner`.
- **New** `app/api/registry/iqube/[id]/route.ts` — GET. Delegates to resolver with `?projection=` query param. `admin`/`internal` require `isAdmin`; `public` returns 404 for non-public records.
- **Deprecated** `app/api/iqube/persona/qripto/mint/route.ts` — `@deprecated` docstring; 30-day observation window starting today.

### C9 — CI authority + projection T0-leak tests (`28a7674c`)

- `tests/registry-authority.test.ts` — static regex over resolver + 4 adapter sources. Asserts:
  - Resolver imports `userOwnsAsset` only from canonical path; doesn't redefine
  - Resolver imports `evaluateAccess` only from canonical path
  - Resolver never writes to `orchestration_events` / `content_qube_dvn_receipts`
  - Resolver never SELECTs from `persona_token_qube_ownership` directly
  - Adapters never import access/ownership modules; never emit receipts; never deref `secret_ref` via vault/env
  - Runtime smoke: mock `userOwnsAsset` and verify the resolver wires the mock
- `tests/registry-projections.test.ts` — property-based no-T0-leakage tests for all 3 projections:
  - 5 T0 sentinels (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, `fioHandle`)
  - Admin / Cartridge / Public all checked
  - Cross-projection invariants: `blak_qube_id` REFERENCE never serialised (PRD §3); `secret_ref` values never serialised (v0.2 §B.11)
  - `projectPublic` throws on `private` / `unlisted` records (fail loud)

### C10 — Backfill driver + admin route (`3dae5144`)

- `services/registry/backfill/runBackfill.ts` — idempotent driver. `backfillSource(src)`, `backfillAll()`, `verifyBackfill(src)`. Per-surface gate (PRD v1.1 §B.3) returns `{ ready: boolean }` for the green-light flip to read paths.
- `app/api/admin/registry/backfill/route.ts` — POST runs the backfill, GET verifies a source. Admin-gated.
- Triad_meta loader **handles the 4 orphan records (Stage 0 Finding F)** by tagging them with `notes='legacy_test_fixture'` per operator confirmation that these are test fixtures, not canonical content.

---

## Operator actions to run Stage 2 to operational

**1. Run the backfill against dev Supabase.**

Either via the admin route (requires an admin Bearer token + the dev host to be reachable):

```bash
# Backfill every source (one POST, returns aggregated report)
curl -X POST \
  -H "Authorization: Bearer $YOUR_ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/admin/registry/backfill | jq

# Verify a specific source is ready
curl -H "Authorization: Bearer $YOUR_ADMIN_TOKEN" \
  https://dev-beta.aigentz.me/api/admin/registry/backfill?source=content_qube | jq
```

Or run as a one-off Node script (admin token not required when run server-side with `SUPABASE_SERVICE_ROLE_KEY` in env):

```bash
# In the project root, with SUPABASE_SERVICE_ROLE_KEY set:
npx tsx -e 'import { backfillAll } from "./services/registry/backfill/runBackfill"; \
  backfillAll().then((r) => console.log(JSON.stringify(r, null, 2)));'
```

Expected after dev backfill (per Stage 0 row counts):

| source | inserted (first run) | skipped (subsequent runs) |
|---|---:|---:|
| `triad_meta` | 87 | 87 |
| `content_qube` | 49 | 49 |
| `registry_asset` | 28 | 28 |
| `code:aigentQubeSource` | 5 | 5 |
| `code:toolQubeSource` | (n openclawCore tools) | n |
| `code:liquidui-template` | 20 | 20 |

Errors should be zero — anything non-zero in `report.per_source[i].errors` deserves investigation.

**2. Verify each source is gate-green before Stage 8 starts wiring tab consumers.**

```bash
for src in triad_meta content_qube registry_asset \
           code:aigentQubeSource code:toolQubeSource code:liquidui-template; do
  echo "--- $src"
  curl -H "Authorization: Bearer $YOUR_ADMIN_TOKEN" \
    "https://dev-beta.aigentz.me/api/admin/registry/backfill?source=$src" | jq '.'
done
```

Every row should return `ready: true`. Non-ready → backfill incomplete → don't flip read paths for that source yet.

**3. Smoke-test the resolver.**

```bash
# Resolve a known content_qube by id (cartridge projection, no auth needed for public)
curl https://dev-beta.aigentz.me/api/registry/iqube/<CONTENT_QUBE_UUID>?projection=public | jq

# Admin projection (needs admin Bearer)
curl -H "Authorization: Bearer $YOUR_ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/registry/iqube/<UUID>?projection=admin" | jq

# Resolve a code-only AigentQube (uses synthetic UUID from backfill)
curl https://dev-beta.aigentz.me/api/registry/iqube/aigent-marketa | jq  # legacy-id fallback
# OR use the synthetic UUID from iqube_id_map.iqube_id for aigent-marketa
```

**4. Run the new CI tests locally if you want pre-merge confidence.**

```bash
npx vitest --config vitest.config.mjs run \
  tests/registry-authority.test.ts \
  tests/registry-projections.test.ts \
  tests/iqube-legibility-actionmap.test.ts
```

All three should pass. Anything red in `registry-projections` is a T0-leakage bug — fix before merging.

---

## Updated authority matrix — Stage 2 state

| Domain | Authority (per PRD v1.0 §3) | Stage 2 status |
|---|---|---|
| iQube canonical identity (`iqube_id`) | Registry (`iqube_id_map`) | ✅ Live; backfill driver ready |
| metaQube metadata | Registry (`iq_meta_qubes` + resolver) | ✅ Read via adapter |
| BlakQube ciphertext | Encrypted storage | Unchanged — never in projections (verified by test) |
| BlakQube payload access | `evaluateAccess()` | Unchanged — resolver delegates only |
| Token ownership | `userOwnsAsset()` | Unchanged — resolver delegates via `callerOwnsViaSpine()` |
| Mint event proof | Chain + DVN receipt | Unchanged — Stage 5 mint saga |
| Current registry state | Registry | ✅ Resolver returns canonical record |
| Receipt trail | `orchestration_events` + `content_qube_dvn_receipts` | Unchanged — Stage 6 block index |
| Public agent descriptors | Legibility surface (shipped) + Registry public projection (new) | Both available |
| Connector secrets | External vault | Unchanged — adapters never deref |

CI tests (`registry-authority.test.ts`) enforce that the resolver and adapters respect every authority boundary.

---

## Stage 1→2 sign-off checklist — final state

| # | Item | Status |
|---|---|---|
| 1 | Apply migration to dev Supabase | ✅ Done |
| 2 | Finding F orphan disposition | ✅ Closed (test fixtures, tagged via backfill) |
| 3 | Cartridge migration priority (Stage 8 first) | ✅ Confirmed; Stage 8 next |
| 4 | qripto/mint route | ✅ `@deprecated` (30-day window) |
| 5 | bridge-core/dvnReceiptService retain-with-mirror | ✅ Confirmed (lands Stage 6) |
| 6 | ContentQube substate mapping | **Open** — Stage 1→2 transition doc has full proposal + 2 judgment calls; operator response unblocks Stage 3 |

Item 6 doesn't block Stage 8; it blocks Stage 3 (lifecycle state machine). Stage 8 can proceed in parallel.

---

## Stage 8 preview (operator's chosen next)

Per PRD v1.0 §10 Stage 8 + v1.1 §C delta:

1. **Wire `RegistrySupplyTab.tsx`** (`app/triad/components/codex/tabs/RegistrySupplyTab.tsx`) — the AgentiQ OS cartridge's Registry tab — to consume the canonical resolver. Currently it reads its own shape; migrate to `listIQubes` + `resolveIQube({ projection: 'admin' })`.
2. **Build the 7 stub tabs** in the new `iqube-registry` cartridge (Stage 1 C3):
   - **Browse iQubes** — list view via `listIQubes()`, filter chips per primitive_type, click → detail modal via `resolveIQube({ projection: 'cartridge' })`.
   - **DVN Receipts** — needs Stage 6 receipt index first. Placeholder copy until then.
   - **Mints + Sagas** — lift-and-shift the existing `CanonicalMintPanel.tsx` (shipped 2026-05-29) per its own backlog doc. Wire to admin projection.
   - **Canonization Queue** — list `iqube_canonization_requests WHERE status='pending'`; approve/reject actions emit lifecycle transition (Stage 3) + DVN receipt (Stage 6).
   - **Action Vocabulary** — list pending vocabulary additions; surfaces `services/iqube/legibility/actionMap.ts` review queue (Stage 1 C2 + v1.1 §A.6).
   - **Registry Health** — backfill status (calls `verifyBackfill` for each source); orphan-meta flags from Finding F; under-seeded edition status from Finding G.
   - **Docs** — markdown reader for the PRD trail + legibility profile.
3. **CanonicalMintPanel migration** — per its 2026-05-29 backlog doc, lift the component from `KnytCodexAdminTab` mount to `iqube-registry → mints` tab. Switch its data source from `/api/admin/content-qube/list` to `listIQubes({ primitive_type: 'ContentQube' })`.

Estimated Stage 8 effort: ~4–5 working days. Some tabs (DVN Receipts, Canonization Queue) depend on later stages and ship as live-data-aware skeletons until then.

---

## What this branch contains end-to-end

Commits on `claude/dreamy-gates-mMqNv` (this branch) since `cae0191f` (dev merge):

```
3dae5144  Stage 2 C10  backfill driver + admin route
28a7674c  Stage 2 C9   CI authority + T0-leak tests
55c7e554  Stage 2 C8   replace mock POST; add GET /[id]; @deprecate qripto/mint
4c2c3830  Stage 2 C7   resolver foundation (adapters + projections + main)
2a726144              Stage 1→2 transition (operator answers + Stage 3 clarification)
a8415648  Stage 1 C6   close report
53884b56  Stage 1 C5   CanonicalIQubeInternalRecord + view models
319dac60  Stage 1 C4   canonical plane SQL migration
3d4cbab4  Stage 1 C3   iqube-registry cartridge slug + 7 stub tabs
090ebbe7  Stage 1 C2   actionMap.ts + CI tests
d502512f  Stage 1 C1   drop LiquidUI; reclassify; add ClusterQube
e9c0ac75              Stage 0 audit follow-up (orphans + LiquidUI count fix)
e5f64dd2              Stage 0 audit row counts
44ca53af              Stage 0 audit report
bb5e9374              PRD v1.1 guardrails
d802e494              PRD v1.0 consolidated
194e3b66              PRD v0.3 alignment
3955d5ec              PRD v0.2 addendum
dbcc2d36              PRD v0.1
```

20 commits delivering: PRD trail (v0.1 → v1.1) + Stage 0 audit + Stage 1 schema work (5 commits) + Stage 2 resolver + projections + backfill + CI gates (4 commits) + 4 audit/transition/close-report docs.

---

**End of Stage 2 Close Report. Stage 8 begins on operator go-ahead OR after the dev backfill + verify queries return ready=true.**
