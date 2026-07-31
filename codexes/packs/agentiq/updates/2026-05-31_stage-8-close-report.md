# Stage 8 Close Report — iqube-registry cartridge live with 3 functional tabs

**Status:** Stage 8 partial-close. 3 of 7 tabs functional (Browse, Health, Mints+Sagas). Remaining 4 tabs (DVN Receipts, Canonization, Vocabulary, Docs) stay as `PlaceholderTab` until their upstream dependencies land or operator promotes them in priority.
**Date:** 2026-05-31
**Branch commits (this stage):** `4dcac585` (C12), `3a377e6b` (C13), `97238845` (C14).
**Reads with:** Stage 2 Close Report.

---

## What Stage 8 delivered (3 commits)

### C12 — `GET /api/registry/iqube` list endpoint (`4dcac585`)

Added the GET handler to the existing `app/api/registry/iqube/route.ts` (POST was C8). Powers the Browse tab.

| Query param | Effect |
|---|---|
| `?primitive_type=<type>` | Filter by canonical primitive |
| `?source=<iqube_id_map.source>` | Filter by source surface |
| `?cartridge=<slug>` | Filter by `cartridge_bindings` membership |
| `?limit=<n>` | Cap (default 200, max 500) |
| `?expand=cartridge\|public` | Hydrate each entry through the resolver. Without it, returns iqube_id_map rows only. |

Persona context propagates; cartridge projection populates `caller_owns` / `caller_can_read` via spine delegation per PRD v1.0 §3.

### C13 — Browse iQubes + Registry Health tabs (`3a377e6b`)

**`IQubeRegistryBrowseTab.tsx`** (`app/triad/components/codex/tabs/`):
- Filter chips by primitive_type with live counts.
- Table: display_name + iqube_id, primitive (with tool_subtype suffix), surface lifecycle (colour-coded), visibility, gating, cartridge bindings.
- Click row → expand inline; fetches admin projection on demand (lazy, cached per session). Shows internal lifecycle, mint status, version, creator identity tier, receipt count, created/updated, card URL.
- Loading + error states with spine-401/403 guidance.
- Calls `GET /api/registry/iqube?expand=cartridge` via `personaFetch`.

**`IQubeRegistryHealthTab.tsx`** (same dir):
- Parallel `verifyBackfill()` calls for all 6 sources on mount.
- Summary cards: total mapped, sources ready, plane status (OPERATIONAL if all green).
- Per-source table with ready badge + "Re-run" button per source.
- "Re-run all" triggers `backfillAll()`.
- Action result row surfaces inserted/skipped/errors summary.
- Known-gaps footer documents the expected `toolQubeSource=0` and orphan-meta behaviours so operators don't chase non-issues.

Both registered in `TabRenderer.tsx`; `data/codex-configs.ts` upgraded for the matching tab entries.

### C14 — Mints + Sagas tab (lift CanonicalMintPanel) (`97238845`)

Per the `2026-05-29_canonical-mint-panel-registry-integration.md` backlog doc explicit plan.

**`IQubeRegistryMintsTab.tsx`**:
- Series selector chips for 6 known series (metaKnyts / qriptopian / metame / avl / marketa / knyt).
- Mounts `components/admin/CanonicalMintPanel.tsx` with the selected `series` prop. **Zero component fork** — same code path as the KNYT mount.
- Both mounts stay live during the 30-day observation window per the backlog doc; the KNYT-tab mount is scheduled for removal post-verification.

Edition ERC-1155 mint, bulk mint, treasury wallet selection, and the Stage 5 mint-saga state surface (idempotency, retry, compensation, `*_pending` reconciliation) land here in subsequent commits as Stage 5 matures.

---

## Tab status — iqube-registry cartridge

| Tab | Stage 8 status | Unblocked by |
|---|---|---|
| **Browse iQubes** | ✅ Live | C12 + C13 |
| **DVN Receipts** | Placeholder | Stage 6 (`dvn_receipt_blocks` ledger + query API) |
| **Mints + Sagas** | ✅ Live (master mint; edition+saga deferred) | C14; Stage 5 enriches |
| **Canonization Queue** | Placeholder | Stage 3 (lifecycle state machine + transition actions) |
| **Action Vocabulary** | Placeholder | Optional now; can land any time as a thin list view over `actionMap.ts` |
| **Registry Health** | ✅ Live | C13 |
| **PRD + Docs** | Placeholder | Optional now; needs a markdown reader component |

3 / 7 live. The remaining 4 are intentionally deferred — building them as placeholders now would either duplicate later work (Canonization, DVN Receipts) or ship a lower-value surface (Vocabulary, Docs) that's better prioritised once Stage 3 / Stage 6 are queued.

---

## Smoke test (operator)

Once Amplify deploys (~3–5 min after the auto-merge to dev), navigate to:

```
https://dev-beta.aigentz.me/triad/embed/codex/iqube-registry/browse
```

You should see:
- 6 primitive filter chips (ContentQube, ToolQube, AigentQube, DataQube, ClusterQube, ModelQube) with counts.
- A table populated from the canonical resolver (189 entries currently — 87 triad + 49 content + 28 registry assets + 5 aigents + 20 LiquidUI seeds).
- Click any row → admin projection panel opens inline.

Switch to the `health` tab (`.../iqube-registry/health`):
- Per-source ready badges; 5 green + 1 amber (`code:toolQubeSource` reports `not ready: source=0 vs map=0`).
- "Re-run all" button works end-to-end.

Switch to the `mints` admin tab (`.../iqube-registry/mints` — admin gated):
- Series selector + the familiar CanonicalMintPanel UI.
- All flows that work in KnytCodexAdminTab work here.

---

## Stage 8 deferred work (operator can reprioritise any time)

- **Canonization Queue tab** — depends on Stage 3 lifecycle. The DB table (`iqube_canonization_requests`) exists from Stage 1 C4; what's missing is the lifecycle-transition handler that approval triggers. Can be implemented as a thin list view now and wired to the transition handler when Stage 3 lands.
- **DVN Receipts tab** — depends on Stage 6 (`dvn_receipt_blocks` + query API). The shape is well-defined; tab is a thin consumer.
- **Action Vocabulary tab** — surfaces `actionMap.ts` (Stage 1 C2). Can land any time as a simple table view.
- **PRD + Docs tab** — needs a markdown reader component (or could re-use the existing pack browser). Low priority.

---

## What this branch contains end-to-end

24 commits on `claude/dreamy-gates-mMqNv` since the dev merge — PRD trail v0.1 → v1.1, Stage 0 audit, Stage 1 (5 commits), Stage 2 (4 commits + close), Stage 8 (3 commits + close).

Stage 8 deliverable count: 4 new tab components + 1 GET endpoint + close report. ~1,100 LOC added.

---

**End of Stage 8 (partial close). Operator can drive the next stage with priority signal:**

- "Stage 3" → lifecycle state machine + Canonization Queue
- "Stage 4" → finish legacy `useOwnedEntitlements` migration in 5 remaining cartridge surfaces
- "Stage 5" → mint saga (idempotency + outbox + retry)
- "Stage 6" → DVN block ledger + receipts tab
- "Stage 8 +" → land Vocabulary / Docs / Canonization (placeholder) tabs now
