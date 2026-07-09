"use client";

/**
 * BearingInstrument — the constitutional compass (CFS-021 §5).
 *
 * The primary OPERATIONAL representation invariant of Constitutional Civic
 * Futurism. It is NOT a logo and NOT an icon — its verbs are ORIENT, NAVIGATE,
 * REASON, never decorate/brand/illustrate (CFS-021 §4, §5). Just as a compass
 * does not tell you where to go but lets you orient yourself, the Bearing
 * orients the reader within the Constitutional Field; after repeated exposure it
 * builds an intuitive mental map — constitutional UX, the visual language
 * performing reasoning assistance.
 *
 * Every colour and type flows through a representation ROLE resolved via the
 * active interpretation (`useRepresentation().role`) — the instrument hardcodes
 * NO look. Flip the interpretation (CCF ↔ High-Contrast Accessible) and the SAME
 * instrument reskins coherently with zero code change: under CCF it reads as a
 * charcoal-and-gold parchment instrument, under High-Contrast as a high-contrast
 * one. Interpretation-agnostic by construction.
 *
 * v1 delivers three of the five bearing functions:
 *   - ORIENTATION (where am I — the 7 field sectors + a needle to activeSector)
 *   - STANDING    (how mature — a graduated maturity bezel)
 *   - NAVIGATION  (where can I go — related-sector ticks + onNavigate INTENT)
 * PROJECTION (rotate the object through modalities) and PLATE-navigation are
 * honest follow-ons — there are no modalities and no Constitutional Plates yet,
 * so they are NOT stubbed here (see CFS-021 §5 delivery note).
 *
 * SSR-safe: no `window` in render; geometry is pure deterministic math. The
 * instrument is presentational and emits navigation INTENT only — it never
 * routes and carries no identifiers.
 */

import React, { useState } from "react";
import { useRepresentation } from "./RepresentationProvider";
import {
  FIELD_SECTORS,
  STANDING_LEVELS,
  type FieldSector,
  type StandingLevel,
  type RepresentationRole,
} from "@/types/representation";

// ---------------------------------------------------------------------------
// Pure helpers — no React, no `window`; node-drillable in isolation.
// ---------------------------------------------------------------------------

/** The field-sector colour role for a sector (`reasoning` → `field.reasoning`). */
export function sectorRole(sector: FieldSector): RepresentationRole {
  return `field.${sector}` as RepresentationRole;
}

/** The standing colour role for a level (`foundational` → `standing.foundational`). */
export function standingRoleName(level: StandingLevel): RepresentationRole {
  return `standing.${level}` as RepresentationRole;
}

/** Capitalise a sector/standing token for human-facing labels. */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The centre angle (degrees, SVG convention: 0°=east, +ve clockwise) of sector
 * `index` of `count`, with sector 0 placed at due north (-90°). Pure.
 */
export function sectorAngle(index: number, count: number = FIELD_SECTORS.length): number {
  return -90 + (index * 360) / count;
}

