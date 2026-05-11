# PersonaSpine — Client-Side Protocol for Persona-Bound Auth

**Status:** Canonical · introduced 2026-05-12 · aligned to parent contract 2026-05-12
**Module:** `utils/personaSpine.tsx`
**Parent contract:** `docs/architecture/metame-client-protocols.md` (event prefix, namespace, cross-frame rules, deprecation discipline)
**Server companion:** `services/identity/getActivePersona.ts` (untouched)
**Companion update:** `codexes/packs/agentiq/updates/2026-05-12_persona-spine-client-protocol.md`

---

## Why this exists

The server side already has a single resolver for "who is the active persona?" — `getActivePersona(request)` in `services/identity/getActivePersona.ts`. Every API route uses it.

The **client side** did not. Each surface (tab, sub-tab, drawer, chip, capsule, ExperienceQube card, iQube viewer, modal, sidebar) reinvented:

- Whether to read `personaId` from props, URL, postMessage, or localStorage
- Whether to attach `Authorization: Bearer <supabase-jwt>` on outbound fetches
- Whether to include `credentials: 'include'` on cross-shell calls
- Whether to invalidate cached identity on persona switch, sign-out, or token refresh
- What to render when the persona is loading, unauthenticated, or errored

The result was a slow drift: new surfaces frequently shipped with one of these wires missing, and "I'm signed in but it says unauthenticated" became a recurring class of bug. The Aigent Me welcome surface hit it first (2026-05-11).

PersonaSpine is the **single client-side protocol** that fixes this class entirely. It is the persona slice of the broader identity spine — a thin, deterministic, dependable layer that every surface composes against.

---

## Scope

Every browser surface that needs persona identity, an auth-bearer, or a spine-bound fetch uses this module. Concretely:

| Surface type | Examples in this repo |
|---|---|
| Cartridge tabs | `app/triad/components/codex/tabs/*` |
| Cartridge sub-tabs | nested tabs inside Marketa, KNYT, Qriptopian panels |
| Drawers | `components/iqube/{ConnectionsIQubeDrawer, MemoryIQubeDrawer, IdentityIQubeDrawer, PersonaIQubeDrawer}.tsx` |
| Chips | persona-aware status chips, value chips, KNYT reaction bars |
| Capsules | `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx` and any future capsule renderer |
| ExperienceQubes | `components/composer/ComposerStudio.tsx` and the rendering surfaces under `components/composer/Experience*` |
| iQube viewers | `components/registry/IQubeCard.tsx`, IQube drawers above |
| Modals / forms | `components/identity/PersonaCreationForm.tsx`, `app/components/wallet/PersonaQuickAddModal.tsx` |
| Runtime shells | `components/metame/MetaMeRuntimeClient.tsx`, `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` |

This list will grow. Whenever you add a new surface that touches persona context, you use this module — no exceptions.

---

## Privacy contract

PersonaSpine emits **T1 only** (per `types/access.ts`):

| Field | Tier | Allowed in browser? |
|---|---|---|
| `personaSessionToken` | T1 | Yes — opaque, server-signed, origin-bound, rotating |
| `displayLabel` | T1 | Yes — user-chosen pet name |
| `identifiability` | T1 | Yes — `semi_anonymous` floor |
| `cartridgeFlags` | T1 | Yes — booleans only |
| `cohortMemberships` | T1 | Yes — group id, not member id |
| `sessionExpiresAt` | T1 | Yes — TTL hint |
| `personaId` | T0 | **Never** — server-internal only |
| `authProfileId` | T0 | **Never** |
| `rootDid` | T0 | **Never** |
| `kybeAttestation` | T0 | **Never** |
| Cross-persona `fioHandle` | T0 | **Never** |

The hook does not return `personaId`. If a surface believes it needs the raw `personaId`, the right answer is almost always: re-read your code, you don't. The server resolves it from the personaSessionToken or the auth bearer; the client never needs to know.

The single permitted exception: the codex embed bridge (`useCodexEmbedAuthBridge`) accepts a `personaId` from URL/postMessage/localStorage as a *hint* for cases where the caller owns multiple personas. That hint is passed to `usePersonaSpine({ personaIdHint })` and to `personaFetch({ personaIdHint })`. The server treats it as advisory only — never authoritative.

---

## Public API

### `usePersonaSpine(options?)` — React hook

The one hook every surface uses. Returns a `PersonaSpineState`:

