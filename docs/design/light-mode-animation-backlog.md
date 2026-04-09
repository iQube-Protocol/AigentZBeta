# Light Mode Animation Backlog

**Status:** Deferred — do not implement until explicitly requested.
**Reason:** Existing animation code was carefully tuned over many sessions. Motion changes require isolated review and testing to avoid regressions.

---

## Intended motion system for Parchment Intelligence

### Core principle
Motion should feel like **drafting, revealing, and assembling** — not bouncing, zooming, or performing.

The UI should behave as though it is being *drawn into clarity*.

---

## Motion tokens (to implement when ready)

```css
--mm-dur-fast:   140ms;
--mm-dur-base:   200ms;
--mm-dur-slow:   280ms;
--mm-dur-panel:  320ms;

--mm-ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1);
--mm-ease-soft:     cubic-bezier(0.2, 0.7, 0.2, 1);
```

---

## Target behaviors (per component)

### Cards and surfaces
- Border/contour appears first (thin line resolves into surface edge)
- Surface fades up as if exposed on tracing paper
- Content fades/settles in after surface is visible
- Sequence: `contour → surface → content`

### Icons
- Morph from schematic/wireframe state to resolved form
- Dual-state icons: wireframe (idle) → filled (active)

### Cards assembling
- From fragment or contour — not pop-in from nowhere
- Active selections gain annotation mark or edge-trace emphasis

### Modal / drawer reveal
- Layered reveal, not hard scaling
- Should feel "laid over" the canvas, not dropped from above
- Warm scrim fades in before surface slides in

### Loading states
- Faint drafting sweep or node-connection resolve
- Skeleton looks like a contour skeleton, not gray shimmer bars
- Content draws into clarity from structure

### Active routes / paths
- Pulse like mapped paths on a diagram
- Not bouncy spinner behavior

---

## What to preserve from current system

- All existing timing values in MetaMeRuntimeClient.tsx and drawer.css
- All existing carousel / capsule transition logic
- All existing TTS / audio sync animation coordination
- The `slide-in-right`, `slide-in-left`, `fade-in`, `copilot-pulse-right` classes in `styles/drawer.css`

---

## Anti-patterns to avoid when implementing

- Bounce or elastic overshoot (spring physics)
- Flashy scale zooms
- Heavy particle / liquid morphs
- Neon glow pulses
- Abrupt software-feeling swaps (instant appear/disappear)

---

## Discovery reference

The Star Trek: Discovery title sequence (Prologue, 2017) uses:
- Morphs from abstract geometry → recognizable form
- Blueprint fragments resolving into objects
- Fades, overlays, floating fragments — not aggressive camera moves
- Fluid but measured: "concept art becoming reality"

This is the motion vocabulary to translate into component transitions when the backlog is actioned.
