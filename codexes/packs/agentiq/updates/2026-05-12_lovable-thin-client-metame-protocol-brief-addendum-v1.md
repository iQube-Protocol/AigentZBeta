# Lovable Thin-Client Integration Brief — Addendum v1

**Date filed:** 2026-05-12 (later same day)
**Supersedes:** Sections 2 + 4 of `2026-05-12_lovable-thin-client-metame-protocol-brief.md` (the rest still stands)
**Status:** Pattern A confirmed + live. Cartridge-close fix shipped. New ergonomics for the shell.

---

## Quick recap of what changed since the original brief

1. **`/api/wallet/active-persona` cannot be called from the shell origin** (we confirmed — the route requires a Supabase Bearer token that lives only in the iframe's localStorage). Pattern A is the answer: the iframe puts the inline T1 surface into the persona-changed event payload, and the shell renders directly from that.

2. **Cartridge close intent now actually does something in the iframe.** Previously the iframe received `metame:cartridge-closed` and silently no-op'd. That's fixed.

3. **Two new event payload fields** the shell can rely on (canonical persona event payload, plus `cartridgeId` echo on close acknowledgments).

---

## 1. PersonaSpine — Pattern A is live (canonical event now carries inline T1 surface)

The `metame:persona-changed` event broadcast by the iframe now includes the full T1 `surface` object inline. The shell does not need to (and cannot) call `/api/wallet/active-persona` directly.

### Updated payload shape

```ts
{
  type: 'metame:persona-changed',
  schemaVersion: 1,

  // Top-level convenience fields (back-compat with the legacy event).
  // Use these for the simplest receivers; for new code prefer `surface`.
  personaId?: string,            // T0 hint — DO NOT render directly; for analytics only
  displayLabel?: string,         // T1 — user-chosen pet name
  ownFioHandle?: string,         // T1 — caller's own FIO handle (never cross-persona)

  // Typed nested object — preferred for structured consumers.
  surface?: {
    personaSessionToken: string,           // opaque, signed, short-lived
    identifiability: 'PUBLIC' | 'AGGREGATED' | 'PRIVATE',
    cartridgeFlags: { isAdmin: boolean, isPartner: boolean },
    cohortMemberships: string[],
    sessionExpiresAt: string,              // ISO-8601
    displayLabel?: string,
    ownFioHandle?: string,                 // own only — never another persona's
  },
}
```

### What the shell should render from this

| Shell UI element | Field |
|---|---|
| Persona avatar / initials | `surface.displayLabel` (fallback: `displayLabel` top-level → `ownFioHandle` → `'Be'`) |
| Persona dropdown label | Same as avatar |
| Admin / partner indicator | `surface.cartridgeFlags.isAdmin` / `.isPartner` |
| Cohort badges | `surface.cohortMemberships` (array of slugs — your styling) |
| Session expiry warning | `surface.sessionExpiresAt` (refresh comes ~60s before expiry; the next event will land before then) |

### Privacy reminders

- **Do not render `personaId`** anywhere user-visible. It's a T0 server-internal id; the legacy top-level field is kept only for backward-compat hints. Use `displayLabel` / `ownFioHandle` for display.
- **`ownFioHandle` is the caller's own handle only** — the iframe will never broadcast another persona's handle. If you ever see one that doesn't match the active persona, that's a bug — report it.
- **`personaSessionToken` is opaque.** Do not parse it, do not use it as a user identifier. It's only useful if you ever need to forward it back into the iframe via a URL param (you typically don't).

### Deprecation window

`aa-persona-change-v1` is still emitted with the same payload for one release. Listeners can subscribe to either; we recommend migrating to `metame:persona-changed` and dropping the alias.

### When the event fires

The iframe broadcasts `metame:persona-changed` in three situations:

| Trigger | `source` log line | Notes |
|---|---|---|
| Initial mount / auth restore | `source=initial` | Fires once after the iframe hydrates persona state from localStorage. |
| User switches persona inside the app | `source=switch` | Fires immediately on the switch, before the API round-trip completes — re-fires once the surface lands. |
| Token refresh / silent re-issue | `source=refresh` | Optional; lets the shell update its session-expiry chrome. |

**Use the latest event as authoritative.** If you cache the event, key it on the iframe instance — switching iframes clears your cache.

