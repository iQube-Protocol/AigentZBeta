# Lovable Replication Brief: Runtime Header + Menu Styles, Motion, and Triggers

## Scope
Replicate the **AigentiQ metaMe Runtime** header/menu behavior in the thin client shell, with iframe content rendered between header and menu.

Source-of-truth files:
- `components/metame/MetaMeRuntimeClient.tsx`
- `services/aa-api/src/routes/runtime.ts`
- `packages/aa-client/src/index.ts`
- `apps/metame-runtime-shell/app/globals.css`
- `apps/metame-runtime-shell/app/components/RuntimeHeader.tsx`
- `apps/metame-runtime-shell/app/components/SmartMenu.tsx`

## 1) Visual System (Shell CSS Tokens)

Use these shell tokens as baseline:
- `--surface: #f3f6fa`
- `--panel: #ffffff`
- `--panel-soft: #eef3fb`
- `--ink: #0b1b2b`
- `--ink-muted: #4f5f74`
- `--stroke: #cfd8e6`
- `--accent: #1367d9`
- `--accent-soft: #d9e9ff`
- `--ok: #118a49`
- `--warn: #c2780a`
- `--fail: #b42318`

Shell background:
- Radial + linear layered gradient
- Typography: `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`

## 2) Header Behavior

### 2.1 Trust + Reliability indicators
- Header trust strip is payload-driven from `session.trust_signals[]`.
- Dot state mapping:
  - `ok` -> green (`--ok`)
  - `warn` -> amber (`--warn`)
  - `fail` -> red (`--fail`)
- Runtime semantics:
  - Trust/reliability are derived from selected provider (AA API reliability map).
  - `trust_level` from AA payload:
    - `verified` when trust `ok`
    - `warning` when trust `warn`
    - `unverified` when trust `fail`
- Current runtime dot model is 5 dots with score buckets (low/red, mid/yellow, high green/purple).

### 2.2 Aigent selector
- Must render from `selectors.aigent.current` and `selectors.aigent.options`.
- Show option icon + tooltip + color when present:
  - `aigent-z`: icon `bot`, color `#67e8f9`, tooltip `System orchestrator`
  - `aigent-kn0w1`: `brain`, `#6ee7b7`
  - `aigent-moneypenny`: `coins`, `#c4b5fd`
  - `aigent-nakamoto`: `hexagon`, `#fcd34d`
  - `aigent-marketa`: `megaphone`, `#fda4af`
- Selector popover behavior in runtime:
  - Auto-hide timeout on mouse-leave: **3000ms**
  - Cancel hide on mouse-enter

### 2.3 LLM selector
- Must render from `selectors.llm.current` and `selectors.llm.options`.
- Show provider icon + tooltip from payload (`openai`, `anthropic`, `venice`, `chaingpt`, `thirdweb`).
- LLM options are per-selected-Aigent; changing Aigent refreshes model list.
- Selector popover behavior mirrors Aigent selector (3000ms leave-close).

## 3) Menu System Contract

### 3.1 Primary menu items and semantics
- Item IDs: `be`, `earn`, `play`, `make`, `share`
- Edge items: `be`, `share`
- Core triad: `earn`, `play`, `make`
- Payload fields per item:
  - `label`, `icon`, `tooltip`, `color`, `enabled`, `edge`, `trigger`

Color map (AA policy):
- `be`: `#cbd5e1`
- `earn`: `#6ee7b7`
- `play`: `#67e8f9`
- `make`: `#d8b4fe`
- `share`: `#cbd5e1`

Icon mapping (AA payload):
- `be`: `users`
- `earn`: `coins`
- `play`: `play-circle`
- `make`: `pencil`
- `share`: `share-2`

### 3.2 Layout rules (must mirror runtime)
- Mobile:
  - One row with 5 actions: `Be | Earn | Play | Make | Share`
- Tablet/Desktop:
  - `Be` left
  - tightly grouped center triad `Earn | Play | Make`
  - `Share` right

Policy keys to respect:
- `menu.policy.close_group_desktop_tablet = true`
- `menu.policy.center_group_ids = ["earn","play","make"]`
- `menu.policy.triad_cluster_gap = "tight"`

### 3.3 Collapse behavior
- Collapse when:
  - `menu.mode === "collapsed"` OR
  - `menu.policy.collapse_to_metame_button === true` and edge-item rule applies
- Collapsed layout:
  - Left: `Be`
  - Center: `metaMe` button opens triad actions
  - Right: `Share`

