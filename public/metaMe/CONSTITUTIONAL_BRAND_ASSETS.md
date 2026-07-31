# metaMe & iQube — Constitutional Brand Asset System

**Status:** CONSTITUTIONAL — canonical source for every icon, favicon, and logo mark across the
metaMe / AigentZ / iQube Protocol ecosystem. `public/metaMe/` is the single authoritative
location. No other copy of these marks — in any repo, any app, any deck — is authoritative;
everything else derives from what is here.

This directory implements the "one canonical source, no independent copies" principle (BRD-001,
the same principle PAS-001 applies to identity) for visual brand assets.

---

## Directory layout

```
public/metaMe/
  CONSTITUTIONAL_BRAND_ASSETS.md   — this file
  sources/                          — original design-tool masters, not served directly
    metame.ai / .cdr / .eps         — vector masters (CorelDRAW X6, 2018)
    iqube-copper-render.png         — high-res 3D iQube renders, one per colorway
    iqube-copper-render-alt.png     — alternate crop/angle of the copper render
    iqube-sand-render.png
    iqube-teal-render.png
    iqube-stone-render.png
    asset-specification-sheet.png   — the original spec-sheet reference (META-LOGO-001)
  metaMe/                           — the hand-in-hexagon mark (primary identity)
    metame.png                      — canonical transparent master (square-cropped, 933px)
    metame-16.png ... metame-1024.png (includes 192px, the standard PWA/app-icon size)
    favicon.ico                     — 16/32/48 multi-size, generated from the mark
    favicon-16.png / -32.png / -48.png — single-size PNG aliases of the same sizes, for
                                          consumers that want a PNG rather than an .ico
  iQube/                            — the circuit-cube mark, four colorways
    copper/  iqube-16.png ... iqube-1024.png (includes 192px)
    sand/    iqube-16.png ... iqube-1024.png (includes 192px)
    teal/    iqube-16.png ... iqube-1024.png (includes 192px)
    stone/   iqube-16.png ... iqube-1024.png (includes 192px)
```

Naming deliberately uses hyphens (`metame-128.png`, not `metame_128.png`) and the short colorway
names `copper` / `sand` / `teal` / `stone` (not `sandstone`) — this is the operator-ratified
convention, one step simpler than the original spec sheet's underscore convention. If you find
`metame_{size}.png`-style references elsewhere, treat this file as the correction.

---

## Canonical marks

| Mark | Meaning | Primary use |
|---|---|---|
| **metaMe** — hand inside a hexagon | Sovereign identity, the guardian layer | Favicons, app icons, identity surfaces, anywhere a single-color/single-context mark is needed |
| **iQube** — circuit-etched cube | The core data primitive | Registry, iQube cards, minting flows, anywhere a colorway signals iQube state or category |

## Color system (canonical)

**metaMe palette**

| Name | Hex | Role |
|---|---|---|
| Coral | `#FF5C5C` | Primary — the hexagon outline |
| Graphite | `#4A4A4A` | Primary — the hand glyph |
| White | `#FFFFFF` | Neutral |

**iQube palette — four colorways**

| Name | Hex | Folder |
|---|---|---|
| Copper | `#B87333` | `iQube/copper/` |
| Sandstone | `#D2B48C` | `iQube/sand/` |
| Teal | `#4FA7A3` | `iQube/teal/` |
| Stone | `#8F8F8F` | `iQube/stone/` |

Values are sourced verbatim from `sources/asset-specification-sheet.png` (META-LOGO-001) and from
`services/representation/interpretations/agentiqLiquidGlass.ts`'s `field.*` tokens where the two
overlap — never re-eyedropped from a render.

---

## Usage rules

- Use only the files under `metaMe/` and `iQube/`. Never re-export, re-crop, or re-color a mark
  outside this system — extend this directory, don't fork the mark.
- Do not alter proportions, rotate, skew, or distort either mark.
- Do not add effects, shadows, or gradients beyond what ships here.
- Maintain clear space: at minimum the height of the hand (metaMe) or the cube (iQube) around the
  mark on every side.
- Coral + Graphite for metaMe communications. Copper is the iQube default; use another colorway
  only when the surface is deliberately signalling a different iQube category or state.

## Known limitation — iQube colorway marks are photorealistic renders, not flat vectors

