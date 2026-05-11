# metaMe Client Protocols — Parent Contract + PersonaSpine Alignment

**Date:** 2026-05-12
**Workstream:** Shared client-side protocol contract for the metaMe ecosystem
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Canonical spec:** `docs/architecture/metame-client-protocols.md`
**Companion update:** `codexes/packs/agentiq/updates/2026-05-12_persona-spine-client-protocol.md`

---

## Why

Two adjacent client-side protocols emerged within hours of each other:

1. **PersonaSpine** (landed 2026-05-12, this PR's predecessor) — canonical client-side resolver for persona identity + auth bearer. Used by every surface that needs to render persona context or call `/api/*`.
2. **CartridgePresenceRegistry** (runtime-shell agent, in flight) — canonical client-side registry for which cartridge is mounted, which tab is active, and how the wallet opens a task across frame boundaries.

Both are `window`-level singletons + React hooks + postMessage event protocols. Without a shared contract, each would have picked its own event prefix (`aa-*` vs `metame:*`), its own namespace (`window.__personaSpine` vs `window.__metame.cartridges`), and its own origin enforcement rules — creating the exact class of drift the protocols are designed to eliminate.

Operator decision (locked 2026-05-12):

1. Single event prefix — `metame:*` — for both protocols and every future protocol.
2. Single `window.__metame` namespace, one key per protocol.
3. A parent contract document that both protocols (and all future ones) reference as the source of truth.

This PR delivers that parent contract and aligns PersonaSpine to it.

---

## What landed

### New — parent contract

| File | Purpose |
|---|---|
| `docs/architecture/metame-client-protocols.md` | The parent contract. Defines: `window.__metame` namespace, `metame:*` event taxonomy, cross-frame rules, privacy boundaries, reserved event/key roster, adoption rules for new protocols, versioning & deprecation discipline. |
| `types/metameWindow.ts` | Global `Window['__metame']` augmentation. Reserves keys for `persona`, `cartridges`, and four future protocols (notifications, receipts, approvals, capsules). Exports `METAME_EVENTS` as the single source of truth for canonical event names and `METAME_DEPRECATED_ALIASES` for one-release deprecations. |
| `utils/metameOriginAllowlist.ts` | Shared origin matcher for `metame:*` inbound events. Reads `configs/embed/policy.v1.json::authAllowedOrigins`. Supports exact, subdomain-wildcard, and port-wildcard patterns. |

### Changed — PersonaSpine aligned

| Concern | Before | After |
|---|---|---|
| Event name | `aa-persona-change-v1` | `metame:persona-changed` (canonical) + `aa-persona-change-v1` deprecated alias for one release, with `console.warn` on receipt |
| Revoke event | *(none)* | `metame:persona-revoked` — flips listening surfaces to `unauthenticated` without a re-fetch. Auto-emitted on Supabase `SIGNED_OUT`. |
| Cross-frame broadcast | Same-frame only | Same-frame **and** `window.parent` |
| Inbound origin check | None — all message events accepted | Origin allowlist enforced via `isMetameOriginAllowed()`; events from non-allowlisted origins silently dropped |
| Window mirror | None | `window.__metame.persona = { getSnapshot(), subscribe(), refresh() }` for non-React / cross-frame consumers |
| Spec doc | Standalone | References parent contract as canonical |

PersonaSpine's public API is unchanged — `usePersonaSpine`, `PersonaSpineGate`, `personaFetch`, `readPersonaSurface`, `refreshPersonaSpine`, `broadcastPersonaChange` all keep the same signatures. New: `broadcastPersonaRevoked()`.

---

## Reserved roster snapshot

Event names (full table in the parent contract):

| Event | Owner | Status |
|---|---|---|
| `metame:persona-changed` | PersonaSpine | live |
| `metame:persona-revoked` | PersonaSpine | live |
| `metame:cartridge-opened` | CartridgePresenceRegistry | reserved |
| `metame:cartridge-closed` | CartridgePresenceRegistry | reserved |
| `metame:cartridge-tab-changed` | CartridgePresenceRegistry | reserved |
| `metame:notification-posted` | future | reserved |
| `metame:receipt-finalized` | future | reserved |
| `metame:approval-requested` | future | reserved |
| `metame:approval-resolved` | future | reserved |
| `metame:capsule-mounted` | future | reserved |
| `metame:capsule-event` | future | reserved |

Window namespace keys:

| Key | Owner | Status |
|---|---|---|
| `window.__metame.persona` | PersonaSpine | live |
| `window.__metame.cartridges` | CartridgePresenceRegistry | reserved |
| `window.__metame.notifications` | future | reserved |
| `window.__metame.receipts` | future | reserved |
| `window.__metame.approvals` | future | reserved |
| `window.__metame.capsules` | future | reserved |

Deprecated aliases (one release):

| Deprecated | Canonical | Removal target |
|---|---|---|
| `aa-persona-change-v1` | `metame:persona-changed` | next release after 2026-05-12 |

---

## Compatibility

Fully backward compatible:

- Any surface that listens for `aa-persona-change-v1` still receives it (PersonaSpine dispatches both during the deprecation window).
- The `usePersonaSpine` / `PersonaSpineGate` / `personaFetch` public API is unchanged — Aigent Me's welcome tab needs no further changes.
- `broadcastPersonaChange(personaId?)` keeps the same signature; cross-frame broadcast is additive.
- Origin allowlist enforcement is *additive* — same-origin events still work as before; only cross-origin events are now gated (previously the listener silently accepted all origins, which was a latent XSS risk anyway).

---

## CartridgePresenceRegistry — handoff to the runtime-shell agent

The runtime-shell agent now has everything they need to land their protocol:

- **Namespace key reserved** — `window.__metame.cartridges` is augmented in `types/metameWindow.ts` with a `CartridgePresenceSnapshot` shape (`entries` map + `activeCartridgeId`).
- **Event names reserved** — `metame:cartridge-opened`, `metame:cartridge-closed`, `metame:cartridge-tab-changed`.
- **Origin allowlist available** — `utils/metameOriginAllowlist.ts::isMetameOriginAllowed()` is the shared inbound gate.
- **Parent contract describes the cross-frame rules** they must honor.

Their PR should:

1. Implement the registry + `useCartridgePresence` hook + `openTask({ cartridgeId, tab, subTab })` helper.
2. Publish to `window.__metame.cartridges` per the type augmentation.
3. Dispatch `metame:cartridge-*` events same-frame **and** to `window.parent`, with origin allowlist on inbound.
4. Add an entry to the parent contract's "The protocols (registry)" table linking their spec doc.
5. Land a migration sweep (one PR per existing cartridge) for the `useCartridgePresence` adoption.

---

## Validation

- `aa-persona-change-v1` continues to invalidate PersonaSpine (with deprecation warning logged once per page load).
- New `metame:persona-changed` invalidates PersonaSpine from same-frame and parent-frame senders on the allowlist.
- `window.__metame.persona.getSnapshot()` returns the current `{status, surface, error}` from anywhere in the page (including cross-frame `iframe.contentWindow.__metame.persona`).
- A `Supabase SIGNED_OUT` event flips PersonaSpine to `unauthenticated` and broadcasts `metame:persona-revoked` to any parent shell.
- Cross-origin events from non-allowlisted origins are dropped silently.

---

## Files

- `docs/architecture/metame-client-protocols.md` — parent contract (NEW)
- `types/metameWindow.ts` — Window augmentation + canonical event/alias tables (NEW)
- `utils/metameOriginAllowlist.ts` — origin matcher (NEW)
- `utils/personaSpine.tsx` — aligned implementation (CHANGED)
- `docs/architecture/persona-spine-client-protocol.md` — spec updated to reference parent contract (CHANGED)
- `codexes/packs/agentiq/updates/2026-05-12_metame-client-protocols-parent-contract.md` — this update entry (NEW)
