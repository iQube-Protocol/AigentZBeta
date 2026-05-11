# Lovable Thin-Client Integration Brief — metaMe Client Protocols (PersonaSpine + CartridgePresenceRegistry)

**Date filed:** 2026-05-12
**Audience:** Lovable thin-client team (the host shell that embeds the AigentZ / metaMe app)
**Scope:** What the thin-client shell needs to implement to honour the canonical `metame:*` postMessage contract that the embedded app now broadcasts.
**Status:** Ready to hand off — both protocols are live on `dev-beta.aigentz.me` from commit `51466301`.

---

## The contract (one page)

The embedded AigentZ app runs inside the thin-client's iframe. On mount and on state change, the app broadcasts events to `window.parent` using `postMessage`. The thin-client subscribes to these events to render its own chrome (persona avatar, cartridge icons, close buttons, breadcrumbs). The thin-client can also drive the app by posting **inbound** events back into the iframe.

Two protocols are live today; more are reserved (notifications, receipts, approvals, capsules — implementing later).

### Single subscribe + dispatch pattern

The thin-client should set up **one** listener on its own `window` for inbound events from the iframe, and a tiny helper to send outbound events back into the iframe. Everything below routes through that one pair.

```ts
// In the thin-client shell (parent frame)
const APP_FRAME: HTMLIFrameElement = /* your iframe ref */;
const APP_ORIGIN = 'https://dev-beta.aigentz.me';  // or prod when ready

window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== APP_ORIGIN) return;          // origin allowlist
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
  if (!msg.type.startsWith('metame:')) return;       // only our family
  handleMetameEvent(msg);
});

function sendToApp(payload: Record<string, unknown>) {
  APP_FRAME.contentWindow?.postMessage(payload, APP_ORIGIN);
}
```

Add `https://dev-beta.aigentz.me` (and your prod host) to the thin-client's CSP `frame-src` if you haven't already.

---

## Protocol 1 — PersonaSpine (`window.__metame.persona`)

The app's source of truth for "who is the active persona". The thin-client renders the persona avatar / display label / sign-in chrome from this signal.

### Events the app broadcasts (App → Shell)

| Event | When | Payload |
|---|---|---|
| `metame:persona-changed` | A persona switch occurred or the session refreshed | `{ type: 'metame:persona-changed', personaId?: string }` — **hint only**, do not treat as authoritative; re-fetch from the app's `/api/wallet/active-persona` endpoint |
| `metame:persona-revoked` | Sign-out, session expired, persona deleted | `{ type: 'metame:persona-revoked' }` — flip to unauthenticated UI immediately |

**Deprecated alias** still dispatched alongside `metame:persona-changed` for one release: `aa-persona-change-v1`. Treat as identical to the canonical name; will be removed shortly.

### What the thin-client should render

- **Persona avatar / dropdown in the header.** Read the active persona by calling the app's `/api/wallet/active-persona` endpoint (server-authoritative; returns the T1 surface: `displayLabel`, `personaSessionToken`, `identifiability`, `cartridgeFlags`, etc.). On every `metame:persona-changed` or `metame:persona-revoked`, re-fetch.
- **Sign-in CTA** when the API returns 401 (unauthenticated). On click, redirect or open a sign-in flow.

### What the thin-client must NOT do

- **Do NOT trust the event payload's `personaId` as authoritative.** The event is a re-fetch hint. Always re-fetch the canonical persona from the server.
- **Do NOT pass `personaId` through URL query params** on outbound navigation. `personaId` is T0 (server-internal). Use `personaSessionToken` if you need to pass identity through a URL — but typically you don't, because the session cookie travels with the iframe.
- **Do NOT inject your own persona-changed events into the iframe.** The app drives persona state; the shell mirrors it.

---

## Protocol 2 — CartridgePresenceRegistry (`window.__metame.cartridges`)

The app's source of truth for "which cartridge is currently open and what tab is it on". The thin-client renders cartridge icons + a close button in its header chrome based on this signal.

### Events the app broadcasts (App → Shell)

| Event | When | Payload |
|---|---|---|
| `metame:cartridge-opened` | A cartridge mounts (codex shell load, or wallet-launched layer) | `{ type: 'metame:cartridge-opened', cartridgeId, displayLabel, schemaVersion: 1 }` |
| `metame:cartridge-tab-changed` | The user (or wallet) switches the top-level tab inside an open cartridge | `{ type: 'metame:cartridge-tab-changed', cartridgeId, tab, subTab?, schemaVersion: 1 }` |
| `metame:cartridge-closed` | A cartridge unmounts (navigated away or shell closes it) | `{ type: 'metame:cartridge-closed', cartridgeId, schemaVersion: 1 }` |

`cartridgeId` values: `'knyt-codex'`, `'qripto-codex'`, `'agentiq-os-cartridge'`, `'agentiq-codex'`, `'alpha-knyt-codex'`, `'metame-codex'`, `'marketa-codex'`, `'aigent-moneypenny-codex'`, `'aigent-nakamoto-codex'`, plus any future ones — treat as an open string.

### Events the thin-client sends (Shell → App)

| Event | When | Payload |
|---|---|---|
| `metame:cartridge-closed` | User clicks the × button in the shell header for a cartridge tile | `{ type: 'metame:cartridge-closed', cartridgeId, schemaVersion: 1 }` |

The app's `useCartridgePresence` hook listens for this and invokes the cartridge's `onClose` (when mounted as a layer). Currently only layered (wallet-launched) cartridges respond — the codex shell URL ignores it (its close is a navigation, not a teardown).

### What the thin-client should render