```ts
const spine = usePersonaSpine({ personaIdHint });
//   spine.status                 — 'idle' | 'loading' | 'ready' | 'refreshing' | 'unauthenticated' | 'error'
//   spine.personaSessionToken    — T1 opaque token (string | null)
//   spine.displayLabel           — display string (string | null)
//   spine.identifiability        — privacy floor (Identifiability | null)
//   spine.cartridgeFlags         — { isAdmin, isPartner }
//   spine.cohortMemberships      — string[]
//   spine.sessionExpiresAt       — ISO-8601 (string | null)
//   spine.error                  — diagnostic when status === 'error'
//   spine.refresh()              — force re-fetch
```

### `<PersonaSpineGate state={spine}> ... </PersonaSpineGate>` — render gate

Renders children only when `status === 'ready'` (or `'refreshing'`, which is `ready` with a silent re-fetch). Otherwise renders the appropriate fallback. Surfaces can override `loadingFallback`, `unauthenticatedFallback`, and `errorFallback`.

### `personaFetch(input, init?)` — authenticated fetch

Drop-in `fetch()` replacement. Automatically:

- Sends `Authorization: Bearer <supabase-jwt>` (when available)
- Sends `credentials: 'include'`
- Appends `?personaId=<hint>` when `init.personaIdHint` is supplied

Use it for every client → `/api/*` call that needs to act as the active persona's caller. Do **not** hand-roll `Authorization` headers.

### `readPersonaSurface(options?)` — imperative

For non-React contexts (modal constructors, imperative services). Returns the cached `ActivePersonaSurface` or fetches once.

### `refreshPersonaSpine()` / `broadcastPersonaChange(personaId?)`

Triggered by surfaces that own the persona switch UI. The first re-fetches; the second posts the canonical `metame:persona-changed` event (per the parent protocol contract — see `docs/architecture/metame-client-protocols.md`) to same-frame listeners *and* `window.parent` so cross-frame surfaces (Lovable shell, runtime embed) stay in sync. The deprecated `aa-persona-change-v1` alias is also dispatched for one release and emits a `console.warn` on receipt.

A companion `broadcastPersonaRevoked()` dispatches `metame:persona-revoked`, which flips listening surfaces to the unauthenticated state without triggering a re-fetch. The hook auto-emits this on Supabase `SIGNED_OUT`.

---

## Behavior contract

| Concern | Behavior |
|---|---|
| Single source of truth | One in-flight request per browser tab (singleton store + React Query-style dedupe inside the module). |
| Auth attach | Always `Authorization: Bearer <supabase-jwt>` via `getSupabaseAccessToken()`. Falls back to `localStorage` scan if the singleton client hasn't hydrated. |
| Persona hint | Optional `?personaId=…` query — disambiguates multi-persona ownership. The spine remains authoritative. |
| Invalidation triggers | (a) `postMessage` of type `metame:persona-changed` (or the deprecated `aa-persona-change-v1` alias) — only accepted from origins on the embed allowlist, (b) `metame:persona-revoked` — same allowlist gate, flips to unauthenticated, (c) Supabase `onAuthStateChange` (`SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED`), (d) explicit `refresh()`. |
| Cross-frame parity | Outbound `metame:*` events are dispatched same-frame **and** to `window.parent`. Inbound events from the parent are accepted only when `event.origin` matches `configs/embed/policy.v1.json::authAllowedOrigins`. |
| Window mirror | `window.__metame.persona` exposes `{ getSnapshot(), subscribe(), refresh() }` for non-React / cross-frame consumers. Read-only — mutations go through the module API. |
| Silent refresh | 60s before `sessionExpiresAt`, the module re-issues a token without showing a loading state. Surfaces see `status: 'refreshing'` briefly. |
| Failure surfaces | `status: 'unauthenticated'` → render sign-in prompt. `status: 'error'` → diagnostic with retry. Never silently fall through to default-pick semantics. |
| SSR | Deterministic empty snapshot. No fetches on the server. |

---

## Standard usage pattern

Every surface follows the same shape:

```tsx
"use client";

import { usePersonaSpine, personaFetch, PersonaSpineGate } from "@/utils/personaSpine";

export function MySurface({ personaId }: { personaId?: string }) {
  const spine = usePersonaSpine({ personaIdHint: personaId });
  const [data, setData] = useState<MyData | null>(null);

  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    personaFetch('/api/my-thing', { personaIdHint: personaId })
      .then(r => r.json())
      .then(setData);
  }, [spine.status, personaId]);

  return (
    <PersonaSpineGate state={spine}>
      {/* Your render uses spine.displayLabel, spine.cartridgeFlags, etc. */}
      <div>Welcome, {spine.displayLabel ?? 'friend'}.</div>
      {data && <DataView data={data} />}
    </PersonaSpineGate>
  );
}
```

Notes:

