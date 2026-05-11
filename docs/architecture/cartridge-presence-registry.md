# CartridgePresenceRegistry — Client Protocol

**Status:** Canonical · introduced 2026-05-12
**Parent contract:** [`metame-client-protocols.md`](./metame-client-protocols.md)
**Owner:** runtime-shell. Honours the parent contract's three shared primitives (window namespace, event taxonomy, cross-frame rules).
**Scope:** Cross-cartridge tab/sub-tab navigation, layered-cartridge close chrome, and "is cartridge X open?" presence resolution.

---

## What it does

Maintains a single source of truth for the set of cartridges currently mounted in this app instance — what they are, what tab/sub-tab they're on, and how to switch or close them. The wallet, runtime, copilot, and cross-cartridge links all consult one registry instead of reinventing routing.

Before the registry: wallet's Living Canon chip half-worked via a one-off `window.__knytPendingTaskSlug` mechanism while Bring-a-Knight / Herald / Open-Episodes chips silently no-op'd in embedded copilot views. After: one helper (`tryOpenInMountedCartridge`) handles every path.

## Honoured contract

### Window namespace

```ts
window.__metame.cartridges: CartridgePresenceMirror
```

`CartridgePresenceMirror` shape (canonical — defined in `types/metameWindow.ts`):

```ts
interface CartridgePresenceMirror {
  getSnapshot(): CartridgePresenceSnapshot;
  subscribe(listener: () => void): () => void;
}

interface CartridgePresenceSnapshot {
  entries: Record<string, CartridgePresenceEntry>;
  activeCartridgeId: string | null;
}

interface CartridgePresenceEntry {
  cartridgeId: string;
  displayLabel: string;
  active: boolean;
  setTab?: (tab: string) => void;
  setSubTab?: (slug: string) => void;
  close?: () => void;
}
```

The in-frame module store remains authoritative. The window mirror is a read-only snapshot for non-React consumers (vanilla JS, debug console, cross-frame `contentWindow.__metame`).

### Events

| Event | Direction | Payload |
|---|---|---|
| `metame:cartridge-opened` | layer → shell (and same-frame) | `{ cartridgeId, displayLabel, schemaVersion: 1 }` |
| `metame:cartridge-closed` | layer ↔ shell (and same-frame) | `{ cartridgeId, schemaVersion: 1 }` |
| `metame:cartridge-tab-changed` | layer → shell (and same-frame) | `{ cartridgeId, tab, subTab?, schemaVersion: 1 }` |

The hook broadcasts each event to **both** same-frame (`window.postMessage(msg, window.location.origin)`) and `window.parent` (`postMessage(msg, '*')`). The parent decides whether to act per its own allowlist.

### Inbound origin allowlist

Inbound `metame:cartridge-closed` from a parent shell is gated through `isMetameOriginAllowed(event.origin)` (per `configs/embed/policy.v1.json::authAllowedOrigins`). Other origins are silently dropped.

`metame:cartridge-closed` is the only inbound event the registry honours today. Tab control from the shell is **not** yet reserved in the parent contract; in-app cross-cartridge navigation already covers the use case (the wallet calls `tryOpenInMountedCartridge` in-process). A future amendment can add a shell-driven tab control event if needed.

### Privacy

No T0 or T1 persona content in events or the window mirror — only surface identity (`cartridgeId`, `displayLabel`, `tab`, `subTab`). Per the parent contract §"Privacy boundaries".

## Implementation

| File | Role |
|---|---|
| `services/cartridge/CartridgePresenceRegistry.ts` | Module-level store + imperative API + `window.__metame.cartridges` mirror |
| `app/hooks/useCartridgePresence.ts` | The one-line hook every cartridge top-level component calls |
| `types/metameWindow.ts` | Canonical `CartridgePresenceEntry` + `CartridgePresenceSnapshot` types (owned by parent contract) |
| `utils/metameOriginAllowlist.ts` | Shared origin matcher used by the hook's inbound listener |

### Public API (imperative — same-frame)

```ts
import {
  registerCartridge,
  deregisterCartridge,
  updateCartridgeState,
  getCartridge,
  getActiveCartridge,
  listCartridges,
  subscribe,
  tryOpenInMountedCartridge,
} from '@/services/cartridge/CartridgePresenceRegistry';
```

`register` / `deregister` / `update` are called only by the hook. `get` / `list` / `subscribe` are for any same-frame consumer. `tryOpenInMountedCartridge` is the one helper the wallet + cross-cartridge callers should use:

```ts
const opened = tryOpenInMountedCartridge({
  cartridgeId: 'knyt-codex',
  tab: 'living-canon',
  subTab: 'knyt:living-canon-vote',
});
if (!opened) {
  // Cartridge not mounted — fall through to a full URL navigation.
  window.location.href = buildCodexUrl('knyt-codex', { tab, personaId, from: 'wallet' });
}
```

### Hook

