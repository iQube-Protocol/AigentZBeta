# Thin-Client ↔ Platform Persona Handshake — Integration Checklist

**Date:** 2026-05-08
**Audience:** Lovable / metame.live / any thin-client surface that embeds the AgentiQ platform iframe
**Status:** Spec **agreed and shipping** on `claude/blockchain-identity-ai-foundation-lEyk2` → dev. After the next Amplify deploy it's live on `dev-beta.aigentz.me`.
**Predecessor doc:** `2026-05-07_thin-client-active-persona-integration.md` (full integration contract; this is the persona-change-v1 envelope addendum)

---

## What changed on the platform side (2026-05-08)

The `aa-persona-change-v1` postMessage envelope is now enriched and emitted in two situations the shell needs.

### 1. Envelope now carries human-readable handle fields

**Old shape (≤2026-05-07):**
```jsonc
{ "type": "aa-persona-change-v1", "personaId": "f1fafe54-..." }
```

**New shape (2026-05-08+):**
```jsonc
{
  "type": "aa-persona-change-v1",
  "personaId": "f1fafe54-...",
  "displayLabel": "Knight",          // top-level: user's pet name
  "ownFioHandle": "aigentz@aigent",  // top-level: the caller's own FIO handle
  "surface": {                        // surface-nested: full T1 ActivePersonaSurface
    "personaSessionToken": "<opaque>",
    "displayLabel": "Knight",
    "ownFioHandle": "aigentz@aigent",
    "identifiability": "semi_anonymous",
    "cartridgeFlags": { "isAdmin": false, "isPartner": false },
    "cohortMemberships": [],
    "sessionExpiresAt": "2026-05-08T01:00:00.000Z"
  }
}
```

Receivers can consume **either** the top-level fields (simplest) **or** the surface-nested object (typed). Lovable's `ShellContext.tsx:personaSyncHandler` (lines ~727–780) already handles both shapes — no change needed on the shell side.

The `personaSessionToken` is **only** in the `surface` object, never at top level. Treat it as opaque; the shell never uses it directly (that's the platform's job for downstream API calls).

### 2. Envelope is now emitted on initial load / auth restore

In addition to the existing user-driven switch broadcast, the platform now emits the envelope **once** when `PersonaContext` hydrates with a non-null persona. This means:

- Open the thin client → user's auth state restores → platform iframe mounts → `PersonaContext` reads localStorage → emits `aa-persona-change-v1` upward to the shell
- Shell receives the envelope and renders the user's handle without waiting for them to switch

A `useRef` guard prevents re-emission on every token-refresh-induced re-render. One initial broadcast per page session.

---

## Handle fallback chain (operator-decided)

```
displayLabel ?? ownFioHandle ?? "Be"
```

- `displayLabel` is the user's pet name for the persona ("Knight", "Work", "Anon"). Surfaced when set on `personas.display_name`.
- `ownFioHandle` is the persona's FIO handle (e.g. `aigentz@aigent`). Surfaced for the caller's own session — privacy-safe because the user already knows their own handle.
- `"Be"` is the universal default when no handle is resolvable.

This chain is honoured in the platform's broadcast logging (see "Source attribution" below) and in Lovable's `ShellContext.tsx`. If the chain changes, both ends update together.

---

## Source attribution log line

Every broadcast emits one greppable log line on the platform side:

```
[SPINE] persona-change-broadcast source=<switch|initial|refresh> personaId=<uuid> displayLabel=<value|(none)> ownFioHandle=<value|(none)> resolvedHandle=<final-fallback>
```

| `source` | When |
|---|---|
| `switch` | User clicked a different persona in the wallet drawer / persona switcher |
| `initial` | Page load / auth restore, hydration completed with a non-null persona |
| `refresh` | (Reserved — not yet emitted; future use for forced re-fetches) |

Operator can grep CloudWatch / dev terminal for `[SPINE] persona-change-broadcast` to debug "why is the shell rendering Be instead of my handle?". The `resolvedHandle` field at the end of the line is exactly what the shell will render.

---

## Receiver checklist (shell side)

If you're building or updating a thin-client receiver, this is what to wire up. Lovable's existing receiver already covers all of this — listed here as a reference for any other shell.