---

## 2. CartridgePresenceRegistry — close intent now responded to

### What was broken

The iframe received `{ type: 'metame:cartridge-closed', cartridgeId }` from the shell and did nothing visible — the shell saw no acknowledgment.

### What's fixed

Inbound `metame:cartridge-closed` from a cross-frame source (origin-allowlisted) now causes the iframe to:

1. Navigate the codex view to a minimal `/triad/embed/codex-closed?cartridgeId=<id>` page that renders nothing visible.
2. From that page, re-broadcast `{ type: 'metame:cartridge-closed', cartridgeId, schemaVersion: 1 }` back to the shell (and same-frame).

### What this means for the shell

You now have an **acknowledgment loop**:

```
Shell → iframe: { type: 'metame:cartridge-closed', cartridgeId: 'knyt-codex' }
                   (your × button click)

Iframe → Shell: { type: 'metame:cartridge-closed', cartridgeId: 'knyt-codex', schemaVersion: 1 }
                   (acknowledgment — iframe has cleared its content)
```

If you don't get the acknowledgment within ~500 ms, treat it as the iframe being unresponsive (offline / not loaded yet) and proceed to remove the iframe yourself anyway.

### What the shell should do after receiving the ack

Two reasonable patterns — pick whichever fits your UX:

- **Hard teardown** (recommended): remove the iframe `<iframe>` element from your DOM. The acknowledgment confirms the iframe is in a clean closed state, so removal is safe.
- **Soft hide**: just hide the iframe (`display: none`). It stays parked at `/triad/embed/codex-closed` and can be re-shown if the user re-opens that cartridge. Slightly faster on re-open since no Next.js cold-load.

### Same-origin echo handling on the iframe side

The iframe's listener now ignores `event.source === window` so the unmount-time outbound CLOSED broadcast doesn't loop back into its own onClose. You don't need to do anything for this — it's purely an internal robustness fix.

---

## 3. Persona switching from the shell (future — propose only if you need it)

Currently persona switching is **iframe-driven** — the user opens the persona switcher inside the wallet and picks a persona. The iframe broadcasts `metame:persona-changed` to the shell; the shell mirrors.

If you want to add a persona dropdown in the **shell header** that drives the switch, we'd reserve a new inbound event:

```ts
// Shell → iframe
{ type: 'metame:persona-set-active', personaId: '<the personaId from a prior persona-changed event>', schemaVersion: 1 }
```

The iframe would honor this by:
1. Origin-checking via the allowlist (already in place for `metame:cartridge-closed`).
2. Calling `setActivePersonaId(personaId)` in PersonaContext.
3. Re-broadcasting `metame:persona-changed` once the new surface lands (which the shell will already see and consume).

**Reserve this only if needed.** It requires:
- The shell to remember persona IDs from prior `metame:persona-changed` events (so it can target a switch). Storing T0 personaId in shell memory is fine for the duration of the session as long as it's not persisted or sent off-shell.
- An entry in the `metame:*` event roster + `METAME_EVENTS` constant in `types/metameWindow.ts`.

If you want this, send back a request and I'll reserve the name and ship the iframe-side handler.

---

## 4. Other things you might need from the iframe

Reserved but not yet implemented — let us know if any of these are blocking:

| Need | Today | Future event we'd reserve |
|---|---|---|
| Open a specific cartridge from the shell | Shell navigates the iframe to `/triad/embed/codex/<cartridge-slug>` | Could add `metame:cartridge-open { cartridgeId, tab?, subTab? }` if URL-nav is awkward |
| Switch tab inside an open cartridge from the shell | Shell can navigate iframe to `?tab=<tab-slug>` | Could add inbound `metame:cartridge-tab-changed` (same event name, both directions) if URL-nav unwanted |
| Get notified when a wallet receipt finalizes | Not yet wired | `metame:receipt-finalized` reserved in parent contract |
| Get notified of approval requests (e.g. signing, payment confirmation) | Not yet wired | `metame:approval-requested` / `metame:approval-resolved` reserved |
| Get notification toasts | Not yet wired | `metame:notification-posted` reserved |

All reservations are in the parent contract roster (`docs/architecture/metame-client-protocols.md`). Each one can ship in 1–2 small commits when you have a concrete shell UI for it.

