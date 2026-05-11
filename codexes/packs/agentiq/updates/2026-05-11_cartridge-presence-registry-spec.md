# Cartridge Presence Registry + `metame:cartridge-*` postMessage Spec

**Date filed:** 2026-05-11
**Workstream:** Cross-cartridge navigation foundation (unblocks wallet→cartridge deep-links, layered-cartridge close chrome, and future multi-cartridge orchestration)
**Severity:** medium-high (today the wallet's task chips half-work — Living Canon routes but the others don't, and a layered cartridge has no close button)
**Discovered by:** Operator review while testing wallet task chips on dev-beta, 2026-05-11

---

## Problem

The platform has 10 cartridges (KNYT, Qriptopian, AgentiQ, AgentiQ OS, Venture Lab α, metaMe, Marketa, Aigent MoneyPenny, Aigent Nakamoto, and the multi-cartridge viewer composite). Today every cross-cartridge interaction reinvents its own routing:

- Wallet "Open Episodes" chip dispatches a `knyt:navigate-tab` window event — works only inside the KNYT cartridge.
- Wallet "Vote on open elections" chip parks a slug on `window.__knytPendingTaskSlug` — works only because the destination tab reads that exact key.
- The codex shell can open a cartridge as a layer, but the layer has no close button if it wasn't opened by the shell itself (e.g. when the wallet opens it).
- Cross-cartridge `buildCodexUrl` always reloads the codex shell, even when the target cartridge is already mounted somewhere on screen.

The result: every new caller adds a new branch ("am I in this cartridge? in that one? in the iframe? top-level?"), and shell chrome can't track what's open.

## Solution: one registry + one protocol

### Layer 1 — in-app `CartridgePresenceRegistry`

A singleton on `window.__metameCartridgeRegistry` (typed) holds the set of currently mounted cartridges. Each entry:

```ts
{
  cartridgeId: 'knyt-codex' | 'qriptopian' | ...,
  displayLabel: 'KNYT Cartridge',
  tab?: string,
  subTab?: string,
  setTab?: (tab: string) => void,
  setSubTab?: (subTab: string) => void,
  close?: () => void,
  mode: 'inline' | 'layer',
  mountedAt: number,
}
```

Every cartridge top-level component publishes itself via `useCartridgePresence` on mount (and removes itself on unmount). The registry exposes:

- `getCartridge(id)` / `getActiveCartridge()` / `listCartridges()`
- `tryOpenInMountedCartridge({ cartridgeId, tab, subTab })` — switches tab in place if mounted; returns `false` if not (so the caller can fall through to a full URL navigation).
- `subscribe(listener)` — for UI that reflects what's open (e.g. the shell header).

**File:** `services/cartridge/CartridgePresenceRegistry.ts`

### Layer 2 — `metame:cartridge-*` postMessage protocol

When the app runs inside the Lovable thin-client iframe (or any host shell), the hook broadcasts the cartridge lifecycle via `window.parent.postMessage` so the shell can render chrome — cartridge icon, breadcrumb, close button — even though it doesn't own the cartridge component itself.

#### App → Shell

| Type | Payload | Fires when |
|---|---|---|
| `metame:cartridge-opened` | `{ cartridgeId, displayLabel, tab?, subTab?, mode }` | Cartridge mounts |
| `metame:cartridge-state-changed` | `{ cartridgeId, tab?, subTab? }` | Cartridge changes tab / sub-tab |
| `metame:cartridge-closed` | `{ cartridgeId }` | Cartridge unmounts |

The shell's responsibilities on receipt:
- `opened` — push a header item for the cartridge with its icon + a × that posts back `metame:cartridge-close`. Track open cartridges (a stack, since multiple may be layered).
- `state-changed` — update breadcrumbs / analytics; no UI change required by default.
- `closed` — pop the header item.

#### Shell → App

| Type | Payload | Effect on the app |
|---|---|---|
| `metame:cartridge-close` | `{ cartridgeId }` | Hook invokes the cartridge's `onClose` (provided by the layered-mount harness) |
| `metame:cartridge-set-tab` | `{ cartridgeId, tab?, subTab? }` | Hook invokes the cartridge's `onSetTab` / `onSetSubTab` |

