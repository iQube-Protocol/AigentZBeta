# PersonaSpine — Client-Side Protocol for Persona-Bound Auth

**Date:** 2026-05-12
**Workstream:** Identity spine — client-side companion
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Canonical spec:** `docs/architecture/persona-spine-client-protocol.md`

---

## Why

Server-side, `services/identity/getActivePersona.ts` is the single resolver for "who is the active persona?" — every API route uses it. Client-side, **no equivalent existed**. Each surface (tab, sub-tab, drawer, chip, capsule, ExperienceQube renderer, iQube card, modal) reinvented:

- Whether to read `personaId` from props, URL, postMessage, or localStorage
- Whether to attach `Authorization: Bearer <supabase-jwt>` on fetches
- Whether to send `credentials: 'include'` for cross-shell calls
- How to invalidate on persona switch / sign-out / token refresh
- What to render when the persona is loading, unauthenticated, or errored

Result: new surfaces routinely shipped with one wire missing. "I'm signed in but it says unauthenticated" became a recurring bug class — first hit by the Aigent Me welcome surface (2026-05-11).

The operator's instruction:
> *We need this to happen in a consistent way across any tab, sub-tab, or drawer otherwise we are constantly running into this problem. There needs to be a standard, protocol-level way to access the persona from the spine that is deterministic, dependable, and flexible enough to accommodate any of the ecosystem surfaces that persona and content may need to interact with — tabs, sub-tabs, drawers, chips, capsules, ExperienceQubes, iQubes, etc.*

This update lands that protocol.

---

## What landed

| File | Status | Purpose |
|---|---|---|
| `utils/personaSpine.tsx` | **New** | Canonical client-side persona-bound auth protocol. ~330 lines. |
| `utils/supabaseBrowser.ts` | **Extended** earlier (2026-05-11) | `getSupabaseAccessToken()` / `authedFetchHeaders()` — consumed by PersonaSpine. |
| `docs/architecture/persona-spine-client-protocol.md` | **New** | Protocol spec + adoption checklist for every surface migration. |
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | **Refactored** | Reference implementation — replaces the hand-rolled auth/fetch with `usePersonaSpine`, `PersonaSpineGate`, and `personaFetch`. |

---

## Public API (summary)

```tsx
import {
  usePersonaSpine,     // React hook → PersonaSpineState
  PersonaSpineGate,    // Render gate for idle/loading/unauth/error/ready
  personaFetch,        // Drop-in fetch() with auto Bearer + credentials + personaId hint
  readPersonaSurface,  // Imperative one-shot (non-React contexts)
  refreshPersonaSpine, // Force refetch
  broadcastPersonaChange, // For surfaces that own the persona-switch UI
} from "@/utils/personaSpine";
```

Returns T1 only — `personaSessionToken`, `displayLabel`, `identifiability`, `cartridgeFlags`, `cohortMemberships`, `sessionExpiresAt`. **No T0** (no `personaId`, `authProfileId`, `rootDid`, etc.). Per `types/access.ts`.

Single in-flight request per browser tab. Listens to `aa-persona-change-v1` postMessage and Supabase `onAuthStateChange`. Silent refresh ≥60s before token expiry.

---

## What stays in place

- `useCodexEmbedAuthBridge` keeps its job (URL/postMessage/storage → personaId hint). Its output feeds `usePersonaSpine({ personaIdHint })`.
- `services/identity/getActivePersona.ts` is untouched (protected per CLAUDE.md).
- `/api/wallet/active-persona` is unchanged. No new server route.
- Existing surfaces that hand-roll auth are **not** ripped out in this PR. They migrate one at a time.

---

## Migration sweep (deferred, one PR per file)

Order by traffic / risk:

1. `services/access/spineGateClient.ts`
2. `app/triad/components/codex/tabs/DevPersonaTab.tsx`
3. `components/metame/MetaMeRuntimeClient.tsx`
4. `components/iqube/{Connections,Memory,Identity,Persona}IQubeDrawer.tsx`
5. `components/identity/PersonaCreationForm.tsx`
6. `components/composer/ComposerStudio.tsx` (ExperienceQube + capsule generation)
7. `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx`
8. `services/wallet/personaService.ts`
9. `app/components/wallet/PersonaQuickAddModal.tsx`

Each PR is small, reviewable in isolation, and removes ~15-30 lines of duplicated auth plumbing. When complete: lint rule against direct `sb-*-auth-token` localStorage access and direct `Authorization: Bearer` header construction outside `utils/personaSpine.tsx` and `utils/supabaseBrowser.ts`.

---

## Adoption checklist (for every new surface from now on)

- [ ] **Persona identity:** `usePersonaSpine({ personaIdHint })` — never read raw personaId for any purpose other than feeding the hint.
- [ ] **Render gate:** Wrap body in `<PersonaSpineGate state={spine}>`.
- [ ] **Fetches:** Every `/api/*` call uses `personaFetch()`. Do not hand-roll `Authorization`.
- [ ] **Persona switch:** Call `broadcastPersonaChange()` after switching.
- [ ] **Privacy:** No T0 field logged, surfaced, or transmitted. Render `spine.displayLabel`, not derived names from T0.
- [ ] **Server side:** New `/api/*` routes use `getActivePersona(request)`. No parallel resolvers.

If a case isn't covered by the protocol, **don't bypass it** — extend `utils/personaSpine.tsx` instead.

---

## Why this is safe

- No changes to spine internals (`services/identity/*`, `services/access/*`, `types/access.ts`).
- No new server route.
- No fork of existing client primitives — `useCodexEmbedAuthBridge` and Supabase singleton compose into the new module.
- Privacy contract preserved (T1 on the wire, T0 on the server).
- Fully backward compatible — every surface that currently works keeps working until its own migration PR lands.

---

## Files

- `utils/personaSpine.tsx` — implementation
- `docs/architecture/persona-spine-client-protocol.md` — spec
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` — reference implementation
- `codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md` — Aigent Me workstream decisions (parent context)