### 1. Origin allow-list

```typescript
window.addEventListener('message', (event) => {
  const allowed = ['https://dev-beta.aigentz.me', 'https://staging-beta.aigentz.me', 'https://beta.aigentz.me'];
  if (!allowed.includes(event.origin)) return;
  // ...
});
```

### 2. Type guard

```typescript
const data = event.data as { type?: string } | null;
if (data?.type !== 'aa-persona-change-v1') return;
```

### 3. Extract handle (top-level OR surface-nested)

```typescript
const personaId = (data as any).personaId;
const displayLabel = (data as any).displayLabel ?? (data as any).surface?.displayLabel;
const ownFioHandle = (data as any).ownFioHandle ?? (data as any).surface?.ownFioHandle;
const resolvedHandle = displayLabel ?? ownFioHandle ?? 'Be';
renderHeader(resolvedHandle);
```

### 4. Refetch on receipt (optional, recommended)

If the shell wants the *full* T1 surface (e.g. `cartridgeFlags.isAdmin` for permission-aware UI), it can refetch `/api/wallet/active-persona` after the broadcast — but for handle rendering, the inline data is sufficient.

### 5. Idempotence

Receivers should compare `data.personaId` against currently rendered persona before acting:

```typescript
if (personaId === currentRenderedPersonaId) return;
```

The platform side does this on its own receivers (codex embed bridge), so the message can be re-broadcast safely without flicker.

---

## Privacy guard — what the envelope MUST NOT contain

| Field | Reason |
|---|---|
| `authProfileId` | T0 server-internal handle |
| `rootDid` | Compliance-bearing; available only via `discloseCredential` flow |
| `kybeAttestation` | Most confidential layer; never on wire |
| Cross-persona handle | `ownFioHandle` is the caller's OWN handle; resolving another persona's handle is forbidden |
| `personaSessionToken` (at top level) | Carried only inside `surface` object; treat as opaque |

Verified by the unit test suite (`tests/persona-broadcast-handshake.test.ts`):

```bash
npm test tests/persona-broadcast-handshake.test.ts
# 11/11 GREEN — envelope shape, fallback chain, T0 leak canary
```

---

## What the platform wants from the shell side

(Keeping this here so it doesn't get lost — the shell's behaviour is Lovable's call, but for completeness.)

1. **Update the rendered handle on every `aa-persona-change-v1` broadcast.** Don't cache the handle past the persona switch.
2. **Origin-validate before acting.** `event.origin` must be in the allow-list.
3. **Treat the personaId in the payload as a refetch trigger or display key only — never a long-lived identifier.** It's a T0 leak that exists in the message for legacy reasons; the canonical handle is the opaque `personaSessionToken` inside the `surface` object.
4. **On sign-out, fall through to your own auth-state listener.** The platform doesn't broadcast a separate sign-out event (per `ce218a5` — token-refresh failures incorrectly fired SIGNED_OUT and wiping persona state caused regressions).

---

## Files

| File | Role |
|---|---|
| `app/contexts/PersonaContext.tsx` | Broadcast composer + initial-emit useEffect |
| `tests/persona-broadcast-handshake.test.ts` | 11 vitest assertions covering envelope shape, fallback chain, fail-open, T0 leak canary |
| `app/api/wallet/active-persona/route.ts` | Returns the surface that gets piped into the broadcast |
| `services/identity/personaSessionToken.ts` | Issues the opaque T1 token |
| (Lovable) `ShellContext.tsx` lines ~727–780 | Receiver: `personaSyncHandler` |

---

## Versioning

- **v1** (this doc) — top-level + surface-nested handle fields, initial-emit on hydrate.
- The opaque token format inside `surface.personaSessionToken` may change without notice — never inspect it on the receiver.
- Adding fields to the envelope is non-breaking. Removing fields is breaking and will be announced.

If you find a case where `displayLabel ?? ownFioHandle` returns nothing reasonable (e.g. blank strings from a malformed `personas` row), file a bug — it's a data-quality issue rather than a contract one. The unit-test suite has a defensive case for empty strings (`tests/persona-broadcast-handshake.test.ts > "falls back to 'Be' when both empty strings"`).