- **A stack of cartridge icons + display labels in the header**, one per currently open cartridge. The most-recently-opened is the "active" one (visually highlighted).
- **A × close button next to each cartridge** that posts `metame:cartridge-closed` back into the iframe with that `cartridgeId`. The app reacts by tearing down a layered cartridge or by leaving codex-shell-hosted cartridges alone (the shell URL handles those).
- **Optional**: breadcrumb / sub-title showing `tab` (and `subTab` if present) from the latest `metame:cartridge-tab-changed` event.

### State the thin-client should keep

```ts
type CartridgeState = {
  cartridgeId: string;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  openedAt: number;
};

let openCartridges: CartridgeState[] = [];   // order = open order

function handleCartridgeEvent(msg) {
  switch (msg.type) {
    case 'metame:cartridge-opened':
      openCartridges = [
        ...openCartridges.filter(c => c.cartridgeId !== msg.cartridgeId),
        { cartridgeId: msg.cartridgeId, displayLabel: msg.displayLabel, openedAt: Date.now() },
      ];
      break;
    case 'metame:cartridge-tab-changed': {
      const i = openCartridges.findIndex(c => c.cartridgeId === msg.cartridgeId);
      if (i >= 0) openCartridges[i] = { ...openCartridges[i], tab: msg.tab, subTab: msg.subTab };
      break;
    }
    case 'metame:cartridge-closed':
      openCartridges = openCartridges.filter(c => c.cartridgeId !== msg.cartridgeId);
      break;
  }
  renderHeader();
}
```

The "active" cartridge is `openCartridges[openCartridges.length - 1]` (most recently opened or focused).

---

## Putting it together — one combined listener

```ts
const APP_ORIGIN = 'https://dev-beta.aigentz.me';

window.addEventListener('message', (event) => {
  if (event.origin !== APP_ORIGIN) return;
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

  switch (msg.type) {
    // PersonaSpine
    case 'metame:persona-changed':
    case 'aa-persona-change-v1':           // legacy alias — same effect
      refetchActivePersona();              // call /api/wallet/active-persona, then re-render header
      break;
    case 'metame:persona-revoked':
      setUnauthenticatedHeader();
      break;

    // CartridgePresenceRegistry
    case 'metame:cartridge-opened':
    case 'metame:cartridge-tab-changed':
    case 'metame:cartridge-closed':
      handleCartridgeEvent(msg);
      break;
  }
});

// Sending close intent into the app:
function closeCartridge(cartridgeId: string) {
  appFrame.contentWindow?.postMessage(
    { type: 'metame:cartridge-closed', cartridgeId, schemaVersion: 1 },
    APP_ORIGIN,
  );
}
```

---

## Origin enforcement

The app validates `event.origin` against `configs/embed/policy.v1.json::authAllowedOrigins` before honouring any inbound `metame:*` event. Your thin-client's origin **must** be on that allowlist or your `closeCartridge` calls will be silently dropped.

Currently allowlisted (confirm with the AigentZ team before going live in prod):

- `https://aigent-z.aigentz.me` (Lovable thin-client dev)
- `https://*.lovable.app` (Lovable preview)
- whatever your production host is — coordinate to add it

If your thin-client embeds the app on multiple hosts (dev / preview / prod), each one needs to be allowlisted explicitly OR via subdomain wildcard.

---

## Privacy boundary — non-negotiable

The events carry **only** surface identity (`cartridgeId`, `displayLabel`, `tab`, `subTab`) and **never** carry persona content. Specifically:

- ❌ `personaId` — never in any event payload
- ❌ `authProfileId` — never
- ❌ `rootDid` — never
- ❌ `kybeAttestation` — never
- ❌ Cross-persona `fioHandle` — never

If you ever see one of these in an inbound event, it's a bug — report it; don't render it.

Persona display data (avatar, label) comes from the server-authoritative `/api/wallet/active-persona` endpoint, fetched after every `metame:persona-changed`.

---

## Testing checklist

After implementing:

- [ ] Sign in to the embedded app — thin-client header renders the persona avatar / label.
- [ ] Switch persona inside the app — thin-client header updates within ~200ms (one fetch round-trip).
- [ ] Sign out — thin-client header flips to unauthenticated CTA.
- [ ] Open the KNYT codex — thin-client header shows KNYT icon + label.
- [ ] Switch tabs inside KNYT (Codex → Store → Living Canon) — header reflects the current tab (if you render breadcrumbs).
- [ ] Wallet → Living Canon "Vote on open elections" — header shows KNYT + tab="living-canon", and the 21 Sats tab opens on the **canon** sub-branch inside the app.
- [ ] Wallet → Living Canon "Submit community contribution" — same, but lands on **community** sub-branch with submission shell open.
- [ ] Wallet → Living Canon "File Correspondent dispatch" — lands on **correspondent** sub-branch.
- [ ] Wallet → Bring-a-Knight / Herald "Share Invite" — opens the SocialSharingModal full-screen (this is the app's own modal, not the shell's — the shell just sees a `cartridge-tab-changed` if any tab changes).
- [ ] Click × on a cartridge in the shell header → if cartridge was launched as a layer, it tears down; otherwise no-op (codex-shell URLs handle their own close).

---

## References

- Parent contract: `docs/architecture/metame-client-protocols.md`
- PersonaSpine spec: `docs/architecture/persona-spine-client-protocol.md`
- CartridgePresenceRegistry spec: `docs/architecture/cartridge-presence-registry.md`
- Origin allowlist source of truth: `configs/embed/policy.v1.json::authAllowedOrigins`
- Reserved event-name roster: parent contract §"Reserved event-name roster"

Questions / requests for additional allowlisted origins → reply on this thread.