```ts
import { useCartridgePresence } from '@/app/hooks/useCartridgePresence';

useCartridgePresence({
  cartridgeId: 'knyt-codex',
  displayLabel: 'KNYT Cartridge',
  tab: activeTab,
  subTab: activeSubTab,            // optional
  onSetTab: setActiveTab,
  onSetSubTab: setActiveSubTab,    // optional
  onClose,                         // only when mounted as a layer
  mode: 'inline' | 'layer',        // defaults to 'inline'
});
```

Stateless cartridges still call the hook (omit tab / setters) so that wallet + cross-cartridge callers can see "this cartridge is mounted" and route around it correctly.

## Per-cartridge migration

Each cartridge top-level component adds **one hook call**. KNYT is wired as the canonical example in this commit; the remaining 9 land in follow-up commits (mechanical, non-blocking).

| Cartridge | Top file | activeTab state | Hook call (concise) |
|---|---|---|---|
| **KNYT** (`knyt-codex`) | `app/triad/components/codex/tabs/KnytTab.tsx` | `activeTab` | ✅ wired |
| **Qriptopian** | `QriptopiaTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'qriptopian', displayLabel: 'Qriptopian Cartridge' })` |
| **AgentiQ** | `AgentiqCartridgeTab.tsx` | `activePath` | `useCartridgePresence({ cartridgeId: 'agentiq', displayLabel: 'AgentiQ Cartridge', tab: activePath, onSetTab: setActivePath })` |
| **AgentiQ OS** | `AgentiQOSTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'agentiq-os', displayLabel: 'AgentiQ OS' })` |
| **Venture Lab α** | `KnytAlphaTab.tsx` | (stateless) | `useCartridgePresence({ cartridgeId: 'alpha-knyt', displayLabel: 'Venture Lab α' })` |
| **metaMe** | delegates to `AgentiqCartridgeTab` | (inherits `activePath`) | wrap with `cartridgeId: 'metame'`, `displayLabel: 'metaMe Cartridge'` |
| **Marketa** | `MarketaTab.tsx` | `activeParent` + `adminSub`/`partnerSub` | `tab: activeParent, subTab: activeParent === 'admin' ? adminSub : partnerSub, onSetTab: setActiveParent, onSetSubTab: activeParent === 'admin' ? setAdminSub : setPartnerSub` |
| **Aigent MoneyPenny** | `MoneyPennyCartridge.tsx` | `activeTab` | `useCartridgePresence({ cartridgeId: 'aigent-moneypenny', displayLabel: 'Aigent MoneyPenny', tab: activeTab, onSetTab: setActiveTab })` |
| **Aigent Nakamoto** | `NakamotoTab.tsx` | `activeTab` + nested `tabState` | `useCartridgePresence({ cartridgeId: 'aigent-nakamoto', displayLabel: 'Aigent Nakamoto', tab: activeTab, subTab: tabState?.sub, onSetTab: setActiveTab, onSetSubTab: (s) => setTabState({ ...tabState, sub: s }) })` |

## Layered mount harness (next commit)

When the wallet opens a cartridge as a layer (not via the codex shell URL), a small wrapper component supplies `onClose` so the shell × button has somewhere to land:

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

`CartridgeRenderer` maps `cartridgeId → top-level component` and forwards `mode='layer'` + `onClose` so `useCartridgePresence` picks them up. The wallet's task chips mount a `CartridgeLayer` when `tryOpenInMountedCartridge` returns false AND the user is inside the thin client (so a full URL navigation would unmount the wallet — which we don't want for a deep-link).

## Acceptance criteria

- [x] `services/cartridge/CartridgePresenceRegistry.ts` exists; publishes to `window.__metame.cartridges` via the canonical `CartridgePresenceMirror` shape.
- [x] `app/hooks/useCartridgePresence.ts` broadcasts canonical `METAME_EVENTS.CARTRIDGE_*` events; inbound listener gated via `isMetameOriginAllowed`.
- [x] KNYT (`KnytTab.tsx`) wired as the canonical example.
- [x] Wallet drawer's `navigateToKnytTab` consults `tryOpenInMountedCartridge` first; falls through to `buildCodexUrl` only when the target cartridge isn't mounted.
- [x] Parent contract's protocol registry table updated to point at this spec.
- [ ] All 9 remaining cartridges call the hook (follow-up commit; mechanical).
- [ ] `CartridgeLayer` wrapper exists for layered mounts with `onClose` wiring (follow-up commit).
- [ ] Lovable thin-client shell subscribes to `metame:cartridge-opened|closed|tab-changed` and renders the cartridge icon + × close button in the shell header. (Owned by the shell team — pass them this spec.)

## Coordination history

- **2026-05-11** — first draft of registry + hook in `claude/review-session-setup-V82mB` (commits `9d3b6800`, `9422075f`). Used bespoke `window.__metameCartridgeRegistry` key and `metame:cartridge-state-changed` event.
- **2026-05-12** — parent contract `metame-client-protocols.md` lands (`3f7eb36d`); the runtime-shell agent's draft is realigned to honour it: window mirror moves to `window.__metame.cartridges`, event renamed to `metame:cartridge-tab-changed`, inbound origin enforced via `isMetameOriginAllowed`, shape moved to canonical `CartridgePresenceMirror`.
