# metaMe DesignQube — Style Brief
## Parchment Intelligence Light Mode + KNYT Glass Dark Mode

---

## Purpose
This DesignQube governs look, feel, and interaction grammar for metaMe Runtime (mobile-first) and Studio (desktop-first). It encodes material rules, color/spacing tendencies, and compositional constraints without requiring strict pixel parity. Where conflicts occur, prefer clarity and trust signals over strict adherence.

---

## 1. Core design thesis

**Light mode** should feel like:
> "A living codex page where intelligence is being mapped, drafted, and revealed."

**Visual basis:** Star Trek: Discovery title sequence (Prologue studio, 2017). Sepia-soaked parchment, technical linework, wireframes, handwritten-feeling marks, Leonardo da Vinci–style drafting notebook. Translated into product UI — not title art.

Not:
- Glossy SaaS
- Sterile white dashboard
- Soft consumer app chrome
- Skeuomorphic "paper" nostalgia
- Retro stationery or scrapbook

**Dark mode** should feel like:
> Near-black cinematic surfaces with glass/translucent overlays — premium, immersive, KNYT Glass.

---

## 2. Material model (light mode)

Three-layer material hierarchy:

| Layer | Feel | Role |
|-------|------|------|
| **Parchment canvas** | Warm textured base field | Background of all screens |
| **Vellum surfaces** | Cards, drawers, panels, modals | Refined sheets placed on the canvas |
| **Ink & notation** | Typography, linework, accents, trust marks | Meaning written onto the material |

---

## 3. Canvas language (light mode)

The base is **not** pure white. It is a refined parchment / drafting sheet:
- Warm ivory (`#F1EBDD`) — muted, not bright, not obviously sepia
- Subtle fine grain + soft tonal variation (opacity 3–4%)
- Faint tonal clouding — slight variation across the field
- Optional ghosted drafting traces in hero / empty states only

**Test:** If the user immediately notices "paper texture," the grain is too strong. It should register subconsciously.

---

## 4. Surface tiers (light mode)

| Tier | Token | Use |
|------|-------|-----|
| 0 — Canvas | `#F1EBDD` | Base parchment field |
| 1 — Working surfaces | `#F7F2E8` | Standard cards, content planes |
| 2 — Focus surfaces | `#FBF7EF` | Active modules, selected cards, drawers |
| 3 — Vellum overlays | `rgba(249,244,235,0.82)` | Contextual panels, non-modal overlays |
| 4 — Modal / critical | `rgba(255,251,243,0.88)` | Modals, commitment states |

Surfaces are defined primarily by:
- Tonal lift over background
- Precise hairline borders
- Minimal warm shadow
- **NOT** by heavy shadow stacks or boxed-card outlines

---

## 5. Shape language

Medium-small, premium, ergonomic radii. Not square, not bubbly.

| Token | Value | Use |
|-------|-------|-----|
| `--mm-radius-xs` | 10px | Chips, segmented controls, compact buttons |
| `--mm-radius-sm` | 14px | Standard cards, inputs, capsules (default) |
| `--mm-radius-md` | 18px | Prompt bars, drawers, important panels |
| `--mm-radius-lg` | 22px | Hero containers only |

---

## 6. Color system (light mode tokens)

### Base neutrals
```
--mm-canvas-base:     #F1EBDD   /* parchment base */
--mm-canvas-variant:  #ECE4D6
--mm-canvas-deep:     #E4DAC9
--mm-surface-1:       #F7F2E8   /* folio surfaces */
--mm-surface-2:       #FBF7EF
--mm-surface-3:       rgba(249, 244, 235, 0.82)
--mm-surface-4:       rgba(255, 251, 243, 0.88)
--mm-ink-primary:     #2E2923   /* warm charcoal */
--mm-ink-secondary:   #595247
--mm-ink-muted:       #7B7266
--mm-ink-faint:       #9A9085
--mm-ink-inverse:     #FFFDF8
```

### Linework
```
--mm-line-subtle:  rgba(68, 57, 41, 0.08)
--mm-line-soft:    rgba(68, 57, 41, 0.12)
--mm-line-medium:  rgba(68, 57, 41, 0.18)
--mm-line-strong:  rgba(68, 57, 41, 0.26)
```

### Annotation-ink accents
Accents appear like measured notations on a drawing — not broad UI fills.

```
--mm-accent-runtime: #4F8C98   /* muted cyan-teal — exploration / system */
--mm-accent-codex:   #A27A3D   /* amber-brass — archival / provenance */
--mm-accent-make:    #935872   /* restrained plum — generative / creation */
--mm-accent-earn:    #64856D   /* muted green — validation / trust */
--mm-accent-share:   #5C718B   /* ink-blue — sharing / social */
--mm-accent-alert:   #A25A4E   /* iron red — alert / intervention */
```

