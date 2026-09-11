# Resolver Skipped-Inventory + iqube_id_map Cleanup — Backlog

**Date:** 2026-05-31
**Status:** Backlog. Filed in response to the `/registry` blank-screen incident (commit `f41e43a9`).
**Triggered by:** Legacy `/registry` page rendered empty grid despite 101 valid canonical records existing, because the first ~50 rows in `iqube_id_map` are unresolvable and the resolver silently dropped them.

---

## What happened

The legacy `/registry` adapter requested `GET /api/registry/iqube?expand=cartridge&limit=50` (page 1 × limit 12, floored to 50). The resolver:

1. Read 50 rows from `iqube_id_map` (`ORDER BY` default — effectively insert order)
2. Ran `Promise.all` over them calling `resolveIQube(id)` per row
3. Each `resolveIQube` is wrapped in `.catch(() => null)` to keep the batch alive when a single record fails
4. Filtered nulls from the response: `entries: expanded.filter(v => v !== null)`

All 50 rows in that first window failed to resolve (broken triad refs, missing `source_id`, adapter mismatch, etc.). The route returned `{ entries: [], skipped: 50 }` and the page rendered blank.

Same call at `limit=300` returned 101 entries + 199 skipped — 33% loss rate. At `limit=500` (cartridge Browse tab) the same.

**Symptoms during incident:**
- `/registry` blank
- Cartridge Browse tab worked (uses higher limit)
- Score Coverage health tab worked (different code path)
- Curl from CLI worked at `limit=300+`
- Curl from CLI at `limit=50` returned `entries: []`

**Hot-fix (shipped commit `f41e43a9`):** raise the adapter's limit floor from 50 to 500 so the page always fetches the full window. Sidesteps the issue but doesn't surface or fix the underlying broken rows.

---

## Root cause

Two stacked issues:

### 1. Silent swallowing in the resolver list route

`app/api/registry/iqube/route.ts` lines 188–199:

```ts
const expanded = await Promise.all(
  result.entries.map((entry) =>
    resolveIQube(entry.iqube_id, { persona, projection, allowPrivate })
      .catch(() => null),
  ),
);

return NextResponse.json({
  entries: expanded.filter((v) => v !== null),
  total: expanded.filter((v) => v !== null).length,
  skipped: expanded.filter((v) => v === null).length,
});
```

The route reports a `skipped` count but NOT the inventory of which `iqube_id` rows failed or why. The operator has no actionable trail to find + clean up the broken rows.

### 2. Broken rows clustered at the head of `iqube_id_map`

Likely sources of the broken-row cluster (no audit yet):
- Stage 0 → Stage 1 backfill migration created `iqube_id_map` rows pointing at triad meta that no longer exists
- Early development churn left orphan rows
- `synthetic: true` rows whose adapters were removed or renamed
- `legacy_primitive_type` mismatches between map row and the underlying record

The skipped rate (~33% across the full window) suggests the broken set is substantial and grows with every dev iteration that touches the canonical schema without cleaning up id-map entries.

---

## Proposed fix

### Phase 1 — Resolver surfaces a skipped inventory (small, low-risk)

`app/api/registry/iqube/route.ts`:

```ts
const expanded = await Promise.all(
  result.entries.map(async (entry) => {
    try {
      const view = await resolveIQube(entry.iqube_id, { persona, projection, allowPrivate });
      return { ok: true as const, iqube_id: entry.iqube_id, view };
    } catch (err) {
      return {
        ok: false as const,
        iqube_id: entry.iqube_id,
        source: entry.source,
        source_id: entry.source_id,
        primitive_type: entry.primitive_type,
        error: (err as Error).message,
      };
    }
  }),
);

return NextResponse.json({
  entries: expanded.filter(r => r.ok).map(r => r.view),
  total: expanded.filter(r => r.ok).length,
  skipped: {
    count: expanded.filter(r => !r.ok).length,
    sample: expanded.filter(r => !r.ok).slice(0, 20),  // first 20 for triage
    by_error: groupBy(expanded.filter(r => !r.ok), r => r.error),
  },
});
```

Backwards compatible: existing consumers reading `entries` + `total` keep working. New `skipped` shape is additive.

