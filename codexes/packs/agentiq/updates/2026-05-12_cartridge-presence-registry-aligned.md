# CartridgePresenceRegistry — aligned to metaMe client protocol parent contract

**Date filed:** 2026-05-12
**Workstream:** Cross-cartridge navigation foundation (paired with PersonaSpine under the shared `metame:*` protocol family)
**Severity:** medium-high (unblocks wallet → cartridge deep-links, layered-cartridge close chrome, and every future multi-cartridge orchestration)
**Discovered by:** Operator review while testing wallet task chips on dev-beta 2026-05-11; converged with PersonaSpine's parent-contract refactor 2026-05-12

---

## Context

Two independent client-side protocols were being drafted in parallel:

- **PersonaSpine** (other agent) — canonical client-side identity resolver with cross-frame postMessage broadcast.
- **CartridgePresenceRegistry** (this workstream) — single source of truth for mounted cartridges + tab/sub-tab state for wallet & cross-cartridge navigation.

Both needed the same primitives — a `window.__metame.*` namespace, a `metame:*` event taxonomy, cross-frame rules with origin enforcement. Rather than ship two near-identical contracts, the operator paused this workstream so the parent contract could be drafted first; this commit lands the aligned CartridgePresenceRegistry behind it.

Parent contract: `docs/architecture/metame-client-protocols.md` (landed `3f7eb36d`).

## What changed since the first draft

The first draft (commits `9d3b6800` + earlier on `claude/review-session-setup-V82mB`) used bespoke names. The aligned implementation replaces them with the canonical ones:

| Concern | First draft | Aligned to parent contract |
|---|---|---|
| Window key | `window.__metameCartridgeRegistry` (bespoke) | `window.__metame.cartridges` (canonical namespace) |
| Mirror shape | Internal Map exposed directly | Canonical `CartridgePresenceMirror` (`getSnapshot()` + `subscribe()`) from `types/metameWindow.ts` |
| Entry shape | Internal-fields exposed (`mode`, `mountedAt`) | Canonical `CartridgePresenceEntry` (`cartridgeId, displayLabel, active, setTab?, setSubTab?, close?`) — internal fields kept private |
| Outbound event | `metame:cartridge-state-changed` | `metame:cartridge-tab-changed` (per `METAME_EVENTS.CARTRIDGE_TAB_CHANGED`) |
| Inbound `set-tab` event | Custom `metame:cartridge-set-tab` | Dropped (not reserved in parent contract; in-app `tryOpenInMountedCartridge` covers the use case) |
| Inbound origin gate | None | `isMetameOriginAllowed(event.origin)` enforced |
| Cross-frame broadcast | `window.parent` only | Same-frame **and** `window.parent` (parent contract rule §3) |
| Schema versioning | None | `schemaVersion: 1` on every event payload |

The public same-frame imperative API (`registerCartridge`, `deregisterCartridge`, `updateCartridgeState`, `getCartridge`, `getActiveCartridge`, `listCartridges`, `subscribe`, `tryOpenInMountedCartridge`) is unchanged in shape — only the underlying transport mechanics and types were re-pointed at the canonical contract.

The `useCartridgePresence` hook signature is unchanged for callers.

## Files

| File | Change |
|---|---|
| `services/cartridge/CartridgePresenceRegistry.ts` | Rewrite — honours parent contract |
| `app/hooks/useCartridgePresence.ts` | Rewrite — uses `METAME_EVENTS` + `isMetameOriginAllowed` |
| `docs/architecture/cartridge-presence-registry.md` | New — canonical spec doc |
| `docs/architecture/metame-client-protocols.md` | Protocol registry table updated to point at this implementation; coordination history entry added |
| `app/triad/components/codex/tabs/KnytTab.tsx` | (no change in this commit — hook call already wired in `9d3b6800` and import path unchanged) |
| `app/components/content/SmartWalletDrawer.tsx` | (no change in this commit — `tryOpenInMountedCartridge` call already wired in `9d3b6800` and the function's return shape didn't change) |
| `codexes/packs/agentiq/collections.json` | Adds this updates doc; removes the previous (pre-alignment) doc reference |
| `codexes/packs/agentiq/updates/2026-05-11_cartridge-presence-registry-spec.md` | Removed — superseded by `docs/architecture/cartridge-presence-registry.md` |
| `app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` | Merge resolution combining the wallet-side branch-mapping (`vote→canon`, `contribute→community`, `dispatch→correspondent`) with the existing submission-shell auto-open on the contribute slug |

## Adjacency with PersonaSpine

Both protocols now share:

- The `window.__metame.*` namespace (`persona`, `cartridges` keys reserved + typed).
- The `metame:*` event prefix and `METAME_EVENTS` constant table.
- The `isMetameOriginAllowed()` allowlist for every inbound listener.
- The same cross-frame rules (same-frame mirror + parent broadcast, origin enforced on inbound, no T0 in payloads).

A future protocol (NotificationsBus, ReceiptsStream, ApprovalsQueue, CapsuleEvents — all reserved) lands the same shape with no further design work.

## Acceptance criteria

- [x] `window.__metame.cartridges` mirror is published by `services/cartridge/CartridgePresenceRegistry.ts` and visible from any same-tab frame.
- [x] All outbound events use canonical `METAME_EVENTS.CARTRIDGE_*` names.
- [x] Inbound `metame:cartridge-closed` is honoured only when `isMetameOriginAllowed(event.origin)` returns true.
- [x] Same-frame mirror via `window.postMessage(msg, window.location.origin)` is wired (in-frame listeners receive every broadcast).
- [x] Parent broadcast via `window.parent.postMessage(msg, '*')` is wired (shell layer receives presence + tab events).
- [x] No T0 or T1 persona content appears in any event or in the mirror snapshot.
- [x] Parent contract's protocol registry table updated to point at the canonical implementation.
- [x] Spec doc lives in `docs/architecture/cartridge-presence-registry.md` (per parent contract §"Adoption rules for new protocols").

## Follow-up backlog (non-blocking)

- Land `useCartridgePresence` calls in the 9 remaining cartridges (per the migration table in the spec doc).
- Build `app/components/cartridge/CartridgeLayer.tsx` wrapper for wallet-launched layered mounts (supplies `onClose` so the shell × can land).
- Lovable thin-client shell subscribes to `metame:cartridge-*` events and renders header chrome (cartridge icon + close button). Pass them `docs/architecture/cartridge-presence-registry.md`.

## References

- Parent contract: `docs/architecture/metame-client-protocols.md`
- PersonaSpine spec: `docs/architecture/persona-spine-client-protocol.md`
- This protocol's spec: `docs/architecture/cartridge-presence-registry.md`
- TypeScript namespace augmentation: `types/metameWindow.ts`
- Origin allowlist util: `utils/metameOriginAllowlist.ts`
- Predecessor (non-aligned) ops backlog: `codexes/packs/agentiq/updates/2026-05-10_knyt-tasks-operationalization-backlog.md`
