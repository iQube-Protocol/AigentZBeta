# CFS-022a — Canonical Asset Registry (Design) — P1 / Gap G2

**Chrysalis Foundation Specification companion · design-only · authored 2026-07-09**

Realises **`CFS-022` §5 gap G2** and the **P1** milestone: register the canonical assets that
**already exist** as first-class *constitutional objects* — Bearing Instrument v1, the representation
palette / typography, the representation contract + its interpretations, and the canonical invariants
— **through the registry and invariant substrates already in the tree**, not a parallel store.

This is a **design**. It changes no `types/`, no `CFS-022`, and touches none of `services/dvn/*`,
`services/identity/*`, `services/access/*`, `services/receipts/*`. It depends on the Constitutional
Object Model contract (`types/constitutionalObject.ts`, authored separately under P0 / G1); every field
mapping below is expressed against that model's eight fields — **identity · version · standing ·
authority · dependencies · ownership · provenance · lifecycle**.

Grounding note: every claim cites a real file. Where an asset named in `CFS-022` §3 does **not** exist
in the tree (metaVitruvian, iconography), this doc says so plainly rather than inventing a source.

---

## 0. What actually exists (inventory, grounded)

| # | Canonical asset | Concrete source-of-truth in the tree | Exists? |
|---|---|---|---|
| A1 | **Representation Contract** (interpretation-agnostic: roles + relationship laws) | `types/representation.ts` → `CONSTITUTIONAL_REPRESENTATION_CONTRACT`, `ALL_ROLES`, `RelationshipRule`; executor `services/representation/representationResolver.ts` | ✅ |
| A2 | **Bearing Instrument v1** (Canonical Asset 001, `variant="atlas"`) | `components/representation/BearingInstrument.tsx`; contract test `tests/bearing-instrument.test.ts` (`describe("atlas variant — Canonical Asset 001 (Bearing Instrument v1.0)")`) | ✅ |
| A3 | **Interpretation — AgentiQ Liquid Glass** (DEFAULT / house style) | `services/representation/interpretations/agentiqLiquidGlass.ts`; registered in `.../interpretations/index.ts` (`DEFAULT_INTERPRETATION_ID`) | ✅ |
| A4 | **Interpretation — Constitutional Civic Futurism** (interpretation v1 / atlas reference grammar) | `services/representation/interpretations/constitutionalCivicFuturism.ts` | ✅ |
| A5 | **Interpretation — High-Contrast Accessible** (accessibility lens) | `services/representation/interpretations/highContrastAccessible.ts` | ✅ |
| A6 | **Palette v1** | **NOT a standalone file.** It is the `COLOR_ROLES` slice (`surface.*`, `ink.*`, `field.*`, `standing.*`, `state.*`, emphasis) of each interpretation in A3–A5 (`types/representation.ts:COLOR_ROLES`). | ⚠️ exists as a role-slice, not an object |
| A7 | **Typography v1** | **NOT a standalone file.** The `TYPE_ROLES` slice (`type.title` / `type.annotation` / `type.mono`) of each interpretation. | ⚠️ exists as a role-slice, not an object |
| A8 | **Iconography v1** | **DOES NOT EXIST.** `CFS-021` §4 explicitly rejects an iconography — "this is not an iconography, it is an **instrument panel** for constitutional reasoning." Named in `CFS-022` §3's compose list but has no source. | ❌ |
| A9 | **metaVitruvian v1** | **DOES NOT EXIST** in code. Named in `CFS-022` §3 as a canonical asset to load; no component, no interpretation, no invariant. Only the string appears (in `CFS-022`, the tracker, `CFS-021`). | ❌ |
| A10 | **Canonical Invariants (seed crystal)** — 141 statements across 12 namespaces | `codexes/packs/ccrl/foundation/canonical-invariants.seed.json`; substrate `services/invariants/store.ts` → tables `invariants`, `invariant_contexts`, `invariant_edges`, `ontology_classes` | ✅ |
| A11 | **Representation invariants** (the 7 that encode the representation system's laws) | seed ids `inv.representation.121–125, 128, 129` inside A10 (e.g. `.128` "CCF is interpretation v1, never the definition"; `.129` material roles) | ✅ |
| A12 | **InvariantQube bundles** (Level-3 published packages) | `services/invariants/publish.ts` → `invariant_qubes` table + staged registry row | ✅ (mechanism live) |

**Headline:** the *invariants* are already full constitutional objects; the *representation assets*
(Bearing, interpretations, contract) are first-class in code and partially mirrored as invariants
(A11) but are **not yet addressable registry objects**. Palette/Typography are **role-slices of
interpretations, not separate assets**. Iconography and metaVitruvian **do not exist** and cannot be
registered until authored.

---

## 1. The reuse surface (grounded)

Three substrates already carry the eight object-model concerns. G2 composes over them; it forks none.

### 1a. Invariant substrate — `services/invariants/*`
- **Store** (`store.ts`) is the *only* reader/writer of `invariants` / `invariant_contexts` /
  `invariant_edges` / `ontology_classes`. Rows carry `standing` (validation-class, Law XII),
  `reach` (adoption), `version`, `supersedesId`, `status`, `provenance`, `creatorAliasCommitment`
  (T2), `dvnReceiptId`. **T0 rule enforced:** `creator_persona_id` is written but never mapped onto
  a returned record (`store.ts:36` comment; `tests/invariant-substrate.test.ts`).
- **Lifecycle** (`lifecycle.ts`): `draft → proposed → validated → canonical`, supersession, standing —
  emits `invariant_validated / _canonized / _superseded` receipts (DVN-anchorable). Persona T0 stays
  in the route layer, passed as an opaque param.
- **Publish** (`publish.ts`): the **staged-registration precedent** to copy (see §3).
- **Graph / grounding / collections / measurement**: dependency edges (12 edge types incl. `composes`,
  `depends_on`, `derives_from`), retrieval, Level-2 collections, standing math.

### 1b. Canonical iQube registry — `services/registry/resolver.ts` + `types/registry-canonical.ts`
- The addressable object plane: `iqube_id_map` (canonical UUID ↔ source/`primitive_type`), resolver +
  admin/cartridge/public **projections** that strip T0 (`tests/registry-authority.test.ts`,
  `tests/registry-projections.test.ts`).
- `IQubePrimitiveType` = `DataQube | ContentQube | ToolQube | ModelQube | AigentQube | ClusterQube`
  (`types/iqube/legibility.ts:28`). **No RepresentationQube / InvariantQube primitive** — both reuse
  `DataQube` with a `metadata.kind` discriminator (invariants already do; see §3).
- `IQubeIdMapSource` (`registry-canonical.ts:467`) already includes `code:*` synthetic sources — the
  precedent for registering a code-resident asset (a chain template, an aigent source) without a table.

### 1c. Registry Ingestion Factory — `services/registry/{persistence,publisherService,trustScorerService,validatorService,lifecycle}.ts`
- A *different* registry: `registry_intakes` / `registry_assets`, `RegistryAssetClass`
  (Tool/Skill/Workflow/Connector/Aigent/Data), `TrustBand` L1–L5, validation stages, review gating,
  `ReceiptQube`. This is for **ingesting external** assets through validation → trust → publish.
- **Design call:** canonical assets are *native* (authored in-repo, already ratified by a CFS), not
  *ingested from an external source through smoke-tests*. Routing them through the ingestion factory
  would force a fake intake + validation run they don't need. **Do not use the ingestion factory for
  canonical assets** — use the invariant substrate (1a) + the canonical iQube id-map (1b), which is
  exactly where `publishInvariantQube` already puts them. (Trust-band vocabulary is reused only as a
  *label mapping*, §2 standing.)

---

## 2. Object-model field mapping — how the 8 fields resolve per asset

The Constitutional Object Model (G1) fields, and where each resolves **today** for each asset:

| Object field | Invariants (A10/A11/A12) | Representation assets (A1–A5) |
|---|---|---|
| **identity** | `invariants.seed_id` (`inv.<ns>.NNN`) + row `id` (UUID); bundle `invariant_qubes.public_ref` (`sha256('invariant_qube:'+rowId)[:16]`, `publish.ts:146`) | **Needs assignment.** Proposal: `asset:representation:<slug>` stable key + a canonical `iqube_id` (UUID) minted in `iqube_id_map`. Slugs: `bearing-instrument`, `interpretation-agentiq-liquid-glass`, `interpretation-constitutional-civic-futurism`, `interpretation-high-contrast-accessible`, `representation-contract`. |
| **version** | `invariants.version` + `supersedes_id`; bundle `invariant_qubes.version` | **Needs a stamp.** No version field on the component/interpretation modules today. Proposal: carry `version` in the id-map row's meta + a `contentHash = sha256(canonical-JSON of the roles / component source)`; supersession via a new row + `supersedes` pointer in metadata. Bearing is "v1.0" only in a test `describe` string — not a data field. |
| **standing** | `invariants.standing` (numeric) + `status` (`draft…canonical`) | Representation has its own `StandingLevel` (`experimental/validated/canonical/foundational`, `types/representation.ts:123`). **Map, don't fork:** a registered representation asset's standing = a `StandingLevel` stored in metadata; a documented crosswalk to invariant `status` and to registry `TrustBand` (L1–L5) lives in §2a. |
| **authority** | `ratified_source` (which CFS ratified it), `ratifiedSource` on record | The ratifying spec: Bearing → `CFS-021` §5; Contract → `CFS-021` §3 + `inv.representation.128`; each interpretation → `CFS-021` §3. Store as `metadata.authority = { spec: 'CFS-021', section, invariant_refs: ['inv.representation.128'] }`. |
| **dependencies** | `invariant_edges` (`depends_on`, `derives_from`, `composes`, …) | Bearing **depends_on** the Contract (it renders only through `useRepresentation().role`) and is **composable_with** any interpretation. Each interpretation **implements** the Contract. Model these as `invariant_edges` between the assets' registered nodes **once representation invariants (A11) are the anchor** — or as a `metadata.dependencies[]` list in Stage 1 (see §3 honesty note). |
| **ownership** | `persona_token_qube_ownership` row (persona_id T0) + `creator_alias_commitment` (T2) | Same table/pattern as `publishInvariantQube` step 4. Canonical assets are **platform-owned**; ownership row uses the platform steward persona (T0, route-layer only) → surfaces as an alias commitment. |
| **provenance** | `provenance` JSON (source doc), `dvn_receipt_id`, `creator_alias_commitment` — **no T0** | **T0-safe by construction:** provenance = `{ authored_by_receipt_id, content_hash, ratified_source }`. **Never** persona/authProfile/rootDid/fio. Registration emits a DVN-anchorable receipt via the existing `createActivityReceipt` seam (route layer), exactly as `publish.ts` step 5. |
| **lifecycle** | `invariant.status` + lifecycle receipts; bundle `status` (`draft/published/superseded`) | Reuse the canonical iQube `IQubeInternalLifecycleState` (`draft/wip/review_pending/published/canonized/deprecated/…`, `registry-canonical.ts:50`) via the id-map row's projection. Canonical assets enter at `published`/`canonized` (they are already ratified). |

### 2a. Standing crosswalk (the one genuinely new mapping)
Three standing vocabularies exist and must be reconciled **by a documented table, not a new column**:

| Representation `StandingLevel` | Invariant `status` | Registry `TrustBand` | Meaning |
|---|---|---|---|
| `experimental` | `draft` / `proposed` | `L1_EXPERIMENTAL` | proposed, unratified |
| `validated` | `validated` | `L3_PRODUCTION_CANDIDATE` | validation-class evidence |
| `canonical` | `canonical` | `L4_PRODUCTION_APPROVED` | ratified canon |
| `foundational` | `canonical` (+ high `standing`) | `L5_CORE_SOVEREIGN` | load-bearing constitutional core |

Canonical assets A1–A5 all enter at **`canonical`** (they are ratified by `CFS-021`); the Contract
(A1) and the invariants that define it (A11) are **`foundational`**.

---

## 3. Registration mechanism — reuse `publishInvariantQube`'s staged pattern verbatim

`services/invariants/publish.ts::publishInvariantQube` is the **canonical Stage-1 registration recipe**
already in production for a *native, code/DB-resident* constitutional object. The Canonical Asset
Registry is **the same recipe applied to representation assets** — a thin adapter, no new store:

```
publishInvariantQube (existing precedent — copy its shape):
  1. draft row in the domain table (invariant_qubes)               → domain payload lives here
  2. createMetaQube(...)  [server/services/iqRegistryService]      → T2 public meta only
  3. iqube_id_map insert { source:'triad_meta',
       primitive_type:'DataQube', notes, metadata.kind:'…' }       → addressable canonical id
  4. persona_token_qube_ownership insert (persona_id T0)           → ownership
  5. createActivityReceipt(actionType:'…_published')  [DVN]        → provenance receipt
  return { record, iqubeId, coherence }
```

### What to reuse exactly (no fork)
- **Step 2/3/5 seams unchanged.** A `registerRepresentationAsset()` adapter calls the *same*
  `createMetaQube` + `iqube_id_map` insert + `createActivityReceipt`. Discriminator:
  `metadata.kind = 'representation_asset'` (mirrors invariants' `metadata.kind = 'invariant_bundle'`).
- **`primitive_type = 'DataQube'`** (no new enum value → no migration, no CHECK change). This is the
  Extend-Don't-Duplicate move invariants already made. A future canonization to a first-class
  `RepresentationQube` primitive is the same "Stage 2" follow-on the invariants doc already defers
  (`publish.ts:6–9`).
- **Invariants need NO new registration at all.** A10/A11 are already objects via `store.ts`; A12 via
  `publish.ts`. G2 for invariants = *surfacing them under one addressable lens*, not re-storing them.

### What genuinely must be added (minimal, honest)
1. **A thin adapter module** (proposed `services/representation/registerAsset.ts`, ~1 file) that:
   builds the canonical-JSON of an asset (an interpretation's `roles`, or a manifest describing the
   Bearing component + its `variant="atlas"` contract), computes `contentHash = sha256(...)`, and calls
   the reused seams above. It does **not** re-implement `createMetaQube` / id-map / receipts.
2. **A registration route** (proposed `POST /api/registry/representation-asset`, admin-gated, mirroring
   `app/api/registry/invariant-qube/route.ts` line-for-line incl. `getActivePersona` + `isAdmin` gate).
3. **An asset descriptor** — the canonical list of A1–A5 (slug, kind, `StandingLevel`, authority spec,
   dependency slugs) so registration is deterministic/idempotent. Proposed as a plain data array
   (`services/representation/canonicalAssets.ts`) — the analogue of `canonical-invariants.seed.json`.
4. **The standing crosswalk** (§2a) as a small pure map — no column, no table.

**No new Supabase table is required for Stage 1.** `iqube_id_map` + `createMetaQube`'s meta record +
`persona_token_qube_ownership` + the activity-receipt seam already carry all eight fields. (A Stage-2
`representation_assets` domain table, analogous to `invariant_qubes`, is optional and deferred — only
needed if we want the full role-binding payload queryable under service-role RLS rather than read from
the TS module. Flagged as an open question, §5.)

---

## 4. Extend-Don't-Duplicate — where reuse is clean vs. where an adapter is honest

**Clean reuse (no new code beyond wiring):**
- **Invariants (A10–A12)** are already constitutional objects. G2 adds *nothing* to their storage; at
  most it registers a "representation asset" node that `derives_from` the representation invariants.
- **The registration recipe** (`createMetaQube` → `iqube_id_map` → ownership → DVN receipt) is proven
  and copied, not forked.
- **Provenance & T0 discipline** come for free: both substrates already keep persona ids in the route
  layer and surface only alias commitments + receipt ids + content hashes — satisfying the T0 constraint
  with zero new enforcement.
- **Lifecycle & projections** reuse `registry-canonical.ts`'s state enum + T0-stripping projections.

**Thin adapter genuinely needed (small, additive):**
- **Representation assets A1–A5 have no version/contentHash/identity data fields today** — they're TS
  modules. The adapter (§3.1) supplies identity + version + contentHash + standing at registration time.
  This is real new code, but it is an *adapter over existing seams*, not a parallel registry.
- **Palette v1 / Typography v1 (A6/A7) are role-slices, not objects.** Registering them as *separate*
  assets would duplicate the interpretation's own data. **Recommendation:** register the **interpretations**
  as the assets; expose palette/typography as **named views** (`COLOR_ROLES` / `TYPE_ROLES` projections)
  of an interpretation, not as independently minted objects. This keeps "one authoritative location."
- **Dependencies between representation assets** (Bearing `depends_on` Contract) are cleanest as
  `invariant_edges` — but that requires the assets to be *invariant* nodes. In Stage 1 they are `DataQube`
  id-map rows, so dependencies live in `metadata.dependencies[]` until a Stage-2 unification. This is the
  one place the model is not yet fully normalised; called out honestly rather than papered over.

**Do NOT build (anti-patterns):**
- A new `canonical_assets` table paralleling `invariants`/`invariant_qubes`/`iqube_id_map`.
- A new `RepresentationQube` primitive_type in Stage 1 (migration + CHECK churn for no Stage-1 benefit).
- Routing native canonical assets through the *ingestion factory* (`registry_intakes` + validation
  stages) — they are authored+ratified, not ingested+smoke-tested.

---

## 5. Open questions for the operator

1. **Palette/Typography granularity.** Register interpretations as the assets and treat Palette v1 /
   Typography v1 as *views* (recommended, §4)? Or does the operator want palette & typography as
   *independently versioned* canonical objects (which means normalising the role-slices out of the
   interpretation files — a real refactor of `services/representation/interpretations/*`)?
2. **metaVitruvian v1 and Iconography v1 do not exist.** `CFS-022` §3 lists both as canonical assets to
   *load* during composition. Iconography is even explicitly *disavowed* by `CFS-021` §4. Should G2 (a)
   drop them from the manifest, (b) register them as `status:'planned'` placeholder objects, or (c) block
   on authoring them first? The Atlas-Plate P2 vertical references metaVitruvian — this needs a decision.
3. **Stage-2 domain table.** Do we want a `representation_assets` table (role payloads queryable under
   RLS, analogous to `invariant_qubes`), or is reading the binding from the TS module (source of truth)
   plus a `contentHash` commitment sufficient? Stage 1 works without it.
4. **Dependency edges.** Accept `metadata.dependencies[]` in Stage 1, or invest now in making
   representation assets first-class *invariant* nodes so `invariant_edges` carries Bearing→Contract
   dependencies natively (cleaner, but couples the representation asset ids to the invariant substrate)?
5. **Standing authority.** The §2a crosswalk asserts A1–A5 enter at `canonical`/`foundational` on the
   strength of `CFS-021` ratification. Confirm that CFS ratification alone confers `canonical` standing,
   or must each asset pass an explicit standing-assignment receipt through `invariants/lifecycle.ts`?
6. **Ownership persona.** Which platform steward persona owns canonical assets in
   `persona_token_qube_ownership`? (T0 — supplied at the route layer; never in the design.)

---

## 6. Concrete P1 build list (for the tracker, not built here)

1. `services/representation/canonicalAssets.ts` — descriptor array for A1–A5 (slug/kind/standing/authority/deps).
2. `services/representation/registerAsset.ts` — adapter reusing `createMetaQube` + `iqube_id_map` +
   `createActivityReceipt` (copy `publish.ts` shape; `metadata.kind='representation_asset'`, `primitive_type='DataQube'`).
3. `app/api/registry/representation-asset/route.ts` — admin-gated register/list, mirroring
   `app/api/registry/invariant-qube/route.ts`.
4. Standing-crosswalk map (§2a) as a pure function; a canary test mirroring `tests/registry-authority.test.ts`
   asserting **no T0 field** appears in any registered representation-asset projection.
5. Resolve open questions §5 (esp. #1, #2) before writing #1–#3.

**Nothing above modifies the frozen files** (`types/*`, `CFS-022`, `services/{dvn,identity,access,receipts}/*`).
Everything composes over `services/registry/*` (id-map + resolver + projections) and `services/invariants/*`
(store + publish precedent). Invariants are already objects; representation assets enter by a thin adapter;
metaVitruvian/iconography await authoring.

---

## Delivered — P1 registry read surface + metaVitruvian registered (2026-07-09)

The in-situ registry is now browsable, and Canonical Asset 002 is registered as a descriptor.

- **metaVitruvian v1 descriptor** (`services/composition/canonicalAssets.ts` `metaVitruvianV1`) — Canonical Asset 002 as a `canonical_asset` ConstitutionalObject, the PAIR to the Bearing Instrument (it declares a dependency on A1). Enters at the `canonical` band (CFS-021 §5 ratification), platform-steward commitment ownership, one-way ref. The descriptor set now holds both standalone canonical assets, not just A1.
- **`listCanonicalAssets()`** — the in-situ registry: A1 Bearing Instrument, A2 metaVitruvian, then the ratified CCF interpretation asset and its palette / typography / material VIEWS (A3–A4). Deterministic order, pure. Same descriptors the Composition engine's `InSituAssetResolver` retrieves — the read surface just projects them.
- **`GET /api/constitutional/canonical-assets`** — admin-gated (resolvePersonaOrTimeout + `cartridgeFlags.isAdmin`; 503/401/403), read-only, T2-safe projection of each asset's P0 facets (id, one-way ref, kind, standing band, governing invariants, provenance source + content commitment, lifecycle, dependency refs). NO payload is serialised wholesale, so a future richer payload can't silently widen exposure.
- **`CanonicalAssetRegistryPanel`** (`components/representation/CanonicalAssetRegistryPanel.tsx`) — mounted in the CCRL dashboard (`CCRLDashboardTab`, where the Bearing Instrument already renders in the header). Consumes only `var(--rep-*)` roles so it reskins with the interpretation; spine-authed via `experimentGet`. The canonical assets are now visible as first-class constitutional objects.

**Honest limits:** still the in-situ source (no G2 store) — the panel projects `listCanonicalAssets()`, the same descriptors the resolver reads; the DB-backed `RegistryAssetResolver` fills the same port later with zero engine change. Verified via esbuild parse on all touched files + an 8-assertion node drill of the registry (6 assets, A1→A2 order, canonical band, one-way refs, metaVitruvian↔Bearing dependency, no T0 leak); vitest is unavailable in the sandbox.
