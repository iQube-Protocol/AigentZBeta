# PRD v1.1 Guardrail Addendum: Operator Decisions + Implementation Guardrails

**Status:** Implementation-gating addendum to v1.0. Both v1.0 + this v1.1 must be read together by any implementer. Stage 0 (audit) **MAY begin** after this addendum lands; Stage 1 schema work begins only after the Stage 0 audit report.
**Date:** 2026-05-30
**Reads with:** `2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.0.md`
**Predecessors (review trail, retained):** v0.1, v0.2 addendum, v0.3 alignment, v1.0.
**Authorizes:** Stage 0 audit only. Stage 1+ requires audit-report sign-off.

---

## A. Operator decisions — confirmed answers to v1.0 §14 open questions

The 8 open questions from v1.0 §14 are resolved. These become normative for implementation.

### A.1 Registry cartridge slug + nav — CONFIRMED standalone + deep-link

- **Standalone cartridge slug:** `iqube-registry`
- **AgentiQ OS Registry tab:** remains, deep-links to the standalone cartridge
- **Navigation:** `iqube-registry` is a top-level cartridge in the codex shell
- **Inter-cartridge nav:** uses `buildCodexUrl('iqube-registry', { tab, personaId, from, fromTab })` per CLAUDE.md
- **Action:** Add `iqube-registry` to the codex slug registry in Stage 0 as a documented prerequisite. Operator approves the cartridge config before Stage 6 (Cartridge migration).

### A.2 `LiquidUITemplateArchetypeQube` — DROPPED + reclassified

