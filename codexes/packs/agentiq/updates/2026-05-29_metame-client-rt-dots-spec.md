# metaMe client protocol primitive — R/T scoring dots + busy pulse

**Date:** 2026-05-29
**Surface:** SmartTriadCopilotLayer header (Reliability / Trust dot strips)
**Status:** Canonical client protocol primitive. Any cartridge / thin-client surfacing copilot reliability + trust must replicate this spec exactly.

---

## 1. What the dots mean

Each strip (R and T) is **5 dots** representing a 0–10 score, where each dot covers a 2-point band:

| Dot index (0-based) | Score range |
|---|---|
| 0 | 0.01–2.00 |
| 1 | 2.01–4.00 |
| 2 | 4.01–6.00 |
| 3 | 6.01–8.00 |
| 4 | 8.01–10.00 |

A dot is "lit" when its band contains the score *or* any band below it. Formally:

```
dotCount = Math.ceil(value / 2)   // integer 0..5
lit(i)   = i < dotCount           // boolean for dot index i
```

Unlit dots are always rendered (so the strip is always 5 dots wide), in the neutral colour.

## 2. Colour logic

Two strips, two colour ramps. Both share the unlit + low/mid bands; only the high band differs.

| State | Reliability (R) | Trust (T) | Unlit |
|---|---|---|---|
| value ≤ 3.00 | red-500 | red-500 | slate-600 |
| 3.01 ≤ value ≤ 6.00 | yellow-500 | yellow-500 | slate-600 |
| value > 6.00 | **purple-500** | **green-500** | slate-600 |

The colour is applied per-dot only for lit dots. Unlit dots stay neutral regardless of the strip's value band.

Tailwind class shorthand (background only):

```ts
const colorClass = isLit
  ? (type === 'trust'
      ? (value <= 3 ? 'bg-red-500' : value <= 6 ? 'bg-yellow-500' : 'bg-green-500')
      : (value <= 3 ? 'bg-red-500' : value <= 6 ? 'bg-yellow-500' : 'bg-purple-500'))
  : 'bg-slate-600';
```

## 3. Dot geometry + strip layout

Each dot is a 1.5 × 1.5 (Tailwind `h-1.5 w-1.5`) circle. Strip is a flex row with 0.5-unit gap:

```html
<div class="flex items-center gap-0.5">
  <span class="h-1.5 w-1.5 rounded-full bg-…"></span>   <!-- dot 0 -->
  <span class="h-1.5 w-1.5 rounded-full bg-…"></span>   <!-- dot 1 -->
  …                                                      <!-- 5 total -->
</div>
```

Each strip is preceded by a label (`R` for reliability, `T` for trust) in `text-[10px]` muted-foreground colour, separated by `gap-2`.

## 4. Busy-state pulse animation

The dots **pulse** any time the copilot is doing work the operator should wait on. There are TWO independent busy signals that drive the same pulse:

| Signal | When | Source state |
|---|---|---|
| Chat round-trip in flight | Operator sent a prompt; awaiting `/api/codex/chat` response | `isProcessing === true` |
| TTS audio being fetched | Operator clicked Listen / speaker; awaiting `/api/skills/tts` bytes | `ttsState === 'loading'` |

The component computes:

```ts
const isBusy = isProcessing || ttsIsLoading;
```

When `isBusy === true`, each dot gets the Tailwind `animate-pulse` class with a **staggered animation-delay** so the strip ripples instead of pulsing in unison:

```html
<span
  class="h-1.5 w-1.5 rounded-full bg-… animate-pulse"
  style="animation-delay: 0.15s"   <!-- per-dot stagger -->
></span>
```

Stagger formula: `animationDelay: '${i * 0.15}s'` (so dots tick at 0s, 0.15s, 0.30s, 0.45s, 0.60s in order).

When `isBusy === false`, drop the pulse class and replace with `transition-all duration-300` so any colour change (score update) animates smoothly:

```ts
className={`h-1.5 w-1.5 rounded-full ${colorClass} ${
  isBusy ? 'animate-pulse' : 'transition-all duration-300'
}`}
style={isBusy ? { animationDelay: `${i * 0.15}s` } : undefined}
```

Tailwind's `animate-pulse` is the canonical 2s ease-in-out opacity wave (50% opacity at midpoint). Don't override the keyframes — the stagger via `animationDelay` is enough.

## 5. Placement + accessibility

- **Position:** header row, right side, immediately to the right of the assistant identity / speaker button cluster.
- **Order:** R strip first (left), T strip second (right).
- **Label colour:** `text-white/60` on dark surfaces, `text-slate-500` on light.
- **No hover affordance** — the dots are a passive indicator. Don't make them clickable; don't add tooltips that obscure the busy pulse.
- The pulse is purely visual. Screen readers should announce score changes via the parent component's aria-live region, not via the dots themselves.

## 6. Canonical implementation

```tsx
function ScoreDots({
  value,
  type,
  isBusy,
}: {
  value: number;            // 0..10
  type: 'trust' | 'reliability';
  isBusy: boolean;
}) {
  const dotCount = Math.ceil(value / 2);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const isLit = i < dotCount;
        let colorClass = 'bg-slate-600';
        if (isLit) {
          colorClass = type === 'trust'
            ? (value <= 3 ? 'bg-red-500' : value <= 6 ? 'bg-yellow-500' : 'bg-green-500')
            : (value <= 3 ? 'bg-red-500' : value <= 6 ? 'bg-yellow-500' : 'bg-purple-500');
        }
        return (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${colorClass} ${
              isBusy ? 'animate-pulse' : 'transition-all duration-300'
            }`}
            style={isBusy ? { animationDelay: `${i * 0.15}s` } : undefined}
          />
        );
      })}
    </div>
  );
}
```

Reference call sites:

- `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx:renderDots` — production implementation; matches this spec line-for-line.
- The strip ordering / labels are rendered alongside the dot strip in the same header row (search for `renderDots(7.8, "reliability")` / `renderDots(8.3, "trust")` in that file).

## 7. Why this is a metaMe client protocol primitive

Every metaMe-spec client surfaces copilot trust + reliability the same way. Thin-clients (Lovable, etc.) must replicate the spec line-for-line so the operator's mental model travels intact between server-rendered and externally-rendered cartridges. Diverging on dot count, colour, or busy-pulse semantics breaks the trust glance — the whole point of the strip is to be readable at a flicker.