/** Polar → cartesian around a centre. Pure. */
export function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** SVG path for an annular wedge (sector) between two radii across an angle span. Pure. */
export function wedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const oS = polar(cx, cy, outerR, startDeg);
  const oE = polar(cx, cy, outerR, endDeg);
  const iE = polar(cx, cy, innerR, endDeg);
  const iS = polar(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${oS.x} ${oS.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oE.x} ${oE.y}`,
    `L ${iE.x} ${iE.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iS.x} ${iS.y}`,
    "Z",
  ].join(" ");
}

/** SVG path for a stroked arc between two radii-less angles at radius `r`. Pure. */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * The instrument's accessible description — names the active sector + standing
 * so a screen reader announces the orientation, exactly as a sighted reader
 * reads the needle. Pure.
 */
export function bearingAriaLabel(opts: {
  activeSector?: FieldSector | null;
  standing?: StandingLevel | null;
  label?: string;
}): string {
  const subject = opts.label ? `${opts.label} bearing` : "Bearing";
  const orient = opts.activeSector ? `oriented to ${titleCase(opts.activeSector)}` : "unoriented";
  const stand = opts.standing ? `, standing ${titleCase(opts.standing)}` : "";
  return `${subject}: ${orient}${stand}`;
}

/**
 * Emit navigation INTENT for a sector. The instrument reasons about where you
 * can go — it does NOT route. Returns whether an intent was emitted. Pure.
 */
export function emitNavigate(
  sector: FieldSector,
  onNavigate?: (sector: FieldSector) => void,
): boolean {
  if (typeof onNavigate !== "function") return false;
  onNavigate(sector);
  return true;
}

// ---------------------------------------------------------------------------
// The instrument
// ---------------------------------------------------------------------------

export interface BearingInstrumentProps {
  /** Where the reader IS in the field — the bearing orients toward it. */
  activeSector?: FieldSector | null;
  /** How mature the current object is — shown on the instrument's bezel. */
  standing?: StandingLevel | null;
  /** Navigation: directional ticks illuminate toward these related sectors. */
  relatedSectors?: FieldSector[];
  /** Navigation INTENT — clicking a sector emits it (instrument, not link). */
  onNavigate?: (sector: FieldSector) => void;
  /** Pixel size of the square instrument. */
  size?: number;
  /** The object being oriented (e.g. "CCRL") — folded into the aria-label. */
  label?: string;
  className?: string;
  /**
   * Rendering fidelity. `compact` (default) is the inline radial dial used on
   * dashboards. `atlas` is Canonical Asset 001 — Bearing Instrument v1.0: the
   * full navigation primitive (trinity octants, Invariant Intelligence /
   * Consequence Engineering poles, artefacts gauge, HDG/GS/ALT/TRK windows,
   * standing ring). Same roles; the atlas variant just renders the full anatomy.
   */
  variant?: "compact" | "atlas";
  /** Atlas variant only — the GS and ALT window values (operator-supplied
   * gauges with no derived meaning; render "—" when absent, never fabricated). */
  readouts?: { gs?: string; alt?: string };
  /** Atlas variant only — render the five constitutional-layer margin labels. */
  showLayerLabels?: boolean;
}

function CompactBearing({
  activeSector = null,
  standing = null,
  relatedSectors = [],
  onNavigate,
  size = 96,
  label,
  className,
}: BearingInstrumentProps) {
  const { role, interpretation } = useRepresentation();
  const [focusedSector, setFocusedSector] = useState<FieldSector | null>(null);

  const interactive = typeof onNavigate === "function";

  // Roles (never raw values).
  const surfaceRaised = role("surface.raised");
  const borderSubtle = role("border.subtle");
  const inkMuted = role("ink.muted");
  const geometry = role("accent.geometry");
  const annotationFont = role("type.annotation");
  const tempo = role("motion.tempo");
  const reveal = role("motion.reveal");

  // Geometry (pure, deterministic — SSR-safe).
  const cx = size / 2;
  const cy = size / 2;
  const hubR = size * 0.13;
  const innerR = size * 0.17;
  const outerR = size * 0.35;
  const bezelR = size * 0.4;
  const tickInner = size * 0.365;
  const tickOuter = size * 0.395;
  const labelR = size * 0.455;
  const needleLen = size * 0.31;
  const count = FIELD_SECTORS.length;
  const halfSpan = 360 / count / 2;
  const gap = 3; // degrees of breathing room between wedges

  const related = new Set(relatedSectors);
  const activeIndex = activeSector ? FIELD_SECTORS.indexOf(activeSector) : -1;
  const standingIndex = standing ? STANDING_LEVELS.indexOf(standing) : -1;

  const transition = `transform ${tempo} ${reveal}, opacity ${tempo} ${reveal}`;

  return (
    <div
      className={className}
      data-interpretation={interpretation.id}
      data-active-sector={activeSector ?? "none"}
      data-standing={standing ?? "none"}
      style={{ position: "relative", width: size, height: size, lineHeight: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={bearingAriaLabel({ activeSector, standing, label })}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Maturity bezel — the STANDING function: 4 graduated arcs, lit up to
            the current standing rung using the standing-scale roles. */}
        {STANDING_LEVELS.map((level, j) => {
          const start = -90 + j * 90 + 2;
          const end = -90 + (j + 1) * 90 - 2;
          const lit = j <= standingIndex;
          return (
            <path
              key={`bezel-${level}`}
              d={arcPath(cx, cy, bezelR, start, end)}
              fill="none"
              stroke={lit ? role(standingRoleName(level)) : borderSubtle}
              strokeWidth={size * 0.022}
              strokeLinecap="round"
              opacity={lit ? 1 : 0.35}
              style={{ transition }}
            />
          );
        })}

        {/* The bearing rose — the 7 field sectors as annular wedges. ORIENTATION:
            each sector is drawn from its own field role; the active/focused
            sector is emphasised (raised opacity + geometry stroke). */}
        {FIELD_SECTORS.map((sector, i) => {
          const centre = sectorAngle(i, count);
          const start = centre - halfSpan + gap / 2;
          const end = centre + halfSpan - gap / 2;
          const emphasised = sector === activeSector || sector === focusedSector;
          return (
            <path
              key={`sector-${sector}`}
              d={wedgePath(cx, cy, innerR, outerR, start, end)}
              fill={role(sectorRole(sector))}
              stroke={emphasised ? geometry : borderSubtle}
              strokeWidth={emphasised ? size * 0.012 : size * 0.006}
              opacity={emphasised ? 1 : 0.55}
              style={{ transition }}
            />
          );
        })}

        {/* Navigation ticks — where can I go: a short outward tick toward each
            related sector, illuminated in that sector's field colour. */}
        {FIELD_SECTORS.map((sector, i) => {
          if (!related.has(sector)) return null;
          const centre = sectorAngle(i, count);
          const a = polar(cx, cy, tickInner, centre);
          const b = polar(cx, cy, tickOuter, centre);
          return (
            <line
              key={`tick-${sector}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={role(sectorRole(sector))}
              strokeWidth={size * 0.02}
              strokeLinecap="round"
              style={{ transition }}
            />
          );
        })}

        {/* Sector labels — annotation voice, muted ink. Orientation anchors. */}
        {FIELD_SECTORS.map((sector, i) => {
          const centre = sectorAngle(i, count);
          const p = polar(cx, cy, labelR, centre);
          const emphasised = sector === activeSector || sector === focusedSector;
          return (
            <text
              key={`label-${sector}`}
              x={p.x}
              y={p.y}
              fill={emphasised ? geometry : inkMuted}
              fontFamily={annotationFont}
              fontSize={size * 0.058}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={emphasised ? 1 : 0.75}
              style={{ transition, userSelect: "none" }}
            >
              {titleCase(sector)}
            </text>
          );
        })}

        {/* The needle — ORIENTATION made explicit: a pointer from the hub toward
            the active sector, rotating smoothly (discovered, not noticed). Hidden
            when the instrument is unoriented. */}
        {activeIndex >= 0 && (
          <g
            transform={`rotate(${(activeIndex * 360) / count}, ${cx}, ${cy})`}
            style={{ transition: `transform ${tempo} ${reveal}` }}
          >
            <polygon
              points={`${cx},${cy - needleLen} ${cx - size * 0.03},${cy} ${cx + size * 0.03},${cy}`}
              fill={activeSector ? role(sectorRole(activeSector)) : geometry}
            />
            <polygon
              points={`${cx},${cy + needleLen * 0.42} ${cx - size * 0.03},${cy} ${cx + size * 0.03},${cy}`}
              fill={geometry}
              opacity={0.4}
            />
          </g>
        )}

        {/* Hub — the still centre of the instrument. */}
        <circle
          cx={cx}
          cy={cy}
          r={hubR}
          fill={surfaceRaised}
          stroke={geometry}
          strokeWidth={size * 0.01}
        />
      </svg>

      {/* NAVIGATION intent layer — when onNavigate is provided each sector is a
          real, keyboard-operable <button> that emits navigation INTENT. Absent
          onNavigate, the instrument is pure orientation (no interactive layer). */}
      {interactive &&
        FIELD_SECTORS.map((sector, i) => {
          const centre = sectorAngle(i, count);
          const midR = (innerR + outerR) / 2;
          const c = polar(cx, cy, midR, centre);
          const btn = size * 0.24;
          return (
            <button
              key={`nav-${sector}`}
              type="button"
              aria-label={`Navigate to ${titleCase(sector)} sector`}
              onClick={() => emitNavigate(sector, onNavigate)}
              onFocus={() => setFocusedSector(sector)}
              onBlur={() => setFocusedSector(null)}
              onMouseEnter={() => setFocusedSector(sector)}
              onMouseLeave={() => setFocusedSector(null)}
              style={{
                position: "absolute",
                left: c.x - btn / 2,
                top: c.y - btn / 2,
                width: btn,
                height: btn,
                margin: 0,
                padding: 0,
                border: "none",
                borderRadius: "50%",
                background: "transparent",
                cursor: "pointer",
                outline:
                  focusedSector === sector ? `2px solid ${geometry}` : "none",
                outlineOffset: 2,
              }}
            />
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atlas variant — Canonical Asset 001 · Bearing Instrument v1.0
// ---------------------------------------------------------------------------
//
// The frozen navigation primitive of the Constitutional Atlas. Same roles as
// the compact dial (interpretation-agnostic; no hardcoded look), rendered at
// full fidelity: perfect circular bezel + tick ring, three primary octants
// (Order / Reasoning / Action), the Invariant Intelligence / Consequence
// Engineering poles flanking the needle, the raised Artefacts gauge with six
// modality glyphs, the HDG / GS / ALT / TRK windows, and the bottom standing
// ring with its REGISTER marker. Under CCF it reads as the parchment atlas
// instrument; flip the interpretation and it reskins coherently.

/** The Constitutional Trinity — the three primary octants on the upper arc. */
export const ATLAS_TRINITY: FieldSector[] = ["order", "reasoning", "action"];

/** The two reasoning poles flanking the needle at the instrument's centre. */
export const ATLAS_POLES: { sector: FieldSector; label: string; side: "left" | "right" }[] = [
  { sector: "intelligence", label: "INVARIANT INTELLIGENCE", side: "left" },
  { sector: "consequence", label: "CONSEQUENCE ENGINEERING", side: "right" },
];

/** The six artefact modalities in the raised Artefacts gauge (document,
 * dialogue, scene, runtime, data, share). */
export const ATLAS_ARTEFACTS = ["document", "dialogue", "scene", "runtime", "data", "share"] as const;

/** The five constitutional layers, outermost → innermost (margin labels). */
export const ATLAS_LAYERS: string[] = [
  "LAYER 1 · CURRENT PLATE",
  "LAYER 2 · ADJACENT DOMAINS",
  "LAYER 3 · KNOWLEDGE DOMAINS",
  "LAYER 4 · MODALITIES",
  "LAYER 5 · STANDING RING",
];

/**
 * Heading degrees (1..360; due-north Reasoning ≡ 360) for the active sector —
 * the HDG readout. Derived from the sector's index on the field ring, never
 * invented. Pure. Returns null when unoriented.
 */
export function atlasHeadingDegrees(sector: FieldSector | null | undefined): number | null {
  if (!sector) return null;
  const i = FIELD_SECTORS.indexOf(sector);
  if (i < 0) return null;
  const deg = Math.round((i / FIELD_SECTORS.length) * 360);
  return deg === 0 ? 360 : deg;
}

/** Short register token for the TRK window (standing level, upper, ≤5 chars). */
export function atlasStandingShort(level: StandingLevel | null | undefined): string {
  return level ? level.slice(0, 5).toUpperCase() : "—";
}

/** A minimal artefact glyph drawn in a box of half-extent `s` centred at (x,y),
 * stroked in `stroke`. Recognisable primitives, not detailed icons (v1.0). */
function atlasArtefactGlyph(kind: string, x: number, y: number, s: number, stroke: string): React.ReactNode {
  const sw = Math.max(s * 0.14, 0.6);
  const common = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "document":
      return (
        <g {...common}>
          <rect x={x - s * 0.6} y={y - s * 0.8} width={s * 1.2} height={s * 1.6} rx={s * 0.18} />
          <line x1={x - s * 0.28} y1={y - s * 0.3} x2={x + s * 0.28} y2={y - s * 0.3} />
          <line x1={x - s * 0.28} y1={y} x2={x + s * 0.28} y2={y} />
          <line x1={x - s * 0.28} y1={y + s * 0.3} x2={x + s * 0.12} y2={y + s * 0.3} />
        </g>
      );
    case "dialogue":
      return (
        <g {...common}>
          <rect x={x - s * 0.8} y={y - s * 0.65} width={s * 1.6} height={s * 1.1} rx={s * 0.35} />
          <line x1={x - s * 0.2} y1={y + s * 0.45} x2={x - s * 0.5} y2={y + s * 0.9} />
        </g>
      );
    case "scene":
      return (
        <g {...common}>
          <rect x={x - s * 0.8} y={y - s * 0.55} width={s * 1.6} height={s * 1.1} rx={s * 0.12} />
          <line x1={x - s * 0.8} y1={y - s * 0.12} x2={x + s * 0.8} y2={y - s * 0.12} />
          <line x1={x - s * 0.35} y1={y - s * 0.55} x2={x - s * 0.05} y2={y - s * 0.12} />
          <line x1={x + s * 0.15} y1={y - s * 0.55} x2={x + s * 0.45} y2={y - s * 0.12} />
        </g>
      );
    case "runtime":
      return (
        <g {...common}>
          <rect x={x - s * 0.85} y={y - s * 0.45} width={s * 1.7} height={s * 0.9} rx={s * 0.45} />
          <circle cx={x + s * 0.42} cy={y} r={s * 0.14} fill={stroke} stroke="none" />
          <line x1={x - s * 0.5} y1={y - s * 0.12} x2={x - s * 0.5} y2={y + s * 0.12} />
          <line x1={x - s * 0.64} y1={y} x2={x - s * 0.36} y2={y} />
        </g>
      );
    case "data":
      return (
        <g {...common}>
          <ellipse cx={x} cy={y - s * 0.55} rx={s * 0.7} ry={s * 0.28} />
          <path d={`M ${x - s * 0.7} ${y - s * 0.55} L ${x - s * 0.7} ${y + s * 0.35}`} />
          <path d={`M ${x + s * 0.7} ${y - s * 0.55} L ${x + s * 0.7} ${y + s * 0.35}`} />
          <path d={`M ${x - s * 0.7} ${y + s * 0.35} A ${s * 0.7} ${s * 0.28} 0 0 0 ${x + s * 0.7} ${y + s * 0.35}`} />
        </g>
      );
    case "share":
    default:
      return (
        <g {...common}>
          <circle cx={x - s * 0.55} cy={y} r={s * 0.28} />
          <circle cx={x + s * 0.45} cy={y - s * 0.6} r={s * 0.28} />
          <circle cx={x + s * 0.45} cy={y + s * 0.6} r={s * 0.28} />
          <line x1={x - s * 0.3} y1={y - s * 0.12} x2={x + s * 0.2} y2={y - s * 0.48} />
          <line x1={x - s * 0.3} y1={y + s * 0.12} x2={x + s * 0.2} y2={y + s * 0.48} />
        </g>
      );
  }
}

/** A cardinal HDG/GS/ALT/TRK readout window. */
function AtlasWindow({
  cx, cy, w, h, value, tag, valueFill, tagFill, surfaceFill, borderStroke, valueFont, tagFont, valueSize, tagSize,
}: {
  cx: number; cy: number; w: number; h: number; value: string; tag: string;
  valueFill: string; tagFill: string; surfaceFill: string; borderStroke: string;
  valueFont: string; tagFont: string; valueSize: number; tagSize: number;
}) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h * 0.22}
        fill={surfaceFill} stroke={borderStroke} strokeWidth={h * 0.05} />
      <text x={cx} y={cy - h * 0.14} fill={tagFill} fontFamily={tagFont} fontSize={tagSize}
        textAnchor="middle" dominantBaseline="middle" style={{ userSelect: "none", letterSpacing: "0.08em" }}>{tag}</text>
      <text x={cx} y={cy + h * 0.2} fill={valueFill} fontFamily={valueFont} fontSize={valueSize}
        textAnchor="middle" dominantBaseline="middle" style={{ userSelect: "none" }}>{value}</text>
    </g>
  );
}

