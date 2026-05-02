# Bundle Image Mapping — Operator-Editable (Backlog)

**Date raised:** 2026-05-01
**Status:** backlog — not yet implemented
**Operator request:** "(c) Add a new bundle_image_kind column or a lookup-by-variant-name. Heaviest, only worth it if you want this to be operator-editable later — add this to the backlog."

## Context

The first cut of bundle hero imagery (shipped 2026-05-01) maps bundle SKUs to
tier images (`bronze` / `silver` / `gold`) using a constant in code:

- `BUNDLE_ID_TO_TIER` in `app/triad/components/codex/tabs/useBundleImages.ts`
- `/api/knyt/bundle-images` resolves the three tier URLs by matching the
  `codex_media_assets.supabase_title` (or `title`) against the literal strings
  `bundle_bronze` / `bundle_silver` / `bundle_gold`.

This works but means **every change to which bundle uses which image (or to
add a new tier) requires a code edit + redeploy**. The operator wants this to
be editable from the Codex Manager admin UI eventually.

## Suggested implementation

### Option A — `bundle_image_kind` column on `codex_media_assets`

Add a small text column that the Codex admin UI can edit per row. Values like
`bronze`, `silver`, `gold`, or any future tier name. The image-resolver then:

```sql
SELECT * FROM codex_media_assets
WHERE asset_kind = 'bundle_pack'
  AND bundle_image_kind = $1   -- 'bronze' | 'silver' | 'gold' | …
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 1;
```

Pros: simple, indexable, operator-editable in the existing admin row pencil.
Cons: introduces a free-text field that's effectively an enum without enum
guarantees.

### Option B — Lookup-by-variant-name

Reuse the existing `variant_name` column on `codex_media_assets`. The operator
sets `variant_name = bronze` (or `silver` / `gold`) in the row editor; the API
keys off variant_name when `asset_kind='bundle_pack'`. No schema change.

Pros: zero migration. Cons: overloads `variant_name` which is also used by
covers (rare/epic/legendary). Risk of collision unless we scope by
asset_kind.

### Option C — Bundle SKU → Asset ID join table

A new `bundle_sku_image_map` table:

```sql
CREATE TABLE bundle_sku_image_map (
  bundle_id   TEXT PRIMARY KEY,                -- e.g. 'satoshi-knyt-investor'
  asset_id    UUID REFERENCES codex_media_assets(id),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

Most flexible — per-SKU image override. Operator sees a "Bundle image" picker
per SKU on the bundle admin tab. Different SKUs can share the same asset or
have unique ones.

Pros: maximal control. Cons: heaviest — needs new admin UI and a join.

## Recommended path

Start with **Option B** (zero migration, ship same day). Move to **Option C**
when the operator wants per-SKU overrides beyond the three-tier model.

## Related files

- `app/triad/components/codex/tabs/useBundleImages.ts` — current static mapping
- `app/api/knyt/bundle-images/route.ts` — current title-string lookup
- `app/triad/components/codex/tabs/KnytStoreBundlesTab.tsx` — retail render
- `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` — investor render
- `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` — admin edit UI