The four iQube colorway PNGs in `sources/` are high-resolution 3D renders (bevelled copper/
sandstone/teal/stone metal), not flat vector icons. Downsampling a photoreal render loses
legibility the way a flat glyph doesn't:

| Size | Verified legibility |
|---|---|
| 512 / 1024 | Crisp — full bevel and circuit detail reads clearly |
| 128 – 256 | Good — cube shape and circuit motif both read |
| 64 | Borderline — reads as "a textured cube," detail starts to mush |
| 16 / 32 | **Not fit for favicon/app-icon use** — the bevel detail collapses into noise at this size |

**Practical rule:** use an iQube colorway PNG at 128px or larger. For any surface needing a
16/32px iQube-branded glyph (browser favicon, tiny badge), use the **metaMe mark** instead, or a
flat solid-color swatch in the colorway's hex — do not use the small iQube PNG variants shipped
here; they exist for completeness of the size ladder, not because they're legible at that size.

This is a real gap, not a rounding error: producing a genuinely flat, small-size-legible iQube
glyph needs a proper vector redraw (Illustrator/CorelDRAW pass by whoever owns the source files),
not an automated fix. Until that exists, `metaMe/` is the only mark cleared for small sizes.

## Known limitation — no vector (SVG) source shipped yet

`sources/metame.ai` is genuinely a vector file (CorelDRAW X6, exported as PDF-compatible), but it
did not rasterize through either available renderer in this environment (`pdftoppm`, `pdftocairo`
via poppler-utils both produced a blank page — likely a spot-color / ICC-profile interaction
poppler doesn't handle, not a corrupt file). `sources/metame.cdr` and `sources/metame.eps` are the
other vector masters and were not converted either, for the same reason.

Every PNG in `metaMe/` and `iQube/` was produced by **resizing an existing raster** (the shipped
transparent `metame.png` for the hand mark; the four render PNGs, white-keyed to transparency and
square-cropped, for the cube). This means the PNG ladder is real and correct at every size listed
above, but **no true `.svg` exists yet** for either mark. `favicon.ico` is a real multi-size ICO
(16/32/48) generated from the raster, so standard favicon usage is covered.

**To close this gap:** open `sources/metame.ai` or `.cdr` in CorelDRAW/Illustrator and export a
flat SVG directly — that will succeed where the automated raster pipeline didn't, because the
design tool reads its own native color model correctly. Once real `metame.svg` / `iqube.svg` files
exist, add them to `metaMe/` and each `iQube/<colorway>/` folder and update this file's directory
listing.

---

## Favicon & app-icon guidance

| Use | File |
|---|---|
| Browser favicon | `metaMe/favicon.ico` (16/32/48 multi-size) |
| PWA / mobile icon | `metaMe/metame-192.png` if generated, else `metame-256.png` |
| App Store / Play Store | `metaMe/metame-1024.png` |
| iQube colorway badge (128px+) | `iQube/<colorway>/iqube-<size>.png` |

### Favicon color exception — white hand, not graphite

`favicon.ico` / `favicon-16.png` / `favicon-32.png` / `favicon-48.png` deliberately recolor the
hand glyph and dot **white** instead of the canonical Graphite (`#4A4A4A`-ish) used everywhere
else. At browser-tab and toolbar size, these render against dark chrome (Brave/Chrome dark theme
tab strips, extension toolbars) far more often than against a white card, and Graphite on a dark
background is genuinely invisible — confirmed by rendering the icon over a dark background before
and after. The hex outline stays Coral in both versions; only the interior glyph changes.

This is the one documented exception to "Coral + Graphite for metaMe communications" — scoped
to small, dark-chrome contexts only. The general-purpose `metame-16.png` … `metame-1024.png`
ladder (cards, larger app icons, marketing) keeps Graphite. `extension/companion-observer/`'s
toolbar icons (`icon16.png` … `icon128.png`) use the same white variant as the favicon, for the
identical reason — a browser toolbar is exactly the same dark-chrome context a favicon renders in.

## Source of truth

These assets are constitutional primitives (BRD-001). Every application, website, extension,
mobile app, and document SHALL derive its logos and icons from this directory. Independent copies
are prohibited — if a surface needs a size or format not listed here, generate it from the
`sources/` masters and add it to the ladder, rather than sourcing it from anywhere else.
