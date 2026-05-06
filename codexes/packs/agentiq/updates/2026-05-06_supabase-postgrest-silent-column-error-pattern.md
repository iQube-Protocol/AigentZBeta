# Dev Note: Silent Supabase Query Failure — Wrong Column Name

**Date:** 2026-05-06  
**Affected files:** `app/api/entitlements/list/route.ts`  
**Commits:** `4ee171d4`, `bd85a151`

---

## The Bug

Episode thumbnails were missing in the wallet library and KNYT shelf. GN and character card thumbnails rendered correctly; only episode covers were blank.

---

## Root Cause — PostgREST Silent Column Error

The episode branch in `/api/entitlements/list/route.ts` selected a non-existent column:

```typescript
// WRONG — column does not exist in codex_media_assets
.select('... rarity ...')

// CORRECT
.select('... rarity_tier ...')
```

**PostgREST's behaviour with unknown columns:** When a Supabase query via PostgREST references a column that doesn't exist, it returns `{ data: null, error: { ... } }`. The code destructured only `data`:

```typescript
const { data: epAssets } = await supabase.from('codex_media_assets').select('...');
// epAssets is null — but no error is thrown or logged
```

Because `epAssets` was always `null`, the loop that built `coverUrl`/`coverCid` never ran, and every episode entitlement got an empty `assetMeta`. No exception, no console error, no visible failure in the route response — just missing data silently.

---

## Diagnostic Steps

1. Check what columns the query selects vs. what columns actually exist in the table (Supabase Studio → Table Editor → column list).
2. Always destructure `error` too when debugging: `const { data, error } = await supabase...` and log/throw on error.
3. Compare the failing query against a known-working query that targets the same table (here: `/api/knyt/thumbnails/route.ts`).

---

## Fix — Two-Part Solution

### Part 1: Correct column name (`4ee171d4`)
Renamed `rarity` → `rarity_tier` in the SELECT. This alone was not sufficient because the per-entitlement query structure still had drift risk.

### Part 2: Pre-fetch shared cover map (`bd85a151`)
Replaced all per-entitlement DB queries for episode covers with a **single pre-fetch** at request start, using the **identical query** to `/api/knyt/thumbnails`:

```typescript
// Single bulk fetch — mirrors /api/knyt/thumbnails exactly
const { data: thumbAssets } = await supabase
  .from('codex_media_assets')
  .select('episode_number, asset_kind, cover_thumb_url, auto_drive_cid, rarity_tier, title')
  .eq('series', 'metaKnyts')
  .eq('status', 'active')
  .in('asset_kind', ['cover_image', 'cover_pdf', 'character_poster'])
  .order('episode_number', { ascending: true })
  .order('asset_kind', { ascending: true })   // cover_image before cover_pdf
  .order('created_at', { ascending: false });  // newest upload wins

// Build lookup map: dbEpisodeNumber -> cover row
const coverByDbEp = new Map<number, { cover_thumb_url: string | null; auto_drive_cid: string | null; rarity_tier: string | null }>();
for (const a of thumbAssets ?? []) {
  const ak = a.asset_kind as string | null;
  if (ak !== 'cover_image' && ak !== 'cover_pdf') continue;
  const ep = a.episode_number as number | null;
  if (ep === null || ep === undefined) continue;
  if (!coverByDbEp.has(ep)) {
    coverByDbEp.set(ep, {
      cover_thumb_url: (a.cover_thumb_url as string | null) ?? null,
      auto_drive_cid:  (a.auto_drive_cid as string | null) ?? null,
      rarity_tier:     (a.rarity_tier as string | null) ?? null,
    });
  }
}
```

Each episode entitlement then does a simple map lookup:

```typescript
const cover = coverByDbEp.get(dbEp) || coverByDbEp.get(altEp);
const { coverUrl, coverCid } = resolveAssetThumb(cover);
```

---

## Episode Number Conventions (reference)

Two conventions coexist in `assetId` strings and must be handled together:

| Convention | Example assetId | Number N means |
|---|---|---|
| Pricing | `episode-2-qripto-still` | N = pricing ep (0-indexed) |
| DB | `mk_ep02_print_common` | N = db episode number |

Conversion: `db_ep = pricing_ep + 1`  
Display: `display_ep = pricing_ep` (what users see)

The `epIsDbConvention` flag in the route detects `mk_ep` prefix to apply the right offset.

---

## General Pattern — Preventing This Class of Bug

1. **Always log Supabase errors** in API routes, at minimum during development:
   ```typescript
   const { data, error } = await supabase.from(...).select(...);
   if (error) console.error('[route] supabase error:', error.message);
   ```

2. **Mirror known-working queries** — if a query needs to return the same data as another route, copy the select/filter/order exactly rather than writing a new one from scratch.

3. **Use a single pre-fetch + in-memory map** instead of N per-item DB calls when multiple entitlements need the same asset table. This also eliminates drift between query shapes.

4. **Verify column names in Supabase Studio** before writing any new `.select()`. PostgREST will not tell you at call time.

---

## Related Files

| File | Role |
|---|---|
| `app/api/entitlements/list/route.ts` | Fixed route — now uses pre-fetch cover map |
| `app/api/knyt/thumbnails/route.ts` | Reference query — entitlements route mirrors this exactly |
| `app/hooks/useOwnedEntitlements.ts` | Client hook — single SoT combining entitlements + codex/owned |
| `app/triad/components/codex/tabs/KnytShelfTab.tsx` | Shelf UI — now uses `useOwnedEntitlements` |