---

## 5. Things we need from you (Lovable)

| Need | Why | Action |
|---|---|---|
| Confirm your shell origin is allowlisted in `configs/embed/policy.v1.json::authAllowedOrigins` | Inbound events from non-allowlisted origins are silently dropped | Currently allowlisted (and `frameAncestors`-allowed): `*.lovable.app`, `*.lovable.dev`, `*.lovableproject.com`, `metamert.lovable.app`. If your prod host is anything else (e.g. `metame.live`, `metame.dev`, `runtime.metame.com` — all already on the list), you're fine. New host? Send it. |
| Confirm you're listening for **both** `metame:persona-changed` AND `aa-persona-change-v1` during the deprecation window | We emit both for one release | Either is fine; prefer canonical. Drop the alias when you've migrated. |
| Confirm whether you want shell-driven persona switching (§3 above) | Decides whether we reserve `metame:persona-set-active` now or later | Reply yes/no. |
| Confirm your iframe-removal pattern on cartridge close | Tells us whether to keep the soft-close `/triad/embed/codex-closed` route as the canonical iframe state, or treat iframe removal as the canonical close | Either pattern works; tell us which you'll use so we can document the canonical contract. |
| Test once this build deploys (commit hash will be in the next reply) | Verify all four chains | See checklist below |

---

## 6. Updated end-to-end testing checklist

After this build deploys to `dev-beta.aigentz.me`:

### Persona

- [ ] Sign in to the embedded app — shell receives `metame:persona-changed` with `surface.displayLabel` populated. Shell header renders the avatar / label without making any API call.
- [ ] Switch persona inside the app — shell receives a fresh `metame:persona-changed` with the new `surface`. Header updates.
- [ ] Sign out — shell receives `metame:persona-revoked`. Header flips to unauthenticated CTA.
- [ ] Inspect the event payload in DevTools — confirm `surface.personaSessionToken`, `cartridgeFlags`, `cohortMemberships`, `sessionExpiresAt` all present.
- [ ] Shell should NEVER call `/api/wallet/active-persona` directly — confirm by watching the network tab in the shell context.

### Cartridge presence

- [ ] Open the KNYT codex — shell receives `metame:cartridge-opened { cartridgeId: 'knyt-codex', displayLabel: 'KNYT' }`. Header shows the cartridge tile.
- [ ] Switch tabs inside KNYT (Codex → Store → Living Canon) — shell receives `metame:cartridge-tab-changed` for each switch.
- [ ] Click × on the KNYT tile in the shell header — shell sends `metame:cartridge-closed { cartridgeId: 'knyt-codex' }`. Within ~200ms, shell receives `metame:cartridge-closed { cartridgeId: 'knyt-codex', schemaVersion: 1 }` back as acknowledgment. Shell can then remove the iframe.
- [ ] Try sending a close intent for a cartridge that isn't currently open — shell should not receive an ack (iframe ignores). Time out gracefully.

### Wallet → cartridge deep-links (sanity)

- [ ] Wallet → Living Canon "Vote on open elections" — shell receives `metame:cartridge-tab-changed { cartridgeId: 'knyt-codex', tab: 'living-canon' }`. Inside the iframe, the 21 Sats tab opens on the **canon** sub-branch.
- [ ] Wallet → Bring-a-Knight "Share Invite" — opens the SocialSharingModal full-screen inside the iframe. Shell may see no event (this is an in-iframe modal, not a cartridge change).

---

## 7. References

- Original brief: `codexes/packs/agentiq/updates/2026-05-12_lovable-thin-client-metame-protocol-brief.md`
- Parent contract: `docs/architecture/metame-client-protocols.md`
- PersonaSpine spec: `docs/architecture/persona-spine-client-protocol.md`
- CartridgePresenceRegistry spec: `docs/architecture/cartridge-presence-registry.md`
- Origin allowlist: `configs/embed/policy.v1.json::authAllowedOrigins`
- T1 surface type: `types/access.ts::ActivePersonaSurface`
- Reserved event roster: parent contract §"Reserved event-name roster"

---

Reply with answers to the five "what we need from you" rows + any signal on §3 / §4 reservations and we'll keep iterating.
