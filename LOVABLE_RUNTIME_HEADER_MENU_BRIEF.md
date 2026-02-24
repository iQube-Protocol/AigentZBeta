# Lovable Brief: metaMe Runtime Header + Menu Parity

## Objective
Implement the thin-client shell so header and menu behavior mirrors the current AigentiQ metaMe Runtime, while iframe rendering remains the source for runtime inference/content between header and menu.

## Source of Truth
- `components/metame/MetaMeRuntimeClient.tsx`
- `services/content/smartMenuIntegration.ts`
- `services/metame/surfacePlanningService.ts`
- `services/aa-api/src/routes/runtime.ts` (`/aa/v1/runtime/*`)

## Header Behavior

### 1) Trust + Reliability indicators
- Show trust/reliability indicators in header.
- Indicator style is dot-based (5 dots), state-driven:
  - `ok` -> green/purple high confidence
  - `warn` -> yellow
  - `fail` -> red
- AA payload provides:
  - `session.trust_level`
  - `session.trust_signals[]`
  - `session.scores.trust` and `session.scores.reliability` (optional numeric display)

### 2) Aigent selector
- Must be payload-driven from `selectors.aigent`.
- Display icon + tooltip from payload when present:
  - Example icons: `bot`, `brain`, `coins`, `hexagon`, `megaphone`
- Support the runtime auto-hide interaction pattern for selector popovers (desktop/tablet hover close delay).

### 3) LLM selector
- Must be payload-driven from `selectors.llm`.
- Display provider icon + tooltip from payload when present:
  - Examples: `openai`, `anthropic`, `venice`, `chaingpt`, `thirdweb`
- Current runtime model selection is per active Aigent; changing Aigent changes available LLM options.

## Menu System Behavior

### 1) Primary menu
- Primary items (IDs): `be`, `earn`, `play`, `make`, `share`
- Edge items: `be`, `share`
- Core triad: `earn`, `play`, `make`
- Labels/icons/tooltips/colors must come from payload (`menu.items[]`) and not be hardcoded.

### 2) Layout and grouping
- Mobile:
  - 5 actions in one row (Be, Earn, Play, Make, Share).
- Tablet/Desktop:
  - `Be` on left
  - Tight center cluster for `Earn/Play/Make`
  - `Share` on right
- Respect payload policy:
  - `menu.policy.close_group_desktop_tablet`
  - `menu.policy.center_group_ids`
  - `menu.policy.triad_cluster_gap`

### 3) Collapsing behavior
- If `menu.mode === "collapsed"` or collapse policy is active:
  - Left: `Be`
  - Center: single `metaMe` button (opens triad actions)
  - Right: `Share`
- Keep collapse behavior payload-controlled:
  - `menu.mode`
  - `menu.policy.collapse_to_metame_button`
  - `menu.policy.edge_items_when_needed`

## Quick Links + Prompt UX

### 1) Quick links (welcome)
- Source: `menu.policy.quick_links`
- Expected default set:
  - Watch, Listen, Read, Find
- These should appear as compact icon-first actions above/beside the menu in welcome state.

### 2) Floating quick links (post-welcome/system actions)
- Source: `menu.policy.floating_quick_links`
- Expected defaults:
  - Refresh runtime (`__runtime_refresh__`)
  - Reset runtime (`__runtime_reset__`)
  - Toggle native preview (`__runtime_toggle_fullscreen__`)

### 3) Prompt box
- Source: `menu.policy.prompt_box`
- Placeholder should be payload-driven (default: `What do you want to do today?`).

## Welcome vs Post-Welcome State

### Welcome state
- Centered large prompt box.
- Trust/reliability visible in header.
- Quick links available.
- Footer menu visible.

### Post-welcome state
- Runtime surface active with floating input pattern.
- Menu stays visible as action rail.
- Quick links may collapse/hide based on policy.

### State policy source
- `menu.policy.state_behavior.welcome`
- `menu.policy.state_behavior.post_welcome`

## Menu Action Triggers (must mirror runtime intent wiring)

When a menu item is clicked:
1. Call `POST /aa/v1/runtime/menu-action` with `action_id`.
2. Rehydrate state from returned `shell_config`.
3. Forward menu intent to iframe via postMessage (`MENU_ACTION`) using payload returned in `menu_event`.

Current trigger mapping:
- `be`:
  - Prompt: `I want to be...`
  - Intent: `be`
- `earn`:
  - Prompt: `How can I earn...`
  - Intent: `earn`
- `play`:
  - Prompt: `I'd like to play experiences.`
  - Intent: `play`
- `make`:
  - Prompt: `I want to make...`
  - Intent: `make`
- `share`:
  - Prompt: `Help me find experiences to share.`
  - Intent: `find` (mirrors current runtime behavior)

Also forward selector changes:
- On Aigent/LLM changes:
  - `POST /aa/v1/runtime/selectors`
  - postMessage `SELECTOR_CHANGE`

## Surface Planner + metaMe Copilot Alignment
- Use `menu_event.surface_plan_instruction` and `menu_event.copilot_instruction` from AA response as the canonical hint payload for downstream rendering/orchestration.
- Do not hardcode planner/copilot strings in UI.

## iframe Requirements
- iframe must use API-provided:
  - `iframe.url`
  - `iframe.postMessageOrigin`
  - `iframe.bootstrap.handoff_token`
  - `iframe.bootstrap.context`
- Shell owns chrome (header/menu), iframe owns runtime internals.

## Confirmed API Endpoint
- `GET /aa/v1/runtime/shell-config` is implemented in AA API.
- Companion endpoints implemented:
  - `POST /aa/v1/runtime/selectors`
  - `POST /aa/v1/runtime/menu-action`

## Current iframe URL in API
- Current default returned by AA API when env is not set:
  - `http://localhost:3000/metame/runtime?embed=1`
- Current default origin:
  - `http://localhost:3000`
- For non-local environments, set:
  - `RUNTIME_IFRAME_URL`
  - `RUNTIME_IFRAME_ORIGIN`

## Acceptance Checklist for Lovable
- Header trusts/selectors are fully payload-driven.
- Selector icons/tooltips render when present.
- Menu triad/edge grouping and collapse follow payload policy exactly.
- Welcome vs post-welcome state transitions follow payload policy.
- Menu and selector actions call AA endpoints and then forward to iframe.
- iframe occupies area between header and menu for mobile/tablet/desktop.
- No hardcoded runtime logic that duplicates planner/copilot decisions.