`cartridgeId` matching: if omitted, the hook applies to whichever cartridge it's attached to. If provided, it must match or the message is ignored.

### Layer 3 — wallet & cross-cartridge callers

Replace today's ad-hoc patterns with a single helper:

```ts
// services/cartridge/openTask.ts (next commit)
export function openTask({ cartridgeId, tab, subTab }) {
  if (tryOpenInMountedCartridge({ cartridgeId, tab, subTab })) return;
  // Not mounted → full navigation via the codex shell URL.
  let url = buildCodexUrl(cartridgeId, { tab, personaId, from: 'wallet' });
  if (subTab) url += `&subTab=${encodeURIComponent(subTab)}`;
  window.location.href = url;
}
```

The wallet drawer's `navigateToKnytTab` shrinks to one line: `openTask({ cartridgeId: 'knyt-codex', tab, subTab: taskSlug })`. Same for every future caller — they don't have to know whether the cartridge is mounted, in what frame, or which event it listens to.

---

## Per-cartridge migration

Each cartridge top-level component adds **one hook call**. The mapping:

| Cartridge | Top file | activeTab state | Hook call |
|---|---|---|---|
| **KNYT** (`knyt-codex`) | `app/triad/components/codex/tabs/KnytTab.tsx` | `activeTab` | `useCartridgePresence({ cartridgeId: 'knyt-codex', displayLabel: 'KNYT Cartridge', tab: activeTab, onSetTab: setActiveTab })` |
| **Qriptopian** | `QriptopiaTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'qriptopian', displayLabel: 'Qriptopian Cartridge' })` |
| **AgentiQ** | `AgentiqCartridgeTab.tsx` | `activePath` | `useCartridgePresence({ cartridgeId: 'agentiq', displayLabel: 'AgentiQ Cartridge', tab: activePath, onSetTab: setActivePath })` |
| **AgentiQ OS** | `AgentiQOSTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'agentiq-os', displayLabel: 'AgentiQ OS' })` |
| **Venture Lab α** | `KnytAlphaTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'alpha-knyt', displayLabel: 'Venture Lab α' })` |
| **metaMe** | delegates to `AgentiqCartridgeTab` | (inherits `activePath`) | Same as AgentiQ, with `cartridgeId: 'metame'`, `displayLabel: 'metaMe Cartridge'` |
| **Marketa** | `MarketaTab.tsx` | `activeParent` + `adminSub`/`partnerSub` | `useCartridgePresence({ cartridgeId: 'marketa', displayLabel: 'Marketa', tab: activeParent, subTab: activeParent === 'admin' ? adminSub : partnerSub, onSetTab: setActiveParent, onSetSubTab: activeParent === 'admin' ? setAdminSub : setPartnerSub })` |
| **Aigent MoneyPenny** | `MoneyPennyCartridge.tsx` | `activeTab` | `useCartridgePresence({ cartridgeId: 'aigent-moneypenny', displayLabel: 'Aigent MoneyPenny', tab: activeTab, onSetTab: setActiveTab })` |
| **Aigent Nakamoto** | `NakamotoTab.tsx` | `activeTab` + nested `tabState` | `useCartridgePresence({ cartridgeId: 'aigent-nakamoto', displayLabel: 'Aigent Nakamoto', tab: activeTab, subTab: tabState?.sub, onSetTab: setActiveTab, onSetSubTab: (s) => setTabState({ ...tabState, sub: s }) })` |

Stateless cartridges still call the hook — the registry needs to know they're mounted even if they have no tab state, so the wallet / cross-cartridge callers don't try to URL-navigate to a cartridge that's already visible.

---

## Layered mount harness

When the wallet (or any caller) opens a cartridge as a layer, a small wrapper component supplies `onClose` so the shell's × button has somewhere to land. Shape:

