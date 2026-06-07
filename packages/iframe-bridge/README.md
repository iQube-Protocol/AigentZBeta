# @metame/iframe-bridge

Typed message protocol for shell ↔ runtime postMessage communication between a metaMe thin client (e.g. Lovable, the legacy `theqriptopian-web` shell, any future implementer) and the parent runtime (this `aigentzbeta` Next.js app rendered inside the iframe).

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│   Shell (thin client)    │         │   Runtime (parent app)   │
│                          │         │                          │
│   Lovable / etc.         │ ──▶     │   AigentZBeta            │
│   ShellOutboundMessage   │  port   │   MetaMeRuntimeClient    │
│                          │ ◀──     │                          │
│   RuntimeInboundMessage  │         │                          │
└──────────────────────────┘         └──────────────────────────┘
```

The shell renders the runtime inside an iframe and exchanges typed messages over `postMessage`. The two directions are:

- **Outbound from shell → inbound at runtime**: `ShellOutboundMessage` (`SHELL_READY`, `HANDOFF`, `MENU_ACTION`, `SELECTOR_CHANGE`, `CONTEXT_UPDATE`, `PROMPT_SUBMIT`, `RESET_WELCOME`, `DEVICE_CONTEXT_UPDATE`, `LAUNCH_CARTRIDGE`, `RUNTIME_CONTEXT_CHANGE`, `CARTRIDGE_OVERLAY_CLOSE`, plus the browser-contract `BrowserShellToRuntimeType` union).
- **Outbound from runtime → inbound at shell**: `RuntimeInboundMessage` (`RUNTIME_READY`, `NAVIGATE`, `REQUEST_TRUST_REFRESH`, `TOAST`, `OPEN_CAPSULE`, `WELCOME_COMPLETE`, `STATE_SYNC`, `TRUST_UPDATE`, `INFERENCE_START`, `PROCESSING_START`, `INFERENCE_COMPLETE`, `RENDER_COMPLETE`, `LEAD_AGENT_CHANGED`, `CARTRIDGE_OVERLAY_ACTIVE`, `RUNTIME_LEAD_CHANGE`, plus `BrowserRuntimeToShellType`).

Both directions share the canonical envelope:

```ts
{
  type: string;        // one of the unions above
  msg_id: string;      // crypto.randomUUID()
  timestamp: string;   // ISO-8601
  source: "shell" | "runtime";
  tenant_id?: string;
  persona_id?: string;
  payload: Record<string, unknown>;
}
```

Use `createShellMessage(type, payload, context)` / `createRuntimeMessage(...)` to construct; use `isShellOutboundMessage(value)` / `isRuntimeInboundMessage(value)` to validate at the receiving boundary before routing.

---

## `MENU_ACTION` payload + `deep_link` envelope

`MENU_ACTION` is the canonical mechanism for the shell to ask the runtime to open a drawer / picker / overlay. As of 2026-05-31 the payload supports an optional `deep_link` envelope so the runtime can route to a specific sub-tab or sub-flow without the shell needing a separate dispatch.

```ts
{
  type: "MENU_ACTION",
  payload: {
    action_id: string;       // routes to runtime's DRAWER_ACTION_HANDLERS
    item_id?: string;        // legacy alias, kept for backward compat
    deep_link?: {
      module: "wallet" | "persona";
      tab?:   "wallet" | "tasks" | "reputation" | "rewards" | "library" | "payments";
      intent?: "signin" | "signup";              // wallet only
      flow?:  "create-wizard" | "quick-add";     // persona only
    }
  }
}
```

- `action_id` is the existing handler key (e.g. `"wallet"`, `"persona"`, `"settings"`, `"connections"`, `"memory"`, `"identity"`, `"make-build"`, `"share"`, `"invite"`, etc. — see `MetaMeRuntimeClient.tsx::DRAWER_ACTION_HANDLERS`).
- `deep_link` is **optional**. Legacy dispatches without it open the target drawer at its default tab — no regression.
- `tab` values must come from the canonical `SmartWalletDrawerTab` union in `app/wallet/contracts.ts`. Unknown values silently fall back to `"wallet"`.
- `intent` only applies when `module === "wallet"` and the persona is unauthenticated. Seeds the drawer's `initialAuthMode` prop to pre-select Sign In vs Sign Up.
- `flow` only applies when `module === "persona"`. Routes the runtime to open the wallet drawer with `initialPersonaFlow` set; the drawer auto-launches `PersonaSetupWizard` (`create-wizard`) or `PersonaQuickAddModal` (`quick-add`) on mount.
- Drawer state for `intent` and `flow` is one-shot — cleared on drawer close so a subsequent plain "Wallet" dispatch (no envelope) doesn't reuse a stale Sign Up or wizard trigger.

### Per-item dispatch table (shell side)

| Menu item | `action_id` | `deep_link` |
|---|---|---|
| Sign In | `"wallet"` | `{ module: "wallet", tab: "wallet", intent: "signin" }` |
| Rewards | `"wallet"` | `{ module: "wallet", tab: "rewards" }` |
| Tasks | `"wallet"` | `{ module: "wallet", tab: "tasks" }` |
| Payments | `"wallet"` | `{ module: "wallet", tab: "payments" }` |
| Reputation | `"wallet"` | `{ module: "wallet", tab: "reputation" }` |
| + Create persona | `"persona"` | `{ module: "persona", flow: "create-wizard" }` |

### Runtime-side handler (for reference)

`MetaMeRuntimeClient.tsx::DRAWER_ACTION_HANDLERS` reads `payload.deep_link` and:

- For `module === "wallet"`: validates `tab` against `ALLOWED_WALLET_TABS`, seeds `walletInitialTab` + `walletInitialAuthMode`, opens the drawer.
- For `module === "persona"` with `flow`: opens the wallet drawer with `walletInitialPersonaFlow` set; `SmartWalletDrawer` auto-launches the matching modal in its `open`-watching `useEffect`.
- For `module === "persona"` without `flow`: opens the legacy persona picker bottom-sheet.

---

## Spine guardrails

The bridge envelope's `persona_id` field is **T1-safe only** in transit — it carries the public persona session identifier the shell received from the runtime's persona spine handshake, never the underlying T0 `personaId` UUID. See `CLAUDE.md` §"Identity & Access Spine" for the full T0/T1/T2 contract. If you're adding a new outbound message type, the spine rules apply: no T0 fields in the payload, no DVN-receipt-eligible verbs without a parent-side gate.

---

## Files

| Path | Role |
|---|---|
| `src/index.ts` | Type definitions + envelope helpers (`createShellMessage`, `createRuntimeMessage`, type guards) |
| `app/wallet/contracts.ts` (consumer) | Canonical `SmartWalletDrawerTab` union |
| `components/metame/MetaMeRuntimeClient.tsx` (consumer) | `DRAWER_ACTION_HANDLERS` + `deep_link` envelope reader |
| `app/components/content/SmartWalletDrawer.tsx` (consumer) | `initialTab` / `initialAuthMode` / `initialPersonaFlow` props |
| `codexes/packs/agentiq/updates/2026-05-31_thin-client-wallet-persona-deep-link-spec.md` | Full PR brief with verification table |

## Versioning

This package is unversioned (workspace-local). Breaking changes to `ShellOutboundType` or `RuntimeInboundType` MUST coordinate with every consuming shell (Lovable, theqriptopian-web, etc.). Additive changes — new message types, new optional payload fields — are safe.
