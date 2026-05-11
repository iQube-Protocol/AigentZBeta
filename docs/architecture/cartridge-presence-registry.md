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

## Wiring strategy — codex shell, not per-cartridge

The hook is wired **once at the codex shell** (`app/triad/components/CodexPanelDynamic.tsx`), not in each cartridge's top-level `*Tab.tsx`. One call covers all 10 cartridges, and — critically — it exposes the setter that switches the **user-visible top-level codex tab** (Codex / Store / Terra / Order / Living Canon / 21 Sats / …) rather than a cartridge-internal sub-state.

```ts
// app/triad/components/CodexPanelDynamic.tsx
useCartridgePresence({
  cartridgeId: codexId,                                                            // e.g. 'knyt-codex'
  displayLabel: codex?.name?.replace(/\s+codex$/i, '').trim() || codex?.name || codexId,
  tab: activeTabSlug,
  onSetTab: setActiveTabSlug,
});
```

**Why not per-cartridge.** The first iteration wired the hook in `KnytTab.tsx` against its `activeTab` state — that was a sub-view state inside the legacy KNYT panel, not the codex shell's tab navigation. Wallet calls to switch to e.g. `'living-canon'` therefore changed the wrong layer's state and silently no-op'd. The shell-level wiring fixes this for all cartridges in one stroke.

**Sub-tabs are routed by the destination tab itself.** For surfaces with their own internal sub-navigation (e.g. KNYT's Living Canon → canon / community / correspondent), the wallet parks `taskSlug` on `window.__knytPendingTaskSlug` and the destination tab's mount-time effect maps the slug to the right sub-tab. See `KnytLivingCanonTemplate.tsx`'s mount-time consumer for the canonical pattern.

This means **stateless cartridges and complex multi-tier ones (e.g. Marketa) are all already covered** — no per-cartridge edit needed.

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
- [x] Codex shell (`CodexPanelDynamic.tsx`) wired with the hook — covers all 10 cartridges in one place via `codexId` + `setActiveTabSlug`.
- [x] Wallet drawer's `navigateToKnytTab` consults `tryOpenInMountedCartridge` first; falls through to `buildCodexUrl` only when the target cartridge isn't mounted.
- [x] Parent contract's protocol registry table updated to point at this spec.
- [x] All 10 cartridges covered (shell-level wiring — see "Wiring strategy" above).
- [ ] `CartridgeLayer` wrapper exists for layered mounts with `onClose` wiring (follow-up commit).
- [ ] Lovable thin-client shell subscribes to `metame:cartridge-opened|closed|tab-changed` and renders the cartridge icon + × close button in the shell header. (Owned by the shell team — pass them this spec.)

## Coordination history

- **2026-05-11** — first draft of registry + hook in `claude/review-session-setup-V82mB` (commits `9d3b6800`, `9422075f`). Used bespoke `window.__metameCartridgeRegistry` key and `metame:cartridge-state-changed` event.
- **2026-05-12** — parent contract `metame-client-protocols.md` lands (`3f7eb36d`); the runtime-shell agent's draft is realigned to honour it: window mirror moves to `window.__metame.cartridges`, event renamed to `metame:cartridge-tab-changed`, inbound origin enforced via `isMetameOriginAllowed`, shape moved to canonical `CartridgePresenceMirror`.
