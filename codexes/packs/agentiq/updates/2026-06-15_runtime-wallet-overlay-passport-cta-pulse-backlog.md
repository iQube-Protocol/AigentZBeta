# 2026-06-15 — Runtime wallet-overlay gem, passport CTA, metaMe Pulse spec + backlog

Session branch: `claude/sharp-einstein-wjzgqx`

## Shipped this session

### 1. Active-persona header badge → standalone SmartWallet overlay
`app/triad/components/CodexPanelDynamic.tsx` — the `Welcome, {persona}` badge in
the cartridge header is now a button that opens `<SmartWalletDrawer variant="overlay" initialTab="wallet">`
on top of the cartridge. This is the **direct-overlay gem** (mirrors
`DevPersonaTab`'s "Open SmartWallet → iQube tab"), NOT the copilot-embedded
wallet. Landing on the wallet tab exposes the persona switcher so users can
change the active persona from any cartridge. Persona switches propagate to
global context via `handlePersonaChange`.

### 3. "Get your Polity Passport" CTA on the metaMe runtime welcome
`components/metame/MetaMeRuntimeClient.tsx` — added a CTA next to "Set up my
ExperienceModel" in the metaMe takeover welcome. Uses the in-runtime deep-link
`setActiveCartridgeOverlay({ slug: 'polity-passport-bureau', title: 'Polity Passport', initialTab: 'apply' })`
so the operator lands directly on the passport Apply tab — no manual default-tab
config needed.

## Locked spec — item 4: metaMe Pulse (runtime content approval)

Operator decisions (2026-06-15):
- **Data model + gate:** Mirror the KNYT/Qripto pulse. Reuse
  `community_generated_content` with a new `cartridge='metame-runtime'` lane;
  clone `KnytCommunityContentAdminTab` → `MetaMePulseAdminTab`. Same
  `draft → shared → runtime_promoted` promote/reject flow. Studio→runtime
  launches land as `shared`; the runtime surfaces them only once
  `runtime_promoted`.
- **Menu placement:** Explicit dropdowns in the approval card — admin picks the
  main menu (be/make/play/earn/share) + sub-menu; persisted as the tags the
  runtime's `scoreContent` / `SOURCE_PRIORITY_BY_INTENT` already read.
- **Scope:** All five menu items (be/make/play/earn/share) + sub-menus in the
  first ship.

Build steps:
1. Migration: add `'metame-runtime'` to the `cartridge` CHECK constraint on
   `community_generated_content` (drop + re-add the constraint). Add columns for
   `runtime_menu` + `runtime_submenu` (or store as tags).
2. Clone `KnytCommunityContentAdminTab` → `MetaMePulseAdminTab` with
   `cartridge='metame-runtime'`, plus the menu/submenu dropdowns on each card.
3. Register `MetaMePulseAdminTab` in `data/codex-configs.ts` under the metaMe
   `admin` group (component string + `props.cartridge='metame-runtime'`).
4. Gate the studio→runtime publish so runtime-targeted artifacts land as
   `shared` (pending), not surfaced until promoted.
5. Wire the runtime to fetch `/api/community-content/list?cartridge=metame-runtime&status=runtime_promoted`
   and map each item's menu/submenu tags into the be/make/play/earn/share menus
   via the existing `scoreContent` pipeline.

The list/promote/reject API routes already accept `cartridge` as a param — no
route changes needed beyond the CHECK constraint.

### 2. Runtime takeover context — admin control (SHIPPED)
The ⚡ lightning-bolt in the runtime Play menu flips `runtimeContext` between
KNYT (amber) and metaMe (emerald). That state is now also surfaced as an admin
control without rebuilding the takeover logic:

- `utils/runtimeContextPreference.ts` — single source of truth for the persisted
  default context (`metame:runtime-default-context` localStorage key, launch
  default `'knyt'`). Read + written by both the runtime and the admin tab.
- `components/metame/MetaMeRuntimeClient.tsx` — `runtimeContext` now initialises
  from `getRuntimeContextPreference()` (was hardcoded `'knyt'`), and a `storage`
  listener live-syncs the running surface (incl. embedded iframe) when the
  default changes elsewhere. The in-runtime ⚡ Play-menu toggle is unchanged
  (still an ephemeral per-session flip).
- `app/triad/components/codex/tabs/MetaMeRuntimeSettingsTab.tsx` — new admin tab
  with a metaMe/KNYT toggle that writes the shared preference and broadcasts a
  `storage` event so a live runtime updates immediately. Registered in
  `TabRenderer` + the metaMe codex `admin` group (`slug: runtime-settings`).

Scope note: the preference is per-browser (mirrors the ephemeral ⚡ toggle's
client-side nature). A server-persisted global default would be a separate
follow-up — out of scope for "wire to the existing mechanism, do not rebuild".

## Backlog — fast follows

### Apply the wallet-overlay gem to runtime main-menu items
The standalone `SmartWalletDrawer variant="overlay"` (now proven on the
cartridge header badge) should replace the copilot-embedded wallet path for
runtime main-menu actions:

- **Earn button / wallet action:** today the copilot's `resolveWalletPromptTab`
  maps "earn/reward/wallet" prompts to `setWalletPanelOpen(true)` (copilot
  embedded wallet). Repoint to the standalone overlay so the full SmartWallet
  renders directly on top of the cartridge without going through the copilot.
- **Be button + its sub-menu items:** mount the standalone wallet overlay
  (Persona / Identity / Settings / Memory / Connections land on the relevant
  wallet tab) instead of routing through the copilot.
- **Share:** also a candidate for the overlay pattern, but needs more thought
  and design work first (sharing surface differs from a wallet tab).

Rationale: the direct overlay (`variant="overlay"`) avoids the copilot z-index
limitation and gives a cleaner, faster path to the full wallet from any runtime
surface.
