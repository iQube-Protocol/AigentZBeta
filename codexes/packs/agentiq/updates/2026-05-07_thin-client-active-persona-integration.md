# Thin Client (metame.live / Lovable) — Active Persona Integration Contract

**Date:** 2026-05-07
**Status:** Live on dev — `dev-beta.aigentz.me`
**Audience:** Lovable / any thin-client surface that embeds the AgentiQ platform iframe and needs to render the user's active persona handle/header

## TL;DR

1. **Fetch:** `GET https://dev-beta.aigentz.me/api/wallet/active-persona` with `Authorization: Bearer <jwt>` whenever you need the active persona surface.
2. **Listen:** `window.addEventListener('message', ...)` for `aa-persona-change-v1` messages from the embedded platform iframe. On receipt, refetch the endpoint above.
3. **Render:** use `displayLabel` (user's pet name) or `ownFioHandle` (user's FIO handle) — pick per your UI conventions.
4. **Treat the response as confidential to the user** — do not echo identifiers anywhere off-device.

---

## 1. The endpoint

### `GET /api/wallet/active-persona`

**Headers:**

```
Authorization: Bearer <supabase-jwt>
Accept: application/json
```

**Authentication:** Supabase JWT obtained via the standard supabase-js auth flow on `dev-beta.aigentz.me`. The thin client should already be sharing auth state with the platform iframe via the standard Supabase cookie / postMessage flow. If you don't have a JWT, the user is unauthenticated; the endpoint returns 401.

**Response (200 OK):**

```jsonc
{
  // T1 opaque session token. Treat as a black box.
  // Resolves to the underlying personaId only on the AigentZ server.
  // Rotates on persona switch / sign-out / TTL expiry.
  "personaSessionToken": "eyJ...payload...sig",

  // Self-asserted disclosure floor.
  "identifiability": "anonymous" | "semi_anonymous" | "semi_identifiable" | "identifiable",

  // Cartridge-role flags. Booleans only — admin/partner gates.
  "cartridgeFlags": {
    "isAdmin": false,
    "isPartner": false
  },

  // User-chosen pet name for the persona ("Knight", "Work", "Anon").
  // Render preference #1.
  "displayLabel": "Knight",

  // The persona's own FIO handle (e.g. "aigentz@aigent").
  // Surfaced because the response is bound to the authenticated
  // caller's own session — they already know their own handle.
  // Render preference #2 (when displayLabel is absent).
  "ownFioHandle": "aigentz@aigent",

  // Cohort group ids. Public/semi-public by design.
  "cohortMemberships": ["knyt-investors"],

  // ISO timestamp; refresh proactively before this.
  "sessionExpiresAt": "2026-05-08T01:00:00.000Z"
}
```

**On 401:** the user is unauthenticated. Render anonymous-mode UI in the thin client.

**Privacy contract:** the response NEVER carries `personaId`, `authProfileId`, or `rootDid`. The `ownFioHandle` is the user's own — surfacing it to themselves is safe; do not echo it to other origins or persist it beyond render scope.

### What to render in the thin-client header

Recommended fallback chain:

```typescript
const label =
  surface.displayLabel
  ?? surface.ownFioHandle
  ?? '(persona)';   // truly anonymous fallback
```

If you want to indicate identifiability visually (icon, color, etc.):

```typescript
const tone =
  surface.identifiability === 'anonymous'        ? 'gray'   :
  surface.identifiability === 'semi_anonymous'   ? 'blue'   :
  surface.identifiability === 'semi_identifiable'? 'amber'  :
  surface.identifiability === 'identifiable'     ? 'green'  : 'gray';
```

---

## 2. Real-time persona-change events

