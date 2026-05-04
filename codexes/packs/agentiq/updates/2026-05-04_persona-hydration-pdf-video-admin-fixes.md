# Persona Hydration, PDF, Video & Admin-Dispatch Fixes

**Date:** 2026-05-04
**Branch:** `claude/confirm-aigentz-access-VnNTK`
**Status:** Shipped to branch, auto-merge to dev pending

---

## What broke (operator-reported)

1. **PDF reader** — HTTP 500 on Genesis Nakamoto print, HTTP 403 on Episode 0 print. Both devices.
2. **Video player** — works on desktop, silently fails on mobile.
3. **Remix modal** — "Sign in to remix" banner shows even for signed-in admins; admin/non-admin dispatch (pricing layer vs remix editor) was not happening.

After 9 cycles of attempts that didn't move the needle, a deep architectural pass identified the underlying causes — none of which were what prior patches assumed.

---

## Root causes

### 1. PersonaContext hydration bug (the fundamental one)

`app/contexts/PersonaContext.tsx` initialised `activePersonaId` with a `useState(() => readFromStorage())` lazy initialiser. In Next.js App Router, client components are first rendered on the server, where `window` is undefined and `readFromStorage()` returns `null`. The lazy initialiser is **not** re-run during client hydration — React keeps the server's `null`. Result: `activePersonaId` stays `null` on every initial mount even when `currentPersonaId` is in `localStorage`.

This cascaded into every consumer:
- `MetaMeRuntimeClient` saw `ctxPersonaId = null` and ran the slow async fallback resolver instead of using the local value.
- `RemixDialog` rendered with `personaId = null` and showed the sign-in banner, even though the user was signed in.

### 2. Admin dispatch was URL-only

`runtimeAdminMode` in `MetaMeRuntimeClient` was derived purely from `?admin=1` / `?runtimeAdmin=1` query params. The KNYT redirect at `/app/e/[id]/page.tsx` doesn't pass these flags, so admins navigating from the KNYT cartridge fell through to the consumer `RuntimeCapsuleRemixEditor` instead of the admin pricing layer (`RuntimeCapsuleAdminEditor`). There was no persona-based admin lookup at all.

### 3. PDF `?meta=1` had no try/catch

`app/api/content/pdf-page-by-master/[masterId]/route.ts` wrapped the render path in a try/catch that returned a placeholder PNG on error, but the `?meta=1` branch (used by `PDFPageViewer` to discover page count) had **no** error handling. Any failure in `fetch(pdfUrl)`, `pdfjs.getDocument(...)`, or the optional `page_count` write-back propagated as a 500. This was the GN error.

### 4. Episode 0 was being entitlement-gated

Episode 0 is the GN free preview. `services/rewards/assetOwnership.ts#userOwnsAsset` treated it like any other gn-category asset, so users without a `grants_gn` SKU got a 403. Pre-refactor this didn't matter because URLs were exposed directly; post-refactor the entitlement gate started enforcing on a free asset. This was the E0 error.

### 5. Video route always returned 206

`app/api/content/video/[cid]/route.ts` returned HTTP 206 (Partial Content) with the first 4 MB even when no `Range` header was sent. Desktop browsers handle this and follow up with `Range:` requests. Mobile Safari/Chrome do not — they treat the partial response as the entire file and stop. Result: video is silently truncated to 4 MB on mobile.

---

## Fixes

### `app/contexts/PersonaContext.tsx`
- Replaced the lazy initialiser with `useState(null)` + a client-only `useEffect` that reads `localStorage` on mount.
- Added `hydrated: boolean` to the context value so consumers can suppress sign-in UI during the brief pre-hydration window.

### `components/metame/MetaMeRuntimeClient.tsx`
- Consume the new `hydrated` flag from `usePersonaSafe()` and gate the async resolver on it — the resolver no longer fires before PersonaContext has had a chance to populate from `localStorage`.
- Renamed `runtimeAdminMode` → `runtimeAdminUrlOverride` (the URL-derived value).
- Added `personaIsAdmin` state plus a new effect that calls `/api/codex/admin-check?email=...` once a persona is resolved.
- Final dispatch flag: `const runtimeAdminMode = runtimeAdminUrlOverride || personaIsAdmin;` — admins now get the pricing layer regardless of how they enter the runtime.

### `app/api/content/pdf-page-by-master/[masterId]/route.ts`
- Wrapped the entire `?meta=1` branch in try/catch with structured logging.
- Each fallback path returns a sane default (`{ pages: 1, suggestedWidth: 1200 }`) instead of crashing.
- The optional `page_count` write-back is now best-effort — RLS / missing-column failures no longer kill the request.

### `services/rewards/assetOwnership.ts`
- `userOwnsAsset` now short-circuits with `{ owned: true, via: 'free' }` for Episode 0 (GN free preview). The `via` union grew a `'free'` member; existing callers only destructure `owned` so this is non-breaking.

### `app/api/content/video/[cid]/route.ts`
- When no `Range` header is sent, return HTTP 200 with the full body via a `ReadableStream` (1 MiB chunks). Mobile parses this correctly and the existing 206 path handles desktop seeking and edge body-size constraints.

---

## Why prior cycles didn't work

Every previous attempt assumed `PersonaContext` was correct and that the persona was reaching `MetaMeRuntimeClient`. It wasn't — the lazy initialiser made the client tree start with `null` on every mount. The fix had to be in the context itself, not downstream. Similarly, the admin dispatch was assumed to be URL-driven by design; the operator's mental model that it should follow persona admin status was correct, the code didn't match.

---

## Open follow-ups

- The PDF route still requires `personaId` (returns 401 without it). For genuine signed-out free-preview access we'd also need to relax that check for Episode 0. Not blocking the current operator complaint (signed-in users).
- Admin status is checked via `/api/codex/admin-check?email=...`. For very large admin tables this lookup runs on every runtime mount; consider caching in `PersonaContext` if this becomes hot.
- The video 200-with-stream path may hit hosted edge body-size limits for very large videos. If that surfaces, the right fix is migrating storage to a CDN/range-native provider (out of scope here).