### Phase 2 — Health tab Skipped-Rows section

`app/triad/components/codex/tabs/IQubeRegistryHealthTab.tsx`:

- New "Resolver Skipped Rows" section next to Score Coverage
- Shows: skipped count over full window + top 5 error messages + sample of 10 broken `iqube_id` rows
- Each row has a "Inspect" button that opens the raw `iqube_id_map` JSON + the underlying triad row (or "missing")
- "Mark for cleanup" button writes the row's id to a `iqube_id_map_cleanup_queue` table for the operator workstream

### Phase 3 — Cleanup workstream

One-shot operator script `scripts/cleanup-broken-iqube-id-map.mjs`:

1. List every row in `iqube_id_map_cleanup_queue` (operator-flagged) OR scan the full table fresh
2. For each row, attempt `resolveIQube`
3. On failure, categorise:
   - **`triad_missing`** → the row's `source_id` doesn't exist in `iq_meta_qubes` → delete the id-map row
   - **`adapter_mismatch`** → the row's `primitive_type` has no adapter → delete or rewrite the row
   - **`synthetic_orphan`** → `synthetic: true` row whose generator is gone → delete
   - **`unknown`** → preserve + log for operator review
4. Print a dry-run report; operator reviews; `--apply` flag commits the deletes
5. Each delete emits an `orchestration_events` row with `event_type='id_map_row_pruned'` for audit

### Phase 4 — Resolver list ordering (small, optional)

`services/registry/resolver.ts::listIQubes`:

```ts
let query = sb.from('iqube_id_map').select('*').limit(filter.limit ?? 200);
// Prefer the most recent rows first; broken legacy rows tend to be old.
query = query.order('created_at', { ascending: false });
```

Reduces the dead-zone problem at low limits even if cleanup is delayed. Worth pairing with the cleanup workstream so the legacy rows have a chance to be triaged before they're shifted out of the default window.

---

## Why this matters

| Surface | Risk today |
|---|---|
| Legacy `/registry` | Blank screen at low limits; **fixed by hot-fix (`f41e43a9`)** raising adapter floor to 500 |
| Cartridge Browse tab | Renders silently with 33% missing data — operators don't know data is dropped |
| Score Coverage | Coverage % is computed against `iqube_id_map` total but scored set excludes broken rows → coverage looks artificially low |
| Phase B audit events | Every `iqube_edited` / `iqube_forked` / `iqube_revoke_requested` event carries `iqube_id` — if the id-map row is broken, the receipt is correlated but the resolver can't load it |
| Phase C cleanup | Hard-delete of `/api/registry/templates/*` becomes risky if the canonical resolver is silently dropping records |

The hot-fix unblocks operators today but doesn't solve the underlying data integrity issue.

---

## Acceptance criteria

- [ ] `/api/registry/iqube?expand=cartridge` returns `skipped: { count, sample, by_error }` instead of a bare count
- [ ] Health tab shows skipped count + error-category histogram + sample of broken `iqube_id` rows
- [ ] Cleanup script runs in dry-run mode, prints the planned actions, and only writes with `--apply`
- [ ] After cleanup, fresh `GET /api/registry/iqube?expand=cartridge&limit=50` returns ≥40 entries (i.e., dead-zone resolved at the head of the table)
- [ ] Adapter limit floor in `legacyAdapter.legacyFiltersToCanonicalParams` can be returned to a smaller value (e.g. 100) after cleanup confirms it's safe

---

## Out of scope

- Schema changes to `iqube_id_map`
- Real server-side pagination on the resolver list (separate Phase B+ workstream flagged in the integration plan)
- Auto-cleanup on every resolve failure (too aggressive — the broken rows might be temporarily unresolvable due to env config, not permanently broken)

---

## Files touched (when picked up)

- `app/api/registry/iqube/route.ts` — return enriched `skipped` inventory
- `services/registry/resolver.ts` — optional list ordering
- `app/triad/components/codex/tabs/IQubeRegistryHealthTab.tsx` — new Skipped Rows section
- `scripts/cleanup-broken-iqube-id-map.mjs` — operator cleanup script
- `services/registry/legacy/legacyAdapter.ts` — restore lower limit floor after cleanup

---

**End of backlog.**