When the user switches persona inside the platform iframe (via the wallet drawer's persona dropdown, persona-quick-add, or any other surface), the platform broadcasts a `postMessage` to the parent window.

### Listener

```typescript
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'aa-persona-change-v1') return;
  // data.personaId is an opaque server-internal id; ignore it.
  // Just refetch the surface to get the new T1 + display data.
  void refetchActivePersona();
});
```

Validate `event.origin` matches your platform iframe origin (`https://dev-beta.aigentz.me`) before acting on the message.

The message payload:

```jsonc
{
  "type": "aa-persona-change-v1",
  "personaId": "..."   // server-internal id; thin client should NOT use this
}
```

`personaId` in the payload is a T0 leak that exists for legacy reasons; the thin client should **not** persist or display it. Treat the message purely as a "refetch the surface" trigger.

### When this fires

- User clicks a different persona in the wallet drawer dropdown
- User creates a new persona via PersonaQuickAddModal
- Cartridge default switch (when user accepts the cross-cartridge guard prompt)
- Any other server-authoritative persona switch

The message broadcasts to:
- All child iframes embedded inside dev-beta.aigentz.me (codex embeds, etc.)
- The parent window (when dev-beta is itself running inside a thin client like metame.live)

---

## 3. End-to-end thin-client flow

```typescript
// On thin-client load:
async function loadActivePersona() {
  const jwt = getSupabaseJwt();   // your existing thin-client auth state
  if (!jwt) return null;

  const res = await fetch('https://dev-beta.aigentz.me/api/wallet/active-persona', {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`active-persona ${res.status}`);
  return res.json();
}

// On mount:
const surface = await loadActivePersona();
renderHeader(surface);

// Listen for persona switches from the platform iframe:
window.addEventListener('message', async (event) => {
  if (event.origin !== 'https://dev-beta.aigentz.me') return;
  if (event.data?.type !== 'aa-persona-change-v1') return;
  const fresh = await loadActivePersona();
  renderHeader(fresh);
});

// Refresh proactively before sessionExpiresAt to avoid expired-token races:
setTimeout(() => {
  void loadActivePersona().then(renderHeader);
}, /* (sessionExpiresAt - now) - 60s */);
```

---

## 4. Persona deactivation (sign-out)

When the user signs out of the platform (via the wallet drawer "Sign out" button or session expiry), Supabase auth fires `SIGNED_OUT`. The platform's runtime listener clears local component state but **intentionally leaves `localStorage.currentPersonaId` intact** (see commit `ce218a5` — token-refresh failures incorrectly fired `SIGNED_OUT`, and wiping the persona id caused regressions).

**Implication for the thin client:** if the user signs out and back in, the same persona should re-resolve. The header may briefly show stale data during the sign-out → sign-in window; refetch when your auth state updates and the surface will be current.

If you want the thin client to receive an explicit sign-out event, one is not currently broadcast separately — fall back to your own auth-state listener.

---

## 5. Forbidden / common pitfalls

| Don't | Why |
|---|---|
| Use `personaId` from `aa-persona-change-v1` payload as a key | T0 server-internal handle; treat the message as a refetch trigger only |
| Cache the surface across user changes / sign-outs | `personaSessionToken` is opaque + rotating; stale tokens 401 |
| Display `ownFioHandle` to other personas / surfaces | This is the caller's own handle; cross-persona handle resolution is forbidden |
| Persist surface fields beyond render scope | Privacy posture — minimum-disclosure |
| Skip the `Authorization: Bearer` header | Endpoint will 401; the platform's `ACCESS_DEBUG_OPEN` bypass does NOT extend to this route |

---

## 6. Files

| File | Role |
|---|---|
| `app/api/wallet/active-persona/route.ts` | Endpoint implementation |
| `services/identity/getActivePersona.ts` | Server-side T0 resolver |
| `services/identity/personaSessionToken.ts` | T1 token issuer/verifier |
| `app/contexts/PersonaContext.tsx` | Persona switch broadcaster (`aa-persona-change-v1`) |
| `app/hooks/useActivePersona.ts` | Reference client-side consumer (uses the same endpoint internally) |
| `types/access.ts` | `ActivePersonaSurface` type definition |

---

## 7. Status & versioning

- **v1:** this contract. `ActivePersonaSurface` shape is the stable wire format.
- The opaque token format (`personaSessionToken`) may change without notice — never inspect it on the client.
- Adding fields to the response is non-breaking. Removing fields is breaking and will be announced.
- Plan §11.e (spine-native operator inspection) will eventually replace the debug bypass with a `cartridgeFlags.canInspectAccess` permission. No impact on this contract.