### 3.4 Menu button interaction styling
Match runtime states:
- Base:
  - neutral text, subtle border/background
- Hover:
  - light surface lift / brighter text
- Active (`aria-pressed` / selected intent):
  - brighter bg + visible ring/accented border
- Disabled:
  - lower opacity and non-interactive cursor

## 4) Welcome vs Post-Welcome Behavior

AA policy source:
- `menu.policy.state_behavior.welcome`
- `menu.policy.state_behavior.post_welcome`

Current runtime behavior:
- Initial state (`showWelcome=true`):
  - top trust/reliability bar
  - centered prompt box
  - bottom menu visible
  - quick links available in welcome area
- Post-welcome (`showWelcome=false` after first non-system prompt):
  - runtime content surface active
  - menu remains as footer action rail
  - floating input enabled (`floatingInput`)

Reset behavior:
- `__runtime_reset__` returns to welcome state.

## 5) Quick Links + Floating Quick Links

### 5.1 Welcome quick links
AA policy source: `menu.policy.quick_links`
- `Watch` icon `tv` prompt `"I'd like to watch experiences."`
- `Listen` icon `headphones` prompt `"I'd like to listen to experiences."`
- `Read` icon `book-open` prompt `"I'd like to read experiences."`
- `Find` icon `compass` prompt `"Help me find experiences."`

### 5.2 Floating/system quick links
AA policy source: `menu.policy.floating_quick_links`
- `Refresh runtime` icon `refresh-cw` prompt `__runtime_refresh__`
- `Reset runtime` icon `rotate-ccw` prompt `__runtime_reset__`
- `Toggle native preview` icon `maximize-2` prompt `__runtime_toggle_fullscreen__`

These are system actions (`skip_inference=true`) and should not trigger inference prompts.

### 5.3 Prompt box
AA policy source: `menu.policy.prompt_box`
- Placeholder: `What do you want to do today?`
- Send icon: `send`

## 6) Motion and Animation Details

Keep motion subtle and functional, matching current runtime:
- Quick links overlay fade:
  - `transition-opacity`
  - duration **200ms**
  - show/hide via opacity state
- Selector/model option rows:
  - standard transition on hover/selected state
- Menu buttons:
  - transition on bg/text/ring changes

Behavioral timings:
- Selector popover auto-close after **3000ms** on pointer leave.
- Welcome quick links auto-hide **3000ms** after mouse leave in current runtime.

Do not add heavy or decorative motion beyond this baseline.

## 7) Trigger Mapping (Critical)

Menu triggers (must match AA payload):
- `be` -> prompt `I want to be...`, intent `be`
- `earn` -> `How can I earn...`, intent `earn`
- `play` -> `I'd like to play experiences.`, intent `play`
- `make` -> `I want to make...`, intent `make`
- `share` -> `Help me find experiences to share.`, intent `find`

Each menu item includes:
- `trigger.surface_plan_instruction`
- `trigger.copilot_instruction`

Use these as canonical orchestration hints.

## 8) API + iframe Event Flow

On selector change:
1. `POST /aa/v1/runtime/selectors`
2. Rehydrate from returned `shell_config`
3. Forward iframe event `SELECTOR_CHANGE`

On menu action:
1. `POST /aa/v1/runtime/menu-action`
2. Rehydrate from returned `shell_config`
3. Use `menu_event` payload (prompt/intent/surface_plan_instruction/copilot_instruction)
4. Forward iframe event `MENU_ACTION` with returned event context

iframe bootstrap:
- Use `iframe.url`
- Enforce `iframe.postMessageOrigin`
- Bootstrap with `iframe.bootstrap.handoff_token` + `iframe.bootstrap.context`

## 9) iFrame placement and responsive shell

Shell responsibilities:
- Render header and menu chrome.
- Keep iframe as primary content between header and menu.
- Maintain iOS safe-area padding top/bottom.
- Keep layout stable in mobile/tablet/desktop.

For this runtime, iframe content must be rendered exactly in the middle surface area between header and footer menu.

## 10) Acceptance checklist for Lovable
- Header uses payload-driven trust indicators + selectors (icon/tooltip/color supported).
- Menu layout and collapse behavior mirror runtime policy across mobile/tablet/desktop.
- Quick links + floating quick links wired to payload and prompt semantics.
- Welcome/post-welcome transitions implemented with correct prompt/quick-link behavior.
- Menu and selector actions execute AA mutations and forward iframe events with canonical hints.
- Motion timings match runtime baseline (200ms fades, 3000ms auto-hide behaviors).