```tsx
// app/components/cartridge/CartridgeLayer.tsx (next commit)
function CartridgeLayer({ cartridgeId, initialTab, initialSubTab, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md">
      <CartridgeRenderer
        cartridgeId={cartridgeId}
        initialTab={initialTab}
        initialSubTab={initialSubTab}
        onClose={onDismiss}
        mode="layer"
      />
    </div>
  );
}
```

`CartridgeRenderer` is a thin switch that maps `cartridgeId → top-level component` and forwards `mode='layer'` + `onClose` so `useCartridgePresence` picks them up. The wallet's `openTask` mounts a `CartridgeLayer` when `tryOpenInMountedCartridge` returns false AND we're inside the thin client (so a full URL navigation would unmount the wallet, which we don't want for a deep-link).

---

## Acceptance criteria

- [ ] `services/cartridge/CartridgePresenceRegistry.ts` exists and exports `registerCartridge`, `deregisterCartridge`, `updateCartridgeState`, `getCartridge`, `getActiveCartridge`, `listCartridges`, `subscribe`, `tryOpenInMountedCartridge`.
- [ ] `app/hooks/useCartridgePresence.ts` exists; calling it from a component mounts/unmounts the registry entry and broadcasts the postMessage protocol.
- [ ] KNYT (`KnytTab.tsx`) is wired as the canonical example — calling `useCartridgePresence` from its body publishes `tab` changes and listens for inbound `metame:cartridge-set-tab` / `metame:cartridge-close`.
- [ ] Wallet drawer's `navigateToKnytTab` consults `tryOpenInMountedCartridge` first and falls through to `buildCodexUrl` only when the target cartridge isn't mounted.
- [ ] All 10 cartridges have the one-line hook call added (follow-up commit; non-blocking for the foundation).
- [ ] Lovable thin-client shell subscribes to `metame:cartridge-opened` / `metame:cartridge-closed` / `metame:cartridge-state-changed` and renders the cartridge icon + × close button in the shell header. (Owned by the Lovable team — pass them this doc.)

---

## Tradeoffs

- **Window-level singleton.** The registry lives on `window.__metameCartridgeRegistry`, which means it's per-tab. Multiple tabs of the same app each have their own registry — that's the correct behavior; cartridges aren't shared across tabs.
- **One mount per cartridge.** If two callers try to mount the same cartridge simultaneously (e.g. the codex shell shows KNYT AND the wallet tries to open KNYT as a layer), the second registration warns and overwrites. The product model doesn't currently support two visible instances of the same cartridge, so this is acceptable.
- **postMessage is `'*'` target origin.** The host shell may live on a different origin (Lovable thin client embeds the AigentZ app). We accept any origin for the outbound broadcast; the inbound listener filters on `data.type` + `data.cartridgeId` rather than origin, which is a deliberate tradeoff (the cost of constraining origin is that local-dev breaks under split hosts). If the protocol becomes security-sensitive later, swap `'*'` for a configured allowlist via `NEXT_PUBLIC_TRUSTED_SHELL_ORIGINS`.
- **Stateless cartridges call the hook anyway.** Trivial cost; the alternative (skip the hook) means callers can't tell whether the cartridge is open, and the shell's header doesn't render chrome for layered stateless cartridges.

---

## References

- Prior ad-hoc routing (deprecated by this work):
  - `app/triad/components/codex/tabs/KnytTab.tsx` — `knyt:navigate-tab` window-event listener (line ~657)
  - `app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` — `window.__knytPendingTaskSlug` mount-time consumer (added 2026-05-11)
  - `app/components/content/SmartWalletDrawer.tsx` — `navigateToKnytTab` (in-cartridge event-dispatch vs. cross-cartridge `buildCodexUrl` branch)
- Related: `utils/codex-nav.ts` `buildCodexUrl` — still the canonical cross-cartridge URL helper, used by `openTask` when the cartridge isn't mounted.
- Predecessor wallet ops backlog: `2026-05-10_knyt-tasks-operationalization-backlog.md` (item #2 — 21 Sats tab side of taskSlug consumption — partially closed by this work).
