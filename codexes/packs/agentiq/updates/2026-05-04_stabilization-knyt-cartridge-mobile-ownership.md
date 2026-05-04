# Stabilization Session — KNYT Cartridge Mobile + Ownership Divergence

**Date:** 2026-05-04
**Branch:** `claude/confirm-aigentz-access-VnNTK`
**Status:** Shipped to dev (auto-merged via `2e3ff350` and follow-up direct pushes)

---

## Why this session existed

After 12 cycles of incremental patches against the symptom set "remix says sign in, PDFs error, video fails on mobile, owned items still ask for payment", the operator demanded a deeper architectural pass. Three parallel `Explore` agents traced:

1. PDF viewer mount chain
2. Remix dialog persona detection
3. Mobile touch-handler chain

A fourth pass traced the badge-vs-lock divergence on the Order tab. The findings made it clear that **prior cycles had been editing the wrong code paths entirely**.

---

## What was actually broken vs. what prior cycles assumed

| Symptom | Prior assumption | Actual cause |
|---------|------------------|--------------|
| Mobile smart-action buttons inert | Touch handlers blocked by overlay | `KnytTemplateRenderer.tsx:194` had `opacity-0 group-hover:opacity-100` — buttons permanently invisible on touch (no hover state) |
| KNYT remix shows "Sign in to remix" for signed-in users | `RemixDialog`/`PersonaContext` race | KNYT cartridge uses `KnytRemixButton`/`KnytSubmissionShell` (no banner). The runtime path runs `RemixDialog` and is what the operator was seeing. Embed bridge had its own race: `useCodexEmbedAuthBridge:171` deferred localStorage read to a `useEffect`, leaving `personaId` undefined on first paint and hiding the button until the effect ran |
| PDF viewer "doesn't even load" on click | API still 500/403 | `KnytTab.handleViewerOpen` silently no-op'd when an item routed to `type='pdf'` but had no `pdf_master_id` / `pdf_cid` / `text`. No toast, no log — invisible failure |
| Owned items still route to payment | Stale `metadata.owned` | `fetchOwnedEpisodes` cache-hit path set `ownedEpisodeNumbers` (badge) but **early-returned** before `setOwnedIssues` (the source `isEpisodeLocked()` checked). Badge said OWNED, gate said locked, payment fired |

---

## Fixes shipped

### 1. `app/triad/components/codex/templates/KnytTemplateRenderer.tsx:194`
`opacity-0 group-hover:opacity-100` → `opacity-100 md:opacity-0 md:group-hover:opacity-100`. Action buttons are now visible by default on touch; only desktop uses hover-reveal.

### 2. `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts:171`
`useState(sanitizeValue(initialPersonaId))` → lazy initializer that also reads `firstStoredValue(PERSONA_STORAGE_KEYS)`. `firstStoredValue` is SSR-safe (`typeof window` guard returns `undefined` on the server), so server render and client hydration still match, but every client render after hydration sees the persisted persona immediately. Same change applied to `authProfileId`.

### 3. `app/triad/components/codex/tabs/KnytTab.tsx`
- `handleViewerOpen` now logs the resolved `pdf_master_id`/`pdf_cid`/`hasText`/modalities/`effectivePersonaId` for every call.
- A new `else if (type === 'pdf')` branch fires a destructive toast when a PDF was requested but no source is attached: previously a silent no-op.
- `fetchOwnedEpisodes` cache-hit path now also calls `setOwnedIssues(cached.map((ep) => ({ episodeNumber: ep })))` so the lock check stays in sync with the badge.
- `isEpisodeLocked()` now checks `item.metadata?.owned` first (the same source the OWNED badge reads). `ownedIssues` remains as a secondary fallback. Badge and gate cannot diverge by construction.

### 4. `components/metame/MetaMeRuntimeClient.tsx`
Diagnostic logs added at four decision points:
- `[MetaMeRuntime] persona resolver — using context/shell persona` (when ctx/shell already supplies one)
- `[MetaMeRuntime] persona resolver — waiting for PersonaContext hydration` (`!ctxHydrated` guard)
- `[MetaMeRuntime] persona resolver — starting async fallback` (with localStorage state)
- `[MetaMeRuntime] admin-check result` (email + `isAdmin` from `/api/codex/admin-check`)
- `[MetaMeRuntime] dispatch` (per-capsule render — `runtimeAdminMode`, `personaIsAdmin`, `activePersonaId`, `personaResolving`)

In production, opening devtools and pasting these lines tells us exactly which branch fired and why — replacing 12 cycles of speculation.

---

## Architectural observation deferred to Phase 2

The badge-vs-gate split was patched, but the underlying architecture still has multiple independent ownership resolution paths (`getOwnedAssetIds`, `useOwnedAssets`, `KnytTab.fetchOwnedEpisodes`, `SmartTriadProvider.refreshLibrary`, raw `RemixDialog` persona-only check). The operator's intent — "the persona and content are bound at the SmartTriad level; surface shouldn't matter" — is not yet structurally guaranteed.

Phase 2 backlog: **`2026-05-04_smarttriad-ownership-unification-backlog.md`** spells out the unification — a single `useSmartTriadOwnership()` hook hoisted into `SmartTriadProvider`, all surfaces (Codex tabs, runtime remixer, payment, viewers) reading from it, purchase events broadcasting cache invalidation. Out of scope for this stabilization push.

---

## Verification

After deploy:
- Mobile: action buttons visible on cards; tap on a card with PDF source loads the viewer; tap on a card without one shows a destructive toast.
- KNYT cartridge embed: `KnytRemixButton` renders on first paint when localStorage already has `currentPersonaId`.
- Runtime: signed-in admin sees `RuntimeCapsuleAdminEditor`; non-admin sees `RuntimeCapsuleRemixEditor` with a working compose/generate flow (no spurious "Sign in to remix").
- Order tab: items badged OWNED no longer route to payment — clicking opens the appropriate viewer.
- Devtools console shows `[KnytTab]` and `[MetaMeRuntime]` diagnostic lines on every relevant action.

---

## Files changed

| File | Change |
|------|--------|
| `app/triad/components/codex/templates/KnytTemplateRenderer.tsx` | Mobile-visible action buttons |
| `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | Lazy synchronous localStorage init |
| `app/triad/components/codex/tabs/KnytTab.tsx` | `handleViewerOpen` logging + toast, cache-hit `ownedIssues` reconstruction, `isEpisodeLocked` reads `metadata.owned` first |
| `components/metame/MetaMeRuntimeClient.tsx` | Persona resolver / admin-check / dispatch diagnostics |
| `codexes/packs/agentiq/updates/2026-05-04_smarttriad-ownership-unification-backlog.md` | NEW — Phase 2 backlog |
| `codexes/packs/agentiq/collections.json` | Registered both this update and the backlog |
