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
}

export function BearingInstrument({
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

export default BearingInstrument;