function AtlasBearing({
  activeSector = null,
  standing = null,
  size = 440,
  label,
  className,
  readouts,
  showLayerLabels = false,
}: BearingInstrumentProps) {
  const { role, interpretation } = useRepresentation();

  // Roles — never raw values.
  const surfaceBase = role("surface.base");
  const surfaceRaised = role("surface.raised");
  const borderSubtle = role("border.subtle");
  const inkBody = role("ink.body");
  const inkMuted = role("ink.muted");
  const principal = role("highlight.principal");
  const geometry = role("accent.geometry");
  const titleFont = role("type.title");
  const annotationFont = role("type.annotation");
  const monoFont = role("type.mono");
  const tempo = role("motion.tempo");
  const reveal = role("motion.reveal");
  const transition = `transform ${tempo} ${reveal}, opacity ${tempo} ${reveal}, fill ${tempo} ${reveal}`;

  const S = size;
  const cx = S / 2;
  const cy = S / 2;

  // Radii (fractions of S).
  const rOuter = S * 0.47;
  const rBezelInner = S * 0.40;
  const rTickOuter = S * 0.455;
  const rTickInner = S * 0.425;
  const rBandOuter = S * 0.39;
  const rBandInner = S * 0.305;
  const rTrinityLabel = S * 0.345;
  const rStandingArc = S * 0.365;
  const rStandingLabel = S * 0.435;

  const standingIndex = standing ? STANDING_LEVELS.indexOf(standing) : -1;
  const heading = atlasHeadingDegrees(activeSector);

  // Trinity: three octants across the TOP arc (−158° … −22°), ORDER upper-left,
  // REASONING due-north, ACTION upper-right.
  const trinityArc = { start: -158, end: -22 };
  const trinitySpan = (trinityArc.end - trinityArc.start) / ATLAS_TRINITY.length;
  const trinityGap = 4;

  // Standing ring: four rungs across the BOTTOM arc (left → right = experimental
  // → foundational), lit up to the current standing. REGISTER marker at due-south.
  const standingArc = { start: 158, end: 22 }; // left(158°) → right(22°), clockwise-decreasing
  const standingSpan = (standingArc.start - standingArc.end) / STANDING_LEVELS.length;
  const standingGap = 4;

  // Windows.
  const winW = S * 0.17;
  const winH = S * 0.105;
  const winValueSize = S * 0.05;
  const winTagSize = S * 0.026;

  return (
    <div
      className={className}
      data-interpretation={interpretation.id}
      data-variant="atlas"
      data-active-sector={activeSector ?? "none"}
      data-standing={standing ?? "none"}
      style={{ position: "relative", width: S, height: S, lineHeight: 0 }}
    >
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-label={bearingAriaLabel({ activeSector, standing, label })}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Bezel — the still ring. */}
        <circle cx={cx} cy={cy} r={rOuter} fill={surfaceRaised} stroke={borderSubtle} strokeWidth={S * 0.02} />
        <circle cx={cx} cy={cy} r={rBezelInner} fill={surfaceBase} stroke={borderSubtle} strokeWidth={S * 0.008} />

        {/* Tick ring — a degree tick every 10°, longer every 30°. */}
        {Array.from({ length: 36 }, (_, k) => {
          const deg = -90 + k * 10;
          const major = k % 3 === 0;
          const a = polar(cx, cy, major ? rTickInner - S * 0.012 : rTickInner, deg);
          const b = polar(cx, cy, rTickOuter, deg);
          return (
            <line key={`tick-${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={inkMuted} strokeWidth={major ? S * 0.006 : S * 0.003} opacity={major ? 0.8 : 0.45} />
          );
        })}

        {/* Trinity octants — Order / Reasoning / Action across the top. */}
        {ATLAS_TRINITY.map((sector, i) => {
          const start = trinityArc.start + i * trinitySpan + trinityGap / 2;
          const end = trinityArc.start + (i + 1) * trinitySpan - trinityGap / 2;
          const emphasised = sector === activeSector;
          const mid = (start + end) / 2;
          const lp = polar(cx, cy, rTrinityLabel, mid);
          return (
            <g key={`trinity-${sector}`}>
              <path d={wedgePath(cx, cy, rBandInner, rBandOuter, start, end)}
                fill={role(sectorRole(sector))} stroke={emphasised ? geometry : borderSubtle}
                strokeWidth={emphasised ? S * 0.006 : S * 0.003} opacity={emphasised ? 0.9 : 0.62}
                style={{ transition }} />
              <text x={lp.x} y={lp.y} fill={surfaceRaised} fontFamily={titleFont} fontSize={S * 0.036}
                textAnchor="middle" dominantBaseline="middle"
                style={{ userSelect: "none", letterSpacing: "0.12em", fontWeight: 600 }}>
                {sector.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Standing ring — four rungs across the bottom, lit up to standing. */}
        {STANDING_LEVELS.map((level, j) => {
          const start = standingArc.start - j * standingSpan - standingGap / 2;
          const end = standingArc.start - (j + 1) * standingSpan + standingGap / 2;
          const lit = j <= standingIndex;
          const mid = (start + end) / 2;
          const lp = polar(cx, cy, rStandingLabel, mid);
          return (
            <g key={`standing-${level}`}>
              <path d={arcPath(cx, cy, rStandingArc, end, start)} fill="none"
                stroke={lit ? role(standingRoleName(level)) : borderSubtle}
                strokeWidth={S * 0.018} strokeLinecap="round" opacity={lit ? 1 : 0.4}
                style={{ transition }} />
              <text x={lp.x} y={lp.y} fill={lit ? role(standingRoleName(level)) : inkMuted}
                fontFamily={annotationFont} fontSize={S * 0.022} textAnchor="middle" dominantBaseline="middle"
                opacity={lit ? 1 : 0.7} style={{ userSelect: "none", letterSpacing: "0.06em" }}>
                {level.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* REGISTER marker — the active-standing pointer at due-south. */}
        {(() => {
          const tip = polar(cx, cy, rStandingArc + S * 0.02, 90);
          const base = polar(cx, cy, rStandingArc - S * 0.02, 90);
          const reg = polar(cx, cy, rStandingLabel + S * 0.02, 90);
          return (
            <g>
              <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={principal} strokeWidth={S * 0.01} strokeLinecap="round" />
              <text x={reg.x} y={reg.y} fill={principal} fontFamily={annotationFont} fontSize={S * 0.02}
                textAnchor="middle" dominantBaseline="middle" style={{ userSelect: "none", letterSpacing: "0.14em" }}>
                REGISTER
              </text>
            </g>
          );
        })()}

        {/* Centre poles — Invariant Intelligence / Consequence Engineering. */}
        {ATLAS_POLES.map((pole) => {
          const dx = pole.side === "left" ? -S * 0.135 : S * 0.135;
          const anchor = pole.side === "left" ? "end" : "start";
          const words = pole.label.split(" ");
          return (
            <text key={pole.sector} x={cx + dx} y={cy - S * 0.03} fill={role(sectorRole(pole.sector))}
              fontFamily={annotationFont} fontSize={S * 0.024} textAnchor={anchor as "start" | "end"}
              style={{ userSelect: "none", letterSpacing: "0.05em" }}>
              {words.map((w, wi) => (
                <tspan key={wi} x={cx + dx} dy={wi === 0 ? 0 : S * 0.03}>{w}</tspan>
              ))}
            </text>
          );
        })}

        {/* Needle — orientation to the active sector (rotates to its heading). */}
        {heading !== null && (
          <g transform={`rotate(${heading}, ${cx}, ${cy})`} style={{ transition: `transform ${tempo} ${reveal}` }}>
            <polygon points={`${cx},${cy - S * 0.13} ${cx - S * 0.028},${cy} ${cx + S * 0.028},${cy}`}
              fill={activeSector ? role(sectorRole(activeSector)) : principal} />
            <polygon points={`${cx},${cy + S * 0.055} ${cx - S * 0.028},${cy} ${cx + S * 0.028},${cy}`}
              fill={geometry} opacity={0.4} />
          </g>
        )}
        <circle cx={cx} cy={cy} r={S * 0.02} fill={principal} stroke={surfaceRaised} strokeWidth={S * 0.006} />

        {/* Artefacts gauge — the raised panel with six modality glyphs. */}
        {(() => {
          const gw = S * 0.46;
          const gh = S * 0.10;
          const gx = cx - gw / 2;
          const gy = cy + S * 0.115;
          const n = ATLAS_ARTEFACTS.length;
          const step = gw / n;
          return (
            <g>
              <text x={cx} y={gy - S * 0.028} fill={inkMuted} fontFamily={annotationFont} fontSize={S * 0.022}
                textAnchor="middle" style={{ userSelect: "none", letterSpacing: "0.18em" }}>ARTEFACTS</text>
              <rect x={gx} y={gy} width={gw} height={gh} rx={gh * 0.5} fill={surfaceRaised} stroke={borderSubtle} strokeWidth={S * 0.005} />
              {ATLAS_ARTEFACTS.map((kind, i) => {
                const ix = gx + step * (i + 0.5);
                const iy = gy + gh / 2;
                return (
                  <g key={kind}>
                    <circle cx={ix} cy={iy} r={gh * 0.34} fill="none" stroke={borderSubtle} strokeWidth={S * 0.004} />
                    {atlasArtefactGlyph(kind, ix, iy, gh * 0.19, inkBody)}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* HDG / GS / ALT / TRK windows at the four cardinals. */}
        <AtlasWindow cx={cx} cy={cy - rOuter} w={winW} h={winH}
          tag="HDG" value={heading !== null ? `${heading}°` : "—"}
          valueFill={principal} tagFill={inkMuted} surfaceFill={surfaceRaised} borderStroke={borderSubtle}
          valueFont={monoFont} tagFont={annotationFont} valueSize={winValueSize} tagSize={winTagSize} />
        <AtlasWindow cx={cx - rOuter} cy={cy} w={winW} h={winH}
          tag="GS" value={readouts?.gs ?? "—"}
          valueFill={inkBody} tagFill={inkMuted} surfaceFill={surfaceRaised} borderStroke={borderSubtle}
          valueFont={monoFont} tagFont={annotationFont} valueSize={winValueSize} tagSize={winTagSize} />
        <AtlasWindow cx={cx + rOuter} cy={cy} w={winW} h={winH}
          tag="ALT" value={readouts?.alt ?? "—"}
          valueFill={inkBody} tagFill={inkMuted} surfaceFill={surfaceRaised} borderStroke={borderSubtle}
          valueFont={monoFont} tagFont={annotationFont} valueSize={winValueSize} tagSize={winTagSize} />
        <AtlasWindow cx={cx} cy={cy + rOuter} w={winW} h={winH}
          tag="TRK" value={atlasStandingShort(standing)}
          valueFill={principal} tagFill={inkMuted} surfaceFill={surfaceRaised} borderStroke={borderSubtle}
          valueFont={monoFont} tagFont={annotationFont} valueSize={winValueSize} tagSize={winTagSize} />

        {/* Five constitutional-layer margin labels (optional). */}
        {showLayerLabels && ATLAS_LAYERS.map((layerLabel, i) => {
          const ly = cy - rOuter + (i * (rOuter * 2)) / (ATLAS_LAYERS.length - 1);
          return (
            <text key={`layer-${i}`} x={-S * 0.01} y={ly} fill={inkMuted} fontFamily={annotationFont}
              fontSize={S * 0.018} textAnchor="end" dominantBaseline="middle"
              style={{ userSelect: "none", letterSpacing: "0.06em" }}>{layerLabel}</text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * The Bearing Instrument. Dispatches on `variant`: `compact` (default) is the
 * inline radial dial; `atlas` is Canonical Asset 001 (Bearing Instrument v1.0).
 * A thin dispatcher so neither path calls hooks conditionally.
 */
export function BearingInstrument(props: BearingInstrumentProps) {
  return props.variant === "atlas" ? <AtlasBearing {...props} /> : <CompactBearing {...props} />;
}

export default BearingInstrument;
