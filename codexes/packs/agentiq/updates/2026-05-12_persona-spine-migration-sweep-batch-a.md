# PersonaSpine Migration Sweep — Batch A (7 surfaces)

**Date:** 2026-05-12
**Workstream:** PersonaSpine adoption sweep (per `docs/architecture/persona-spine-client-protocol.md` "Migration sweep" section)
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessor:** Sweep #1 — `services/access/spineGateClient.ts` (commit fa3f06d)

---

## What landed

Seven surfaces with the **uniform** hand-rolled pattern (inline `for…sb-*-auth-token` localStorage scan + manual `Authorization: Bearer` construction) migrated to `personaFetch()`:

| # | File | Lines saved |
|---|---|---|
| 2 | `app/triad/components/codex/tabs/DevPersonaTab.tsx` | ~12 |
| 3 | `components/iqube/ConnectionsIQubeDrawer.tsx` | ~25 |
| 4 | `components/iqube/MemoryIQubeDrawer.tsx` | ~25 |
| 5 | `components/iqube/IdentityIQubeDrawer.tsx` | ~25 |
| 6 | `components/iqube/PersonaIQubeDrawer.tsx` | ~25 |
| 7 | `components/identity/PersonaCreationForm.tsx` | ~15 |
| 8 | `app/components/wallet/PersonaQuickAddModal.tsx` | ~12 |

**Net:** ~140 lines of duplicated auth plumbing removed across 7 files. Behaviour unchanged — every fetch still attaches `Authorization: Bearer <supabase-jwt>` and `credentials: 'include'`, now via the canonical `personaFetch()` helper.

Each migration removed:
- A local `getAccessTokenFromStorage()` (or `getAccessToken()`) function with the `for-loop + sb-*-auth-token + JSON.parse(access_token)` boilerplate
- A local `authHeaders()` helper that built `{ "Content-Type": …, Authorization: \`Bearer ${token}\` }`
- Per-call-site `headers: authHeaders()` plumbing on `fetch()` calls

…and replaced them with a single import + `personaFetch(url, init)` calls. Every site now also gains:
- Cross-frame origin allowlisting (per `metame-client-protocols.md`)
- Singleton-deduped Supabase token reads
- Automatic re-fetch on persona switch (via the spine's invalidation triggers)

---

## Surfaces deferred to follow-up PRs

Four files do not fit the uniform mechanical pattern and need individual review:

| File | Reason |
|---|---|
| `components/metame/MetaMeRuntimeClient.tsx` | Defines a sync `getAccessTokenFromStorage()` used in 6 places across a 280KB file. Migration requires careful surgery to avoid changing runtime semantics. Single-PR target. |
| `components/composer/ComposerStudio.tsx` | Contains 15+ `fetch()` calls but **no** `Authorization: Bearer` attach today — they rely on cookies. Migration is an *adoption*, not a fix; lower urgency. Will be batched with ComposerStudio's next planned refactor. |
| `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx` | Has zero fetch calls — all I/O is delegated to its parent. Nothing to migrate. Removed from sweep. |
| `services/wallet/personaService.ts` | Defines a **synchronous** `withAuthHeaders()` helper used in tight call sites. `personaFetch` is async. Migration would require making every caller async. Documented in the file itself ("We don't want to make withAuthHeaders async"). Needs a coordinated sync→async lift across the wallet code path. Defer. |

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `utils/personaSpine.tsx::personaFetch` | ✓ — sole replacement for inline auth attach |
| `utils/supabaseBrowser.ts::getSupabaseAccessToken` | ✓ — invoked by personaFetch under the hood |
| `services/identity/getActivePersona.ts` | ✓ — server-side spine resolver (untouched) |
| Embed origin allowlist | ✓ — applied automatically |

No new dependencies. No new server routes. No protected files modified.

---

## Privacy contract held

- All migrated fetches still send `Authorization: Bearer <supabase-jwt>` (auto-attached by `personaFetch`).
- T0 identifiers (`personaId`, `authProfileId`, `rootDid`) never appear on the wire — server resolves them via `getActivePersona(request)`.
- No surface exposes T0 fields it didn't already expose.

---

## Validation

After this lands on dev:

1. Open the metaMe runtime → Connections drawer — list of personas should populate.
2. Open the Memory drawer → memory entries should load.
3. Open the Identity drawer → bind/load/wallet calls should run in parallel and populate.
4. Open the Persona drawer → load + edit + mint should still work.
5. Open the Persona Creation form → create-with-fio should succeed.
6. Open the Persona Quick Add Modal → claim flow should succeed.
7. DevPersonaTab → claim flow should succeed.

If any of these surfaces now show "unauthenticated" or fail to load, the spine resolver's caller-identity chain in `services/wallet/personaRepo.ts::getCallerIdentityContext` is the place to start (it accepts `Authorization: Bearer …`, `x-auth-profile-id`, or `?authProfileId=` in dev only).

---

## Sweep status

| # | Surface | Status |
|---|---|---|
| 1 | `services/access/spineGateClient.ts` | ✅ landed (commit fa3f06d) |
| 2 | `app/triad/components/codex/tabs/DevPersonaTab.tsx` | ✅ this commit |
| 3 | `components/iqube/ConnectionsIQubeDrawer.tsx` | ✅ this commit |
| 4 | `components/iqube/MemoryIQubeDrawer.tsx` | ✅ this commit |
| 5 | `components/iqube/IdentityIQubeDrawer.tsx` | ✅ this commit |
| 6 | `components/iqube/PersonaIQubeDrawer.tsx` | ✅ this commit |
| 7 | `components/identity/PersonaCreationForm.tsx` | ✅ this commit |
| 8 | `app/components/wallet/PersonaQuickAddModal.tsx` | ✅ this commit |
| 9 | `components/metame/MetaMeRuntimeClient.tsx` | deferred — runtime root, single-PR target |
| 10 | `components/composer/ComposerStudio.tsx` | deferred — no auth-attach today, adopt with next refactor |
| 11 | `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx` | removed — no fetches |
| 12 | `services/wallet/personaService.ts` | deferred — sync→async lift required |

**8 of 12 sweep targets complete (67%).** Three deferred targets, one removed. After the three deferred targets land, the lint rule against `Object.keys(localStorage)…sb-…auth-token` and inline `Authorization: Bearer` outside `utils/personaSpine.tsx` / `utils/supabaseBrowser.ts` becomes enforceable.

---

## Files

- `app/triad/components/codex/tabs/DevPersonaTab.tsx`
- `components/iqube/ConnectionsIQubeDrawer.tsx`
- `components/iqube/MemoryIQubeDrawer.tsx`
- `components/iqube/IdentityIQubeDrawer.tsx`
- `components/iqube/PersonaIQubeDrawer.tsx`
- `components/identity/PersonaCreationForm.tsx`
- `app/components/wallet/PersonaQuickAddModal.tsx`