**Accent rule:** Use at 10% wash opacity for fills. Borders up to 28% opacity. Text at full. Active states are *marked*, not *painted*.

---

## 7. Linework and detailing

Linework is a primary storytelling device (the most important translation from the Discovery reference).

Use:
- Hairline borders (1px, `rgba(68,57,41,0.10–0.20)`)
- Fine sectional dividers
- Contour rings on trust indicators
- Node connectors and orbit indicators
- Dotted measurement traces
- Subtle annotation marks
- Symbol fragments that hint at system state

**Rule:** Every line must either separate, annotate, orient, or signal state. If it does none of these, remove it.

---

## 8. Typography

### Primary role
Clean humanist or neo-grotesk sans for all primary UI: nav, headers, body, prompts, cards, guidance text.

Tone: modern, warm, calm, legible, authoritative.

### Secondary technical role
Restrained mono or technical companion for: metadata, trust values, registry IDs, timestamps, tabular signal text, coordinate-like annotations.

Tone: precise, instrument-like, compact, unobtrusive.

### Scale
```
xs: 12px  — metadata, system marks
sm: 13px  — compact labels
md: 15px  — body / UI text
lg: 17px  — key headers
xl: 20px  — major surface titles
2xl: 24px — hero headings
```

---

## 9. Animation — DEFERRED

Per project policy, animation changes are tracked separately.
**Do not modify existing motion timing, easing, or animation code.**

See `docs/design/light-mode-animation-backlog.md` for the intended future motion system (structure-first reveal, parchment-draw-in, assembly transitions).

---

## 10. Component guidance

### Header
- Lean instrument strip — no chunky nav bar
- Hairline bottom divider
- Trust indicators as calibrated rings / notched marks
- Selectors feel like precision instrument controls

### Smart menu (resting)
- Low-profile vellum control rail
- Integrated with the parchment system — not a separate mobile nav kit

### Smart menu (active prompt)
- Expands to a composed drafting/input surface
- One restrained active cue only: inner accent line OR edge pipe OR tint wash
- Never flood-filled with mode color

### Cards
- Feel like folios placed on a drafting table
- Interior spacing and linework carry the hierarchy
- Metadata reads as annotations, not gray subtext

### Active guide / handoff cards
- Expressed through contour, notation, edge trace — not loud fills
- Should feel "flagged" or "pinned" on the canvas

### Drawers
- Vellum-like overlay: slightly translucent warm surface, stronger edge clarity
- Open with layered reveal motion (deferred — see backlog)

### Modals
- Warm elevated folio above the workspace
- Generous whitespace, quiet edge definition
- Warm restrainted scrim — not heavy dark theatrical dim

### Buttons
- Primary: controlled fill or wash + clear contour + elegant text
- Secondary: vellum-backed or contour-only
- Tertiary: text-led, underline/contour on hover
- Should feel like precision controls, not marketing CTAs

### Trust indicators
- Ring geometry, notch marks, radial segmentation
- Technical labels using secondary mono face
- Measured, calibrated, systemic — not badge-heavy

---

## 11. Dark theme (KNYT Glass) — unchanged

- Near-black backgrounds: `#0B0D10`, `#12151C`, `#171B24`
- Glassmorphism enabled: blur 18px, alpha 0.55, borderAlpha 0.16
- Coral accent: `#FF5A5F` for primary actions and active state
- Max 3 primary actions visible at a time
- Tabs: text tabs with thin coral underline
- Use drawers/sheets for secondary complexity

---

## 12. Guardrails (light mode)

**Do:**
- Keep the palette warm and quiet
- Use texture subtly (perceptible, not decorative)
- Make surfaces feel layered and material
- Keep radii medium-small and premium (10–18px in standard use)
- Use linework for intelligence and structure
- Favor tone, spacing, and contour over heavy shadows and fills

**Do not:**
- Use pure white surfaces
- Let the parchment go yellow or brown (it's ivory, not sepia)
- Over-texture the canvas
- Square off surfaces or use bubbly consumer radii
- Use strong drop shadows
- Make it look retro, stationery, steampunk, or sci-fi HUD
- Use generic teal/cyan glassmorphism from the dark theme in light mode

---

## 13. One-sentence directive

> Design metaMe Runtime light mode as a premium parchment intelligence environment: a subtly textured muted-ivory canvas with layered vellum-like surfaces, medium-small sophisticated ergonomic radii, fine technical linework, restrained annotation-ink accents, and motion that reveals structure as though the interface is being drafted into clarity.

---

## 14. Value & currency display policy
- Canonical calculations are in Q¢/QCT by default
- Wallet views prioritize Q¢/QCT
- $KNYT is reserved for KNYT Offer contexts inside KNYT experiences
- USD may be shown as a secondary comprehension aid