- **Do not** wrap `personaFetch` with your own helper. It already handles every cross-cutting concern.
- **Do not** read `sb-*-auth-token` from localStorage directly. The module does it.
- **Do not** add your own `useEffect` to refetch on persona switch. The hook handles it.
- **Do not** show your own "loading…" state for persona resolution. `PersonaSpineGate` handles it.

---

## Composition with existing primitives

PersonaSpine extends — it does not replace.

| Existing primitive | Role | Relationship to PersonaSpine |
|---|---|---|
| `useCodexEmbedAuthBridge` | Reads `personaId` from URL / postMessage / localStorage in embed/viewer shells | Its output becomes the `personaIdHint` passed to `usePersonaSpine`. The bridge is the input edge; PersonaSpine is the consumer-side protocol. |
| `getSupabaseBrowserClient` / `getSupabaseAccessToken` | Supabase JWT singleton and reader | PersonaSpine calls these under the hood. Surfaces don't import them directly any more. |
| `getActivePersona(request)` | Server-side spine resolver | Untouched. Source of truth for the T1 surface PersonaSpine fetches. |
| `/api/wallet/active-persona` | T1 surface emitter | The single endpoint PersonaSpine fetches. No new server route was added. |

---

## Migration sweep (one PR per file)

The Aigent Me welcome tab is the **reference implementation** that lands with the protocol. Existing surfaces that hand-roll persona/auth wiring will be migrated one at a time, in dedicated PRs reviewable in isolation. Order is by traffic:

1. `services/access/spineGateClient.ts` — replace inline `readJwt()` with `personaFetch`
2. `app/triad/components/codex/tabs/DevPersonaTab.tsx`
3. `components/metame/MetaMeRuntimeClient.tsx`
4. `components/iqube/ConnectionsIQubeDrawer.tsx`
5. `components/iqube/MemoryIQubeDrawer.tsx`
6. `components/iqube/IdentityIQubeDrawer.tsx`
7. `components/iqube/PersonaIQubeDrawer.tsx`
8. `components/identity/PersonaCreationForm.tsx`
9. `components/composer/ComposerStudio.tsx` (ExperienceQube + capsule generation surfaces)
10. `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx`
11. `services/wallet/personaService.ts`
12. `app/components/wallet/PersonaQuickAddModal.tsx`

Each migration removes ~15-30 lines of duplicated auth plumbing and ~5 lines of localStorage scanning. Once the sweep is complete, we add a lint rule that flags direct `sb-*-auth-token` localStorage access and direct `Authorization: Bearer` header construction outside `utils/personaSpine.tsx` and `utils/supabaseBrowser.ts`.

---

## Adoption checklist (for new surfaces)

When you add a new tab, sub-tab, drawer, chip, capsule, ExperienceQube renderer, iQube card, modal, or any other surface that touches persona:

- [ ] **Persona identity:** `usePersonaSpine({ personaIdHint })` — never read `personaId` from localStorage, URL, or props for any purpose other than feeding the hint.
- [ ] **Render gate:** Wrap the body in `<PersonaSpineGate state={spine}>`. Override fallbacks only if the default copy doesn't fit your surface's tone.
- [ ] **Fetches:** Every `/api/*` call uses `personaFetch(url, { personaIdHint })`. Do not call `window.fetch` directly with hand-rolled auth headers.
- [ ] **Persona switch:** If your surface owns a persona-switch UI, call `broadcastPersonaChange(personaId)` after the switch lands. Everyone else listens automatically.
- [ ] **Privacy:** Do not log, surface, or transmit any T0 field. Do not derive display values from T0 fields. The `displayLabel` from the spine is the only persona-identifying string you render.
- [ ] **Server side:** When your surface adds a new `/api/*` route, use `getActivePersona(request)` — do not write a parallel resolver. Strip T0 from the response per the privacy contract.

If you find a case the protocol doesn't cover, **don't bypass it**. Open an issue or extend the module itself.

---

## Files

| File | Role |
|---|---|
| `utils/personaSpine.tsx` | Protocol implementation |
| `utils/supabaseBrowser.ts` | Bearer token resolver (consumed by PersonaSpine) |
| `services/identity/getActivePersona.ts` | Server resolver (consumed by `/api/wallet/active-persona`) |
| `app/api/wallet/active-persona/route.ts` | T1 surface emitter |
| `types/access.ts` | T0 / T1 / T2 contract types |
| `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | URL/postMessage bridge (feeds `personaIdHint`) |
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | Reference implementation |

---

## Update ownership

PersonaSpine is a spine-class primitive. Modifying its public API, privacy contract, invalidation triggers, or fetch behavior requires operator approval — same rules as `services/identity/*`. Extending it is fine (e.g., adding a new T1 field that flows from `getActivePersona`); narrowing or weakening it is not.
