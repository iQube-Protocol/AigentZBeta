# Mobile-landscape / metame.live iframe truncation — backlog

**Date:** 2026-06-01
**Status:** Deferred — waiting on Lovable clarification
**Owner:** TBD (next session)

## Symptom

On the metame.live iframe wrapping `dev-beta.aigentz.me/metame/runtime`:

- **Mobile landscape**: no scrolling at all inside the runtime — content past the visible band is clipped, can't be reached.
- **Tablet (iPad landscape)**: top of the wallet column and top of the copilot column appear cut off; wallet column also cut at the bottom.
- **Mobile portrait / desktop**: works as expected.

## What we know

- The runtime container lives at `components/metame/MetaMeRuntimeClient.tsx:5834`:
  ```tsx
  <div className="metame-runtime-layer relative h-full w-full ... overflow-hidden flex flex-col">
  ```
  `overflow-hidden` means any inner content that doesn't fit the iframe-given height is clipped, not scrolled.

- The chat thread inside `CodexCopilotLayer` (`app/components/codex/CodexCopilotLayer.tsx:1101-1104`) already has its own `overflow-y-auto` band, positioned absolutely between the header strip and the bottom prompt bar via inline `top`/`bottom` styles. That scroll works in tested viewports.

- The runtime emits ~88px of fixed chrome above the chat (agentSelector + R/T dots row at line 5842 + 6040) and ~50px of absolute bottom prompt bar (line 5905). On a ~390px mobile-landscape viewport that leaves the chat with single-digit pixels of usable height, which reads as "no scroll" even though the scroll exists.

- Shell layout (`app/(shell)/layout.tsx:120`) uses `flex h-screen overflow-hidden`. Inside an iframe, `100vh` resolves to the iframe's own viewport height — fine in principle, fragile if the iframe wrapper on metame.live doesn't give it a deterministic height.

## Three candidate fix surfaces

The right surface depends on what metame.live is actually doing — Lovable to clarify before we touch this.

### A. Runtime side — drop `overflow-hidden` to `overflow-y-auto` on `metame-runtime-layer`
- **Pro:** mobile-landscape becomes scrollable immediately.
- **Con:** the absolutely-positioned bottom prompt bar (`absolute inset-x-0 bottom-0`) stops being sticky — it pins to the bottom of the expanded content, not the viewport.

### B. Runtime side — keep the outer `overflow-hidden`, collapse the agent selector + R/T strip on short viewports
- Recovers ~88px of vertical space in embed mode on mobile-landscape.
- Preserves the sticky prompt bar behaviour.
- Doesn't help if the real cause is iframe-height collapse (option C).

### C. metame.live side — iframe wrapper height
- If the iframe is mounted without a deterministic `100dvh - top-chrome - bottom-chrome` height, the inner runtime's `h-full` resolves to whatever the iframe gives it (possibly 0 or content-driven).
- Needs Lovable to confirm how the iframe is sized in their layout (especially on mobile-landscape where browser chrome eats viewport).

## Action when resumed

1. Get from Lovable: the iframe's CSS in their wrapper (`height` / `min-height` / parent flex behaviour) at mobile-landscape and iPad-landscape breakpoints.
2. If iframe height is correct → apply Option B (collapse runtime chrome on short viewports).
3. If iframe height is collapsing → fix on metame.live's side; no change needed in this repo beyond perhaps documenting the expected iframe contract.

## Related prior work

- Persona menu dropdown max-h fix (earlier this session) — unrelated; that was the dropdown overflowing the page, not the panels themselves.
- `aigentMe Capsule ↔ Layout Contract` (`codexes/packs/agentiq/updates/2026-05-28_aigentme-capsule-layout-contract.md`) — different concern (Capsule/layout pairing inside the right pane), not viewport sizing.

## Files referenced

- `components/metame/MetaMeRuntimeClient.tsx:5833-5905` — `runtimeSurface` definition, chrome rows, absolute prompt bar
- `app/components/codex/CodexCopilotLayer.tsx:1062-1104` — embedded-variant container, chat scroll band
- `app/(shell)/layout.tsx:120` — outer shell `flex h-screen overflow-hidden`