- **Operator clarification:** "LiquidUITemplateArchetypeQube would simply be a type of ContentQube or DataQube."
- **Action:** Remove from `types/registry.ts::IQubeType`. Existing records (if any) reclassify under `ContentQube` (when the artefact is a renderable surface) or `DataQube` (when it's a schema / template definition with no payload).
- **Migration in Stage 1:** add a `legacy_primitive_type` column to `iqube_id_map` for one rev so a downgrade is possible; lookup table for the reclassification decision per existing row reviewed by operator.
- **Note for §A.5 (cluster):** template-vs-instance relationships that were modeled as "archetype + instance" become `template_lineage` entries (existing field) — no new cluster needed.

### A.3 Persona ↔ TokenQube link — NEW JOIN TABLE

- **Confirmed:** new `persona_token_qube_ownership` join table for clean ownership history.
- **Schema (Stage 1):**
  ```sql
  CREATE TABLE persona_token_qube_ownership (
    ownership_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id      TEXT NOT NULL,             -- T0; RLS-gated; never returned in JSON
    token_qube_id   TEXT NOT NULL REFERENCES iq_token_qubes(id),
    iqube_id        TEXT NOT NULL,             -- the canonical iQube the TokenQube entitles
    chain_anchor    JSONB,                     -- { chain_id, contract, token_id, tx_hash }
    acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    relinquished_at TIMESTAMPTZ,               -- NULL = currently owned; set on transfer/revoke
    source          TEXT NOT NULL,             -- 'mint' | 'transfer' | 'gift' | 'backfill'
    receipt_id      TEXT,                      -- → orchestration_events
    UNIQUE (token_qube_id, persona_id, acquired_at)
  );
  CREATE INDEX idx_pt_qube_persona ON persona_token_qube_ownership(persona_id) WHERE relinquished_at IS NULL;
  CREATE INDEX idx_pt_qube_iqube   ON persona_token_qube_ownership(iqube_id);
  ```
- **Authority rule:** This table is a **read substrate** for `services/rewards/assetOwnership.ts::userOwnsAsset()`. Callers consult `userOwnsAsset`, never this table directly. CI grep gate (added to Stage 2.5) blocks direct SELECTs from registry path code.

### A.4 Receipt-writer deprecation — 30-DAY OBSERVATION WINDOW

- **Confirmed:** 30 days.
- **Stage 6 protocol:**
  - Day 0: Stage 6 lands. `orchestration_events` becomes canonical writer for non-content primitives. `services/registry/receiptEmitter.ts` and `clawhack-group-agents/bridge-core/dvnReceiptService.ts` continue dual-writing.
  - Day 0–30: nightly reconciliation report — counts + sample diffs. Flag any discrepancy in #qubetalk-dev-exec.
  - Day 30: if zero unresolved diffs, deprecation PR removes the parallel writers. If diffs exist, window extends until clean. No silent removals.

### A.5 DVN block sealer cadence — CONFIRMED 1000 items OR 1 hour, per cartridge scope

- **Confirmed default:** seal on whichever threshold triggers first.
  - `BLOCK_SIZE_THRESHOLD = 1000` items
  - `BLOCK_TIME_THRESHOLD_MS = 3_600_000`
- **Per cartridge scope** — `platform` is its own scope; each cartridge has its own block ledger.
- **Operator override:** `dvn_block_sealer_config` JSONB column on a `registry_config` table (read at worker start) allows per-cartridge overrides without redeploy.

### A.6 Action-vocabulary management — REGISTRY CARTRIDGE ADMIN TAB

- **Confirmed:** the iQube Registry cartridge admin tab is the logical surface.
- **Review gate workflow:**
  1. Engineer proposes a new `IQubeAgentAction` verb in a draft PR.
  2. PR description includes the §4.3 internal↔surface mapping row.
  3. Registry cartridge admin tab surfaces a "Pending vocabulary additions" queue (operator-only).
  4. Operator approves → mapping table updated in `services/iqube/legibility/cardBuilder.ts`.
  5. Without approval, the verb is not merged. CI gate validates the mapping table covers every verb in `IQubeAgentAction` and every `AccessAction` has a documented mapping (or explicit "internal-only" annotation).
- **Stage 8 surface work:** the admin tab is built in Stage 8 (Cartridge migration); the review gate is enforced via CI from Stage 2 onward (no merges without mapping).

### A.7 Canonization approval queue — REGISTRY CARTRIDGE ADMIN TAB

- **Confirmed:** registry cartridge admin tab.
- **Approval workflow:**
  - `iqube_canonization_requests(request_id, iqube_id, requester_persona_id, requested_at, status, decided_by_persona_id, decided_at, notes)` table.
  - Operator (or `cartridgeFlags.isAdmin`-bearing persona) sees pending requests in the registry cartridge admin tab.
  - Approval triggers the `published → canonized` lifecycle transition (per §6.1), which emits the sync DVN receipt.
  - Rejection routes back to `wip` (per §6 state graph).
- **Audit:** every approval / rejection emits an `orchestration_events` receipt with `action='canonize'` (new internal action) or `action='policy-escalation'` for rejections.

### A.8 Legibility v0.1 fast-follow ordering — CONFIRMED

- **Stage 7 (this PRD)** covers legibility fast-follow #1 (retrofit cards) + #2 (auth-aware AigentQube cards).
- **Separate ticket post-Stage 7** handles legibility fast-follow #3 (ToolQube/AigentQube DB tables) + #4 (cross-card relations bag).
- **Stages 2 / 3 / 5 / 6 tests** subsume legibility fast-follow #6 (full route-level integration coverage).
- **Legibility fast-follow #5 (IANA submission)** remains deferred — post-Phase-1 ecosystem stabilization decision.

---

## B. Implementation guardrails — 8 net additions to v1.0

These are net-new acceptance criteria and procedural rules. Each maps to the reviewer's guardrail list.

### B.1 Stage -1: Operator decisions

A formal Stage -1 is inserted before Stage 0. **Stage -1 is closed by this addendum landing** (§A confirms every decision). No further operator gate needed before Stage 0 audit begins.

**Stage -1 closure checklist (this addendum satisfies):**

- [x] Registry cartridge slug + nav confirmed (§A.1)
- [x] `LiquidUITemplateArchetypeQube` dropped + reclassified (§A.2)
- [x] Persona ↔ TokenQube join table approved (§A.3)
- [x] 30-day receipt-writer deprecation window approved (§A.4)
- [x] DVN block sealer cadence (1000 / 1h per cartridge scope) approved (§A.5)
- [x] Action-vocabulary review gate location (registry admin tab) confirmed (§A.6)
- [x] Canonization approval queue location confirmed (§A.7)
- [x] Legibility fast-follow ordering confirmed (§A.8)

Stage 0 audit may now begin.

### B.2 Surface lifecycle naming — clarify `published` ↔ `canonized`

**v1.0 §4.3 mapping** says internal `published` → surface `canonized`. The reviewer correctly flagged that this risks making the two governance states feel identical externally.

**Clarification (normative, add to `services/registry/lifecycle.ts` doc-comment AND `docs/iqube-agent-legibility-profile.md` after this addendum lands):**

> Surface `canonized` means **"agent-discoverable authoritative surface"**, not necessarily "fully canonized by governance." Internal `published` and `canonized` remain distinct governance states: `published` is "ready for agent consumption, not yet operator-canonized." `canonized` is "operator-approved, governance-locked, version-permanent."
>
> Internally these states differ in:
> - `published`: can transition to `wip` via a fast-track edit (re-review), to `deprecated`, or to `canonized` via the approval queue (§A.7).
> - `canonized`: cannot return to `wip` or `published`. Only `deprecated`, `revoked`, or `new_version_pending`.
>
> The surface enum collapses both to `canonized` because the agent-facing distinction (governance status) is not part of the legibility contract. Operator and cartridge views (`RegistryAdminView`, `RegistryCartridgeView`) preserve the distinction via `internal_lifecycle`.

**Action:** Add a CI test (`tests/registry-lifecycle-clarity.test.ts`) asserting that any UI surface labeled "Canonized" reads from `internal_lifecycle === 'canonized'`, never from `surface_lifecycle === 'canonized'`. Operator and cartridge views must surface the distinction; only the agent card collapses.

### B.3 Migration ordering — resolver read paths gated by backfill

**Normative rule (Stage 1 + Stage 2):**

> Do not switch any read path to `resolveIQube()` until the relevant source surface has:
> 1. An idempotent `iqube_id_map` backfill complete (re-runnable; matches source-row count).
> 2. A duplicate-detection report run with zero unresolved collisions (or all collisions reviewed and resolved with explicit operator merge decisions).
> 3. A backfill verification query that returns 100% match between source rows and `iqube_id_map` rows.

**Per-surface backfill gate:**

| Source surface | Gate before resolver flip |
|---|---|
| `iq_meta_qubes` (triad) | Backfill complete + dedupe report green |
| `registry_assets` (ingestion) | Backfill + `tool_subtype` migration complete + dedupe green |
| `content_qubes` | Backfill complete + dedupe green |
| `master_content_qubes` / `codex_media_assets` (legacy bridge) | Backfill complete; Phase B migration of remaining cartridge surfaces complete |
| AigentQube source (`RUNTIME_AGENT_IDS` + hand-seed) | Backfill via `aigentQubeSource.ts` reading; deferred to fast-follow ticket #3 for DB-table promotion |
| ToolQube source (`openclawCore`) | Same — `toolQubeSource.ts` continues live read; DB promotion is fast-follow #3 |

**Stage 2 acceptance gate:** Each per-surface gate must show green in CI before that surface's reads are migrated.

### B.4 RLS acceptance criteria — explicit

Add to v1.0 §11 (Acceptance Criteria):

- [ ] RLS policies exist for `iqube_id_map`, `persona_token_qube_ownership`, `mint_sagas`, `dvn_receipt_blocks`, `dvn_receipt_block_items`, `iqube_canonization_requests`, `registry_config`.
- [ ] No `anon` or `authenticated` role can `SELECT` `creator_persona_id`, `steward_persona_id`, or any other T0 field from canonical backing tables.
- [ ] Public reads route only through the shipped legibility routes (`/.well-known/iqube-catalog`, `/api/iqubes/[id]/{card,policy,actions}`) OR through `resolveIQube({ project: 'public' })`.
- [ ] Service-role queries (server-side, behind auth middleware) are the only path to internal-projection records.
- [ ] CI grep gate: any `from('iq_meta_qubes')` / `from('persona_token_qube_ownership')` / `from('mint_sagas')` call in code paths flagged as `'client-bundled'` fails the build.

### B.5 Deletion / retention policy

The lifecycle has terminal `revoked` / `abandoned` and intermediate `deprecated` / `archived` (surface). Retention semantics, normative:

| State | Retention | Card behavior | Receipt behavior |
|---|---|---|---|
| `canonized` | Append-only; never deleted | Full card; `dvn_required_for_state_change=true` | All receipts retained indefinitely |
| `published` | Append-only while in this state | Full card | All receipts retained |
| `deprecated` | Retained for audit; not surfaced in catalog | Tombstone card (see below) | All receipts retained |
| `revoked` | Retained for audit; locked | Tombstone card | All receipts retained; revocation receipt mandatory |
| `archived` (surface) | Same as revoked or abandoned per internal state | Tombstone card OR 404 per privacy rules | Retained |
| `abandoned` (WIP, never minted/canonized) | Hard-deletable after 90-day retention window IF no receipts exist | 404 | n/a (no receipts emitted) |
| `wip` / `draft` | Retained while creator persona is active | 404 (private) | Limited (no canonical events) |

**Tombstone card schema (normative; addition to `types/iqube/legibility.ts` via extension):**

```ts
interface IQubeTombstone {
  type: 'iQubeTombstone';
  version: '0.1';
  iqube_id: string;
  primitive_type: IQubePrimitiveType;
  surface_lifecycle: 'deprecated' | 'archived';
  tombstoned_at: string;
  reason_class: 'deprecated' | 'revoked' | 'superseded';
  superseded_by?: string;             // iqube_id of replacement, when reason_class='superseded'
  registry: { canonical_url: string };
  // No metaqube, no access, no actions block.
}
```

Card route behavior for tombstoned records:
- `GET /api/iqubes/<id>/card` returns the tombstone card (HTTP 200, `Content-Type: application/iqube-card+json`) **unless** the iQube's pre-tombstone visibility was `private` — in which case 404 (existence not leaked).
- `GET /api/iqubes/<id>/policy` returns 410 Gone with a minimal body referencing the canonical URL.
- `GET /api/iqubes/<id>/actions` returns 410 Gone.
- `/.well-known/iqube-catalog` does NOT enumerate tombstoned records by default; query parameter `?include_tombstoned=true` opts in.

**BlakQube reference rule:**

- BlakQube ciphertext storage references in tombstoned records are **tombstoned, not removed**, if any receipts exist for that iQube. This preserves audit-chain integrity for past `read_payload` events.
- If no receipts ever existed AND the record is `abandoned`, the BlakQube reference may be hard-removed during the 90-day cleanup. Cleanup is itself receipt-emitting (`action='disclosure'`, mode `'sync'`, body: `{ reason: 'abandoned_cleanup', iqube_id }`).

### B.6 AigentQube payment authority — defaults + enforcement

The `aigent.governance.rights.payment_authority` field in §5.1 is optional today. Tighten:

**Defaults (normative):**

- Default `payment_authority = null` (no spend authority).
- Any non-null `payment_authority` requires explicit operator approval at AigentQube registration time. Implementation: the `iqube_canonization_requests` queue (§A.7) gains a `payment_authority_proposed` field; the approval queue surfaces it as a separate confirmation step in the admin tab.
- Changes to existing `payment_authority` (raise / lower / revoke) emit a sync DVN receipt (`action='policy-escalation'`).

**Enforcement (normative):**

- Period counters (per-tx max, per-day/week/month max) are NOT enforced by the card or the registry resolver.
- Enforcement lives in the **runtime payment policy service** (server-side, at the moment of spend). The card's `payment_authority` is the **policy declaration**; the runtime is the **policy enforcer**.
- The runtime payment service is out of scope for this PRD; it must exist before any non-null `payment_authority` is approved in production. Tracked as Phase 2 dependency.
- Stage 7 implementation surfaces `payment_authority` on the card; gate-keeping that it's enforced at runtime is a Phase 2 acceptance criterion, not Phase 1.

**Card display rule:**

- AigentQube cards with `payment_authority != null` carry a `requires_human_approval` entry on EVERY mutating action verb until the runtime payment policy service ships. The card builder enforces this defensively.

### B.7 DVN block sealer — concurrency + idempotency

The block sealer worker (Stage 6) must be race-free under concurrent receipt writes.

**Normative requirements:**

1. **Advisory lock on the open block per cartridge scope.** When appending a `dvn_receipt_block_items` row, acquire `pg_advisory_xact_lock(hashtext(cartridge_scope || ':' || block_number))` for the duration of the append transaction. Releases on commit/rollback.
2. **Unique partial index enforcing single open block per cartridge scope:**
   ```sql
   CREATE UNIQUE INDEX uq_dvn_blocks_one_open_per_scope
     ON dvn_receipt_blocks(cartridge_scope)
     WHERE status = 'open';
   ```
   Any attempt to open a second block for the same scope fails immediately at the DB layer.
3. **Deterministic block ordering** — `block_number` is monotonically increasing per `cartridge_scope`. The `(cartridge_scope, block_number)` UNIQUE constraint already in §8.2 enforces this; the sealer must increment atomically (`SELECT max(block_number) + 1 FROM dvn_receipt_blocks WHERE cartridge_scope = ? FOR UPDATE`).
4. **Idempotent item insertion** — `(block_id, receipt_source, receipt_id)` triple is unique per block. Add:
   ```sql
   ALTER TABLE dvn_receipt_block_items
     ADD CONSTRAINT uq_block_item UNIQUE (block_id, receipt_source, receipt_id);
   ```
   `INSERT ... ON CONFLICT DO NOTHING` for retries. Sequence-in-block is assigned at the same row's insert moment.
5. **Sealer worker safety** — the worker that closes blocks (transitions `open → sealed`) runs on a single process with leader election (or a Postgres advisory lock keyed `'dvn_block_sealer:' || cartridge_scope`). Two sealers must never compete for the same scope.
6. **Sealed-block content hash** — `batch_hash` is computed as `sha256(sorted(item_hash[0..N-1]))` where items are sorted by `sequence_in_block`. Deterministic; verifiable on replay.

### B.8 Shipped legibility routes — backward compatibility CI gate

Appendix A of v1.0 names shipped routes as frozen. Make that a CI gate, not a convention.

**Add to v1.0 §11 acceptance criteria:**

- [ ] `tests/iqube-legibility-compat.test.ts` (new) holds response-shape snapshots for `/.well-known/iqube-catalog` and `/api/iqubes/[id]/{card,policy,actions}` against representative ContentQube, ToolQube, AigentQube records. Any field rename or removal fails the test.
- [ ] Schema extensions are additive only. New fields appear; existing fields keep their type + name + nullability through v1.x.
- [ ] Zod schemas in `services/iqube/legibility/schemas.ts` may be extended (new optional fields) but never have existing fields tightened (no `optional() → required()`, no widened enums removed). Schema version `'0.1'` stays the literal until a coordinated v0.2 schema release.
- [ ] Any change touching `services/iqube/legibility/{schemas,cardBuilder,registry}.ts` OR `app/api/iqubes/**` OR `app/.well-known/iqube-catalog/**` requires the compat test to pass in CI.

---

## C. Updated Implementation Plan — Stage-by-Stage Deltas

v1.0 §10 stages remain. Per-stage additions:

| Stage | v1.0 scope | v1.1 additions |
|---|---|---|
| Stage -1 | n/a | **Closed by this addendum.** §A confirms every decision. |
| Stage 0 | Audit | + Stage 0 produces a per-surface backfill-gate readiness report per §B.3. Audit doc commits with the readiness matrix. + Confirm `iqube-registry` cartridge slug is reserved. + Identify any existing `LiquidUITemplateArchetypeQube` rows for §A.2 reclassification. |
| Stage 1 | Schema | + Drop `LiquidUITemplateArchetypeQube` from `IQubeType`. + Add `legacy_primitive_type` column to `iqube_id_map`. + Create `persona_token_qube_ownership`, `iqube_canonization_requests`, `registry_config` tables. + RLS policies for all new tables (§B.4). |
| Stage 2 | Resolver + projections | + Enforce per-surface backfill gate (§B.3) before flipping each read path. + Add CI grep gate blocking direct SELECTs from canonical backing tables in client-bundled code (§B.4). + Add response-shape compat tests for shipped legibility routes (§B.8). |
| Stage 2.5 | Authority tests | + Property test asserts no `from('persona_token_qube_ownership')` call exists outside `services/rewards/assetOwnership.ts` (§A.3). |
| Stage 3 | Lifecycle | + Doc-comment clarification on `published` ↔ `canonized` (§B.2). + `tests/registry-lifecycle-clarity.test.ts`. |
| Stage 4 | ContentQube migration | (unchanged) |
| Stage 5 | Minting + saga | + Persona ↔ TokenQube link table writes on mint (§A.3). + `payment_authority` field on AigentQube cards defaults to `null`; non-null requires approval queue routing (§B.6). |
| Stage 6 | DVN receipt index + block model | + Block sealer concurrency rules per §B.7 (advisory lock, unique partial index, idempotent item insert, leader election). + 30-day dual-write observation window per §A.4. + Block sealer cadence: 1000 items OR 1 hour per cartridge scope, with `registry_config` override (§A.5). + Retention/tombstone behavior on card routes (§B.5). |
| Stage 7 | AigentQube governance + legibility extension | + `payment_authority` card-display rule: `requires_human_approval` defensively populated on mutating verbs until runtime payment service ships (§B.6). + Tombstone card schema additions (§B.5). |
| Stage 8 | Cartridge migration | + `iqube-registry` cartridge config landed; nav position confirmed. + Action-vocabulary review queue surfaced in admin tab (§A.6). + Canonization approval queue surfaced in admin tab (§A.7). + Cartridge-tab build for `RegistrySupplyTab` updated to read from canonical resolver. |
| Stage 9 | Phase 2 stubs | + Runtime payment policy service interface stub at `services/runtime/paymentPolicy.ts` referenced by AigentQube `payment_authority` (§B.6). |

---

## D. Updated Acceptance Criteria — v1.0 §11 + this addendum

Adding to v1.0 §11:

- [ ] Stage -1 closure checklist (§B.1) is committed to the audit report.
- [ ] `LiquidUITemplateArchetypeQube` removed from `IQubeType`; reclassification migration committed with operator-reviewed lookup table.
- [ ] `persona_token_qube_ownership` table exists with RLS; `userOwnsAsset()` is the only caller; CI grep gate enforced.
- [ ] 30-day receipt-writer dual-write observation window completes with nightly reconciliation report showing zero unresolved diffs before deprecation PR merges.
- [ ] DVN block sealer enforces single-open-block-per-scope via unique partial index; advisory locks tested under concurrent load.
- [ ] Action-vocabulary review queue + canonization approval queue both surface in the registry cartridge admin tab.
- [ ] `published ↔ canonized` clarification documented in `services/registry/lifecycle.ts` doc-comment AND `docs/iqube-agent-legibility-profile.md`.
- [ ] Per-surface backfill gate (§B.3) green for each surface before its reads flip to the canonical resolver.
- [ ] All seven new tables (§B.4) have RLS policies; no public role selects T0 fields.
- [ ] Tombstone card / 410 behavior tested for deprecated and revoked records; abandoned-record 90-day cleanup emits disclosure receipt.
- [ ] AigentQube `payment_authority` defaults to `null`; non-null requires approval queue routing; runtime payment policy service stub exists at `services/runtime/paymentPolicy.ts`.
- [ ] Shipped legibility-route response-shape compat tests pass in CI; new fields are additive only.

---

## E. What this addendum does NOT change

To prevent scope creep before Stage 0 begins:

- The two-resolver model from v1.0 §9 is unchanged.
- The Source-of-Authority Matrix from v1.0 §3 is unchanged.
- Internal vs surface enum mapping tables from v1.0 §4 are unchanged.
- The 9-state internal lifecycle from v1.0 §6 is unchanged (only the surface-mapping doc-comment clarification in §B.2).
- The mint saga from v1.0 §7 is unchanged.
- The `orchestration_events` ↔ `content_qube_dvn_receipts` separation from v1.0 §8 is unchanged.
- Phase 2 scope from v1.0 §13 is unchanged.

---

## F. Authorization for Stage 0

By the closure of §B.1 and the operator confirmations in §A:

**Stage 0 (audit) is authorized to begin.**

Stage 0 deliverables (audit report committed to `codexes/packs/agentiq/updates/`):

1. Per-surface backfill readiness matrix (§B.3 table populated with actual row counts + dedupe samples).
2. List of any existing `LiquidUITemplateArchetypeQube` records with proposed reclassification (§A.2).
3. Per-cartridge table of current iQube-rendering surfaces vs. resolver shape (v1.0 Stage 0 ask).
4. Verification of action-vocabulary mapping completeness in `cardBuilder.ts`.
5. Confirmation that `iqube-registry` cartridge slug is reserved.
6. Identification of any `app/api/registry/iqube/` route stubs beyond the known mock at `route.ts`.
7. Confirmation of which `services/registry/receiptEmitter.ts` and `bridge-core/dvnReceiptService.ts` call sites need dual-write coverage for the 30-day window.

Stage 1+ requires audit-report sign-off. The audit report is itself a separate doc, not folded into this PRD.

---

## Appendix — Cross-references

- v1.0: `codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.0.md`
- Legibility surface (frozen contract): `docs/iqube-agent-legibility-profile.md`
- Identity-spine policy: `CLAUDE.md` § "Identity & Access Spine — CANONICAL SoT"
- Q¢ pricing rules: `CLAUDE.md` § "Q¢ (Q-cent) Pricing — Canonical Conversion"
- Multi-agent coordination: `CLAUDE.md` § "Multi-Agent Coordination"

---

**End of v1.1 guardrail addendum. Stage 0 audit may begin.**
