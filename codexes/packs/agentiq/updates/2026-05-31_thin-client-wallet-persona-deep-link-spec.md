# Thin-client → parent deep-link spec for wallet + persona actions

**Date:** 2026-05-31
**Audience:** Lovable thin-client team (and any future shell implementation)
**Status:** Spec live; parent-side handler wired for wallet tabs in commit `<latest>`. Persona create-wizard auto-launch is fast-follow.

## Goal

The thin client wants a sixth Earn action ("Sign In") and a "+" trailing pill in the persona selector, plus deep-link routing for the five existing wallet/Earn actions (`goal`, `task`, `wallet`, `reward`, `payments`, `signin`). All six dispatches MUST flow through the existing `MENU_ACTION` message type — no new message type, no dual dispatch.

**Operator update 2026-05-31:** the "Offer" slot in the original Lovable plan is renamed to "Payments" and deep-links to the wallet drawer's existing `payments` tab. The Earn action ID, label, and icon should change accordingly (`offer` → `payments`).

## MENU_ACTION envelope

```ts
{
  type: "MENU_ACTION",
  payload: {
    action_id: "wallet" | "persona",            // existing runtime handlers
    deep_link?: {
      module: "wallet" | "persona";
      tab?:   "wallet" | "tasks" | "reputation" | "rewards" | "library" | "payments";
      intent?: "signin" | "signup";              // wallet only
      flow?:  "create-wizard" | "quick-add";     // persona only
    }
  }
}
```

- `action_id` continues to route to the existing runtime handler (`DRAWER_ACTION_HANDLERS` in `MetaMeRuntimeClient.tsx`).
- `deep_link` is **optional** — dispatches without it keep working unchanged. Legacy menu items that just open the wallet drawer at the default tab don't need to add it.
- Unknown `tab` values fall back to `"wallet"` silently. Unknown `intent` / `flow` values are no-ops.

## Per-item wiring (shell side)

| Menu item | `action_id` | `deep_link` |
|---|---|---|
| **Sign In** | `"wallet"` | `{ module: "wallet", tab: "wallet", intent: "signin" }` |
| **Rewards** | `"wallet"` | `{ module: "wallet", tab: "rewards" }` |
| **Tasks** | `"wallet"` | `{ module: "wallet", tab: "tasks" }` |
| **Payments** (replaces Offer; operator update 2026-05-31) | `"wallet"` | `{ module: "wallet", tab: "payments" }` |
| **Reputation** | `"wallet"` | `{ module: "wallet", tab: "reputation" }` |
| **+ Create persona** | `"persona"` | `{ module: "persona", flow: "create-wizard" }` |

Tab values come from the canonical `SmartWalletDrawerTab` union in `app/wallet/contracts.ts`: `"wallet" | "library" | "tasks" | "reputation" | "rewards" | "payments"`. Anything outside this union is rejected at the parent.

## Shell-side config that needs to change

Per Lovable's plan:

1. `EARN_ACTIONS` in `src/lib/smart-menu-config.ts` — append `{ id: "signin", label: "Sign In", icon: "log-in", kind: "system-only", triggersInference: false }`.
2. `DRAWER_ONLY_ACTION_IDS` — add `"signin"` AND `"persona-create"` (the persona "+" pill should also be drawer-only — no inference).
3. `mobileVisibleFold` for Earn — `["goal", "task", "wallet", "reward", "payments", "signin"]`.
4. Default icon map (`src/lib/icon-utils.ts`, `src/lib/smart-menu-icons.ts`) — `signin: LogIn`; for the persona "+" use `UserPlus` (or `Plus`).
5. `SmartMenuSubmenu.tsx` — when `submenuType === "personaSelector"`, render a trailing "+" pill after the persona pills. Click dispatches `MENU_ACTION { action_id: "persona", deep_link: { module: "persona", flow: "create-wizard" } }`.
6. Quick-action handler — wire the six MENU_ACTION dispatches per the table above. No dual dispatch — these are pure open-drawer actions, no prompt is sent.

## Parent-side state (already shipped)

The runtime reads `payload.deep_link` in `MetaMeRuntimeClient.tsx` at the `MENU_ACTION` handler (around line 4998) and:

- For `wallet` module: sets `walletInitialTab` to the resolved tab (or `"wallet"` fallback) and opens the drawer.
- For `persona` module: opens the persona picker (the current bottom-sheet).
- For unknown deep links: legacy behaviour (open at default tab).

The `walletInitialTab` state union was widened to include `"reputation"` and `"library"`.

## Sign-in behaviour

When the wallet drawer opens at tab `"wallet"` and the persona is **not authenticated**, `SmartWalletDrawer` automatically displays the Sign In / Sign Up tabs above the email + password form (see screenshot supplied 2026-05-31). The `intent` field on the deep link is captured for future use (forcing the Sign Up tab when the operator clicks "Sign Up" directly) but is currently a no-op — the default UI is fine.

If the persona is already authenticated, opening the drawer at `"wallet"` shows the persona view — there's no sign-in form to deep-link into, so the behaviour degrades gracefully.

## Persona create-wizard — fast-follow

For now the persona deep link opens the existing persona picker (KNYT / Qripto bottom-sheet). Auto-launching the full `PersonaSetupWizard` ("Choose Your Persona Type" → Qripto / KNYT → multi-step) requires extending `SmartWalletDrawer` with a new prop:

```ts
initialPersonaFlow?: "create-wizard" | "quick-add";
```

When set, the drawer opens the matching modal on mount. The flow then runs inside the drawer and on completion calls `onCreatePersona`. This is tracked as fast-follow #4 in the backlog list below — ping when the shell-side wiring is ready and we'll ship it.

## Backlog (parent-side fast-follow)

1. ~~MENU_ACTION deep_link envelope reader~~ — done.
2. ~~Wallet drawer `initialTab` routing for `tasks`, `rewards`, `reputation`, `library`~~ — done.
3. Wallet drawer `authIntent` prop to force Sign Up tab when `intent: "signup"` is passed.
4. `SmartWalletDrawer.initialPersonaFlow` prop + auto-launch of `PersonaSetupWizard` / `PersonaQuickAddModal`.
5. Documentation update in `packages/iframe-bridge/README.md` to add the deep_link contract to the inbound message spec.

## Files

| Path | Role |
|---|---|
| `app/wallet/contracts.ts` | Canonical `SmartWalletDrawerTab` union |
| `app/wallet/events.ts` | `openSmartWalletDrawer` event dispatcher |
| `app/components/content/SmartWalletDrawer.tsx` | The drawer component (props: `initialTab`, `onCreatePersona`) |
| `components/metame/MetaMeRuntimeClient.tsx` | `MENU_ACTION` handler + drawer state owner |
| `packages/iframe-bridge/src/index.ts` | Inbound message type definitions |
