# Companion header persona/agent badge + model-provider control, wallet top-chrome simplification

**2026-07-29 — operator-directed.**

## Summary

Three additive changes to the metaMe Companion (`app/(embed)/triad/embed/companion/page.tsx`,
`app/components/codex/CodexCopilotLayer.tsx`, `app/components/content/SmartWalletDrawer.tsx`):

1. **Header persona/agent badge.** The Companion's header — where the delegated agent's name
   already renders beside the R/T dots — is now a clickable badge (same interaction pattern as
   the estate's cartridge badges). Clicking it opens a compact persona chooser
   (`components/companion/CompanionPersonaBadgeModal.tsx`) listing the citizen's human and agent
   personas, using the SAME amber-Bot / cyan-User + amber-Star-"aigentMe" convention
   `SmartWalletDrawer`'s own persona menu already uses. The collapsed badge shows a green human
   icon or green robot icon (replacing the old plain green dot) depending on whether the active
   persona is human or the aigentMe delegate.
2. **Model-provider control.** A 4th icon in the copilot's mode-toggle row (beside pause/mic/
   avatar/chat) opens a two-level Anthropic/OpenAI/Venice provider → model dropdown
   (`components/companion/CompanionModelPicker.tsx`), sourced from the SAME
   `services/metame/agentLlmOrchestra.ts` registry and `/api/metame/agent-llm-options` route
   `components/metame/MetaMeRuntimeClient.tsx`'s own agent/model selector already uses. The
   selection is genuinely wired: it rides every `/api/codex/chat` call this copilot makes as
   `provider_id`/`llm_id` — the exact fields `route.ts` already resolves against the agent's
   configured ModelQube providers.
3. **Wallet top-chrome simplification (Companion-embedded wallet only).** `SmartWalletDrawer`
   gains an opt-in `simplifiedTopChrome` prop (default `false`, set ONLY at the Companion's own
   embedded wallet mount) that hides the entire old top row — the persona/sign-in trigger, the
   Copilot toggle, and the Close Wallet button — and moves the Copilot toggle into the tab icon
   row, which becomes horizontally scrollable to make room.

## Why this is scoped the way it is

The operator explicitly ring-fenced this pass to the Companion's own embedded wallet variant — a
concurrent session was simultaneously changing `SmartWalletDrawer.tsx`'s global balance/currency
rendering (Base Q¢ mainnet + BitCent stub, landed in the same working tree during this session).
`simplifiedTopChrome` is a single opt-in boolean, defaulted `false`, set at exactly one call site
(`app/(embed)/triad/embed/companion/page.tsx`'s `activeSurface === "wallet"` branch) — every other
embedded/overlay mount (marketa-codex, knyt-codex, metame-codex, the Polity Passport Bureau
cartridge, `CodexCopilotLayer`'s own internal `walletDrawerNode`) renders its top chrome exactly as
before. The prop touches only header/tab-row layout, never the balance rows the other session was
editing.

## Companion Menu System invariants relied on

- **MS-1 (one navigation)** — the header badge and model picker are new AFFORDANCES inside the
  copilot's own header/menu row, not a second navigation surface; they don't duplicate anything
  the copilot's menu already owns.
- **MS-2 (one owner per surface)** — the badge's compact modal is a NEW top-level overlay (fixed
  `inset-0`), not parallel state layered onto a surface `bodySlot` already owns.
- **MS-3 (one state, two views)** — persona switching goes through `PersonaContext.setActivePersonaId`
  (the one canonical mechanism), and `useCodexEmbedAuthBridge`'s `personaId` already listens for
  the `storage` event that dispatch fires, so every panel on the page (all of which read the same
  `personaId`) agrees — no second, parallel persona-tracking state was introduced.
- **MS-9 (a control that cannot act must not render)** — the header badge is always clickable
  (opening the chooser needs no persona resolved yet); the model-picker trigger always opens,
  falling back to the static provider map when the live fetch hasn't resolved, so it's never a
  dead affordance.
- **MS-7 (an inert mechanism is a defect)** — `modelSelection` is not cosmetic: it is threaded all
  the way into the `/api/codex/chat` POST body as `provider_id`/`llm_id`.

## Genuinely wired, not cosmetic

- Selecting a persona/agent in the header badge calls `usePersonaSafe().setActivePersonaId`,
  which is what drives `personaId` on every panel this page renders (including the
  `/api/codex/chat` `personaId` field).
- Selecting a provider/model in the model picker sets `modelSelection`, forwarded to
  `CodexCopilotLayer`'s new `modelSelection` prop, which adds `provider_id`/`llm_id` to every
  `/api/codex/chat` call — the same fields `app/api/codex/chat/route.ts` already resolves against
  `services/metame/agentLlmOrchestra.ts`'s per-agent ModelQube registry. No server route changed.

## Scope note (explicitly out of scope this pass)

A model change here affects the Companion copilot (`aigentId: "aigent-me"`) and whatever agents
are activated through it. It does NOT change MoneyPenny's model or her being active in the Wallet
(her native surface) — that remains a separate future decision, per the operator.

## Files touched

- `app/components/codex/CodexCopilotLayer.tsx` — header badge render, mode-row `modelPickerSlot`,
  `modelSelection` → `/api/codex/chat` body wiring. All new props optional, unset everywhere else.
- `app/components/content/SmartWalletDrawer.tsx` — `simplifiedTopChrome` prop (header hide + tab
  row Copilot icon + scrollable row). Balance/currency logic untouched.
- `app/(embed)/triad/embed/companion/page.tsx` — wires the badge, modal, and model picker into the
  Companion shell.
- `components/companion/CompanionPersonaBadgeModal.tsx` (new) — compact persona chooser, reusing
  `useSupabaseSessionPersonas` + `PersonaEditModal`.
- `components/companion/CompanionModelPicker.tsx` (new) — provider → model dropdown, reusing
  `services/metame/agentLlmOrchestra` + `/api/metame/agent-llm-options` + the `/llm_model_logos/*`
  icon set already used elsewhere in the estate.

## Verification

- `npx vitest run tests/companion-1-1-navigation.test.ts tests/companion-1-1-quicklinks.test.ts
  tests/moneypenny-runtime-authority-boundary.test.ts tests/persona-spine-fetch.test.ts
  tests/passport-connection-challenge.test.ts` — 164 tests passed.
- `tsc --noEmit` — the repo's baseline `tsconfig.json` currently fails to even construct a program
  (`ignoreDeprecations` value mismatch + an ambient `types/iqube` typeRoots error), reproduced on
  an unmodified tree via `git stash`; pre-existing and unrelated to this change. A scoped check
  (temporary config fixing only those two global issues) found no new errors in any file this pass
  touched.
- No browser/dev-server render check was performed (sandboxed environment; no reachable dev server
  for this embed route in this session).
