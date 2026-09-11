"use client";

/**
 * MetaVitruvian — the composable human (Canonical Asset 002 of the
 * Constitutional Atlas). The PAIR to the Bearing Instrument (Canonical Asset
 * 001): where the Bearing ORIENTS you within the Constitutional Field, the
 * metaVitruvian NAMES the subject the field is drawn around — the human whose
 * identity is not one thing but a bundle of composable primitives (proof of
 * humanity, individuality, uniqueness, standing, delegation, anonymity) that
 * compose into agency in the Agentic Age.
 *
 * It renders a Da Vinci Vitruvian figure — a schematic line-human in the
 * double-spread pose (arms horizontal AND raised, legs together AND spread),
 * inscribed in the Vitruvian circle + square with faint notebook construction
 * lines, a blindfold band across the eyes (privacy / minimum-disclosure), an
 * optional classical temple base (civic authority), and a ring of domain
 * medallions carrying the mobility-stack glyphs (physical, knowledge, social,
 * standing, delegation, civic, jurisdiction, human-potential).
 *
 * This is the canonical LINE primitive — role-driven, not the photorealistic
 * plate (that is a separate interpretation). Every colour and font flows
 * through a representation ROLE resolved via the active interpretation
 * (`useRepresentation().role`); the figure hardcodes NO look. Flip the
 * interpretation and the SAME figure reskins coherently with zero code change:
 * under Constitutional Civic Futurism it reads as an ivory-parchment,
 * charcoal-linework, gold-principal plate; under High-Contrast a high-contrast
 * one. Interpretation-agnostic by construction.
 *
 * SSR-safe: no `window` in render; all geometry is pure deterministic math.
 * The figure is presentational and carries no identifiers.
 */

import React from "react";
import { useRepresentation } from "./RepresentationProvider";
import type { FieldSector, StandingLevel, RepresentationRole } from "@/types/representation";

/** The standing colour role for a level (`foundational` → `standing.foundational`). Pure. */
export function standingRoleName(level: StandingLevel): RepresentationRole {
  return `standing.${level}` as RepresentationRole;
}

// ---------------------------------------------------------------------------
// The composable-identity / mobility-stack domains
// ---------------------------------------------------------------------------

/**
 * The eight domains of the New Mobility Stack — each carried by a medallion in
 * the ring around the figure. These are the axes across which human capability
 * moves once identity is composable. The array order IS the ring order (from due
 * north, clockwise); do not reorder without updating the canary.
 */
export const META_VITRUVIAN_DOMAINS = [
  "mobility",
  "knowledge",
  "social",
  "standing",
  "delegation",
  "civic",
  "jurisdiction",
  "human-potential",
] as const;

export type MetaVitruvianDomain = (typeof META_VITRUVIAN_DOMAINS)[number];

/** The glyph key a domain medallion draws (a minimal recognisable primitive). */
export type DomainGlyphKey =
  | "airplane"
  | "book"
  | "handshake"
  | "scales"
  | "agents"
  | "passport"
  | "globe"
  | "star";

/** Map a domain to its medallion glyph. Pure. */
export function domainGlyphKey(domain: MetaVitruvianDomain): DomainGlyphKey {
  switch (domain) {
    case "mobility":
      return "airplane";
    case "knowledge":
      return "book";
    case "social":
      return "handshake";
    case "standing":
      return "scales";
    case "delegation":
      return "agents";
    case "civic":
      return "passport";
    case "jurisdiction":
      return "globe";
    case "human-potential":
    default:
      return "star";
  }
}

/**
 * Map a domain to the colour ROLE that tints its lit medallion. Seven domains
 * borrow a Constitutional Field sector hue (so the figure's ring speaks the same
 * colour vocabulary as the Bearing Instrument); human-potential borrows the
 * reserved principal emphasis (the gold star — the expansion of what we can
 * become). Pure — returns a role key, never a raw value.
 */
export function domainRole(domain: MetaVitruvianDomain): RepresentationRole {
  switch (domain) {
    case "mobility":
      return "field.action";
    case "knowledge":
      return "field.knowledge";
    case "social":
      return "field.experience";
    case "standing":
      return "field.order";
    case "delegation":
      return "field.intelligence";
    case "civic":
      return "field.reasoning";
    case "jurisdiction":
      return "field.consequence";
    case "human-potential":
    default:
      return "highlight.principal";
  }
}

/** Human-facing label for a domain token (`human-potential` → `Human Potential`). Pure. */
export function domainLabel(domain: MetaVitruvianDomain): string {
  return domain
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Capitalise a standing/word token. Pure. */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Pure geometry helpers — no React, no `window`; node-drillable in isolation.
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

/** Polar → cartesian around a centre (SVG convention: 0°=east, +ve clockwise). Pure. */
export function polar(cx: number, cy: number, r: number, angleDeg: number): Point {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * The Vitruvian construction — the circle and the square the figure is inscribed
 * in, centred in a `size × size` box. The circle bounds the spread pose; the
 * square footprint bounds the closed (standing) pose. Deterministic — the same
 * `size` always yields the same geometry (SSR-safe). Pure.
 */
export function inscribeGeometry(size: number): {
  cx: number;
  cy: number;
  r: number;
  square: { x: number; y: number; side: number };
} {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const side = r * 1.64; // closed-pose footprint — fingertips + feet touch its edges
  return { cx, cy, r, square: { x: cx - side / 2, y: cy - side / 2, side } };
}

export interface VitruvianPose {
  cx: number;
  cy: number;
  r: number;
  head: { cx: number; cy: number; r: number };
  neck: Point;
  shoulderL: Point;
  shoulderR: Point;
  hip: Point;
  hipL: Point;
  hipR: Point;
  /** [left hand, right hand] with arms held horizontal (the cross pose). */
  armsHorizontal: [Point, Point];
  /** [left hand, right hand] with arms raised onto the circle (the spread pose). */
  armsRaised: [Point, Point];
  /** [left foot, right foot] with legs together (the standing pose). */
  legsTogether: [Point, Point];
  /** [left foot, right foot] with legs spread onto the circle (the spread pose). */
  legsSpread: [Point, Point];
}

/**
 * The double-spread pose — the OVERLAID Vitruvian positions. Arms are given both
 * horizontal AND raised endpoints; legs both together AND spread. Rendering both
 * is what produces Leonardo's superimposed figure. All endpoints derive from the
 * inscribe geometry (spread limbs land ON the circle; closed limbs land at the
 * square edges), so the pose is deterministic and honestly Vitruvian. Pure.
 */
export function vitruvianPose(size: number): VitruvianPose {
  const { cx, cy, r } = inscribeGeometry(size);
  const P = (x: number, y: number): Point => ({ x, y });

  const shoulderY = cy - r * 0.52;
  const shoulderDX = r * 0.24;
  const hipY = cy + r * 0.06;
  const hipDX = r * 0.14;

  const head = { cx, cy: cy - r * 0.76, r: r * 0.16 };
  const neck = P(cx, cy - r * 0.6);
  const shoulderL = P(cx - shoulderDX, shoulderY);
  const shoulderR = P(cx + shoulderDX, shoulderY);
  const hip = P(cx, hipY);
  const hipL = P(cx - hipDX, hipY);
  const hipR = P(cx + hipDX, hipY);

  // Arms horizontal — hands out at shoulder height, touching the square edges.
  const armSpan = r * 0.92;
  const armsHorizontal: [Point, Point] = [
    P(cx - armSpan, shoulderY),
    P(cx + armSpan, shoulderY),
  ];
  // Arms raised — hands up ON the circle (upper-left / upper-right).
  const armsRaised: [Point, Point] = [polar(cx, cy, r, -150), polar(cx, cy, r, -30)];

  // Legs together — feet at the base of the square, near centre.
  const footY = cy + r * 0.96;
  const legsTogether: [Point, Point] = [P(cx - r * 0.1, footY), P(cx + r * 0.1, footY)];
  // Legs spread — feet out ON the circle (lower-left / lower-right).
  const legsSpread: [Point, Point] = [polar(cx, cy, r, 125), polar(cx, cy, r, 55)];

  return {
    cx,
    cy,
    r,
    head,
    neck,
    shoulderL,
    shoulderR,
    hip,
    hipL,
    hipR,
    armsHorizontal,
    armsRaised,
    legsTogether,
    legsSpread,
  };
}

export interface Medallion {
  index: number;
  angle: number;
  x: number;
  y: number;
  r: number;
}

/**
 * The ring of medallion centres around the figure — `count` badges spaced evenly,
 * medallion 0 at due north (`startDeg = -90`), clockwise. Radius sits outside the
 * Vitruvian circle so the medallions frame the figure. Deterministic. Pure.
 */
export function medallionRingPositions(
  count: number,
  size: number,
  startDeg: number = -90,
): Medallion[] {
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.44;
  const medR = size * 0.05;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const angle = startDeg + (i * 360) / count;
    const p = polar(cx, cy, ringR, angle);
    return { index: i, angle, x: p.x, y: p.y, r: medR };
  });
}

/**
 * The figure's accessible description — names the subject, its standing, and the
 * lit domains so a screen reader announces the composition, exactly as a sighted
 * reader reads the medallion ring. Pure.
 */
export function metaVitruvianAriaLabel(opts: {
  standing?: StandingLevel | null;
  domains?: MetaVitruvianDomain[];
  label?: string;
}): string {
  const subject = opts.label ? `${opts.label} — metaVitruvian` : "metaVitruvian";
  const stand = opts.standing ? `, standing ${titleCase(opts.standing)}` : "";
  const lit = opts.domains && opts.domains.length ? opts.domains : null;
  const doms = lit ? `; domains ${lit.map(domainLabel).join(", ")}` : "";
  return `${subject}: the composable human inscribed in circle and square${stand}${doms}`;
}

// ---------------------------------------------------------------------------
// Minimal domain glyphs — recognisable primitives in the same voice as the
// Bearing Instrument's artefact glyphs (ported / adapted). Stroked, not detailed.
// ---------------------------------------------------------------------------

function domainGlyph(
  kind: DomainGlyphKey,
  x: number,
  y: number,
  s: number,
  stroke: string,
): React.ReactNode {
  const sw = Math.max(s * 0.14, 0.6);
  const common = {
    fill: "none",
    stroke,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "airplane":
      return (
        <g {...common}>
          <path d={`M ${x - s * 0.7} ${y} L ${x + s * 0.7} ${y}`} />
          <path d={`M ${x - s * 0.15} ${y - s * 0.6} L ${x + s * 0.15} ${y} L ${x - s * 0.15} ${y + s * 0.6}`} />
          <path d={`M ${x + s * 0.45} ${y - s * 0.35} L ${x + s * 0.7} ${y} L ${x + s * 0.45} ${y + s * 0.35}`} />
        </g>
      );
    case "book":
      return (
        <g {...common}>
          <path d={`M ${x} ${y - s * 0.55} L ${x} ${y + s * 0.55}`} />
          <path
            d={`M ${x} ${y - s * 0.5} C ${x - s * 0.4} ${y - s * 0.75}, ${x - s * 0.8} ${y - s * 0.6}, ${x - s * 0.8} ${y - s * 0.35} L ${x - s * 0.8} ${y + s * 0.55} C ${x - s * 0.8} ${y + s * 0.35}, ${x - s * 0.4} ${y + s * 0.3}, ${x} ${y + s * 0.5}`}
          />
          <path
            d={`M ${x} ${y - s * 0.5} C ${x + s * 0.4} ${y - s * 0.75}, ${x + s * 0.8} ${y - s * 0.6}, ${x + s * 0.8} ${y - s * 0.35} L ${x + s * 0.8} ${y + s * 0.55} C ${x + s * 0.8} ${y + s * 0.35}, ${x + s * 0.4} ${y + s * 0.3}, ${x} ${y + s * 0.5}`}
          />
        </g>
      );
    case "handshake":
      return (
        <g {...common}>
          <path d={`M ${x - s * 0.85} ${y - s * 0.15} L ${x - s * 0.25} ${y - s * 0.15} L ${x} ${y + s * 0.1} L ${x + s * 0.25} ${y - s * 0.15} L ${x + s * 0.85} ${y - s * 0.15}`} />
          <path d={`M ${x - s * 0.25} ${y - s * 0.15} L ${x - s * 0.05} ${y + s * 0.35}`} />
          <path d={`M ${x + s * 0.25} ${y - s * 0.15} L ${x + s * 0.05} ${y + s * 0.35}`} />
        </g>
      );
    case "scales":
      return (
        <g {...common}>
          <path d={`M ${x} ${y - s * 0.7} L ${x} ${y + s * 0.7}`} />
          <path d={`M ${x - s * 0.7} ${y - s * 0.45} L ${x + s * 0.7} ${y - s * 0.45}`} />
          <path d={`M ${x - s * 0.7} ${y - s * 0.45} L ${x - s * 0.95} ${y + s * 0.1} L ${x - s * 0.45} ${y + s * 0.1} Z`} />
          <path d={`M ${x + s * 0.7} ${y - s * 0.45} L ${x + s * 0.45} ${y + s * 0.1} L ${x + s * 0.95} ${y + s * 0.1} Z`} />
          <path d={`M ${x - s * 0.35} ${y + s * 0.7} L ${x + s * 0.35} ${y + s * 0.7}`} />
        </g>
      );
    case "agents":
      return (
        <g {...common}>
          <circle cx={x - s * 0.45} cy={y - s * 0.35} r={s * 0.28} />
          <path d={`M ${x - s * 0.85} ${y + s * 0.6} C ${x - s * 0.85} ${y + s * 0.1}, ${x - s * 0.05} ${y + s * 0.1}, ${x - s * 0.05} ${y + s * 0.6}`} />
          <circle cx={x + s * 0.45} cy={y - s * 0.35} r={s * 0.28} />
          <path d={`M ${x + s * 0.05} ${y + s * 0.6} C ${x + s * 0.05} ${y + s * 0.1}, ${x + s * 0.85} ${y + s * 0.1}, ${x + s * 0.85} ${y + s * 0.6}`} />
        </g>
      );
    case "passport":
      return (
        <g {...common}>
          <rect x={x - s * 0.55} y={y - s * 0.75} width={s * 1.1} height={s * 1.5} rx={s * 0.12} />
          <circle cx={x} cy={y - s * 0.12} r={s * 0.26} />
          <path d={`M ${x - s * 0.3} ${y + s * 0.42} L ${x + s * 0.3} ${y + s * 0.42}`} />
        </g>
      );
    case "globe":
      return (
        <g {...common}>
          <circle cx={x} cy={y} r={s * 0.75} />
          <ellipse cx={x} cy={y} rx={s * 0.32} ry={s * 0.75} />
          <path d={`M ${x - s * 0.75} ${y} L ${x + s * 0.75} ${y}`} />
          <path d={`M ${x - s * 0.62} ${y - s * 0.42} L ${x + s * 0.62} ${y - s * 0.42}`} />
          <path d={`M ${x - s * 0.62} ${y + s * 0.42} L ${x + s * 0.62} ${y + s * 0.42}`} />
        </g>
      );
    case "star":
    default: {
      const pts = Array.from({ length: 10 }, (_, k) => {
        const rr = k % 2 === 0 ? s * 0.8 : s * 0.34;
        const a = (-90 + k * 36) * (Math.PI / 180);
        return `${x + rr * Math.cos(a)} ${y + rr * Math.sin(a)}`;
      }).join(" L ");
      return (
        <g {...common}>
          <path d={`M ${pts} Z`} />
        </g>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export interface MetaVitruvianProps {
  /** Pixel size of the square figure. */
  size?: number;
  /** How mature the subject is — tints the inscribe frame + ring via standing roles. */
  standing?: StandingLevel | null;
  /** Which mobility-stack domains are lit / emphasised in the medallion ring. */
  domains?: MetaVitruvianDomain[];
  /** Draw the faint notebook construction lines (diagonals, axes, guide arcs). */
  showConstructionLines?: boolean;
  /** Draw the classical temple base behind the figure (civic authority). */
  showTemple?: boolean;
  /** The subject being represented — folded into the aria-label. */
  label?: string;
  className?: string;
  /**
   * Rendering fidelity. `atlas` (default) is Canonical Asset 002 — the full
   * plate (circle + square, double-pose figure, blindfold, temple, medallion
   * ring). `compact` drops the temple + construction lines for an inline mark.
   * Same roles either way; the variant just selects the anatomy rendered.
   */
  variant?: "atlas" | "compact";
}

function MetaVitruvianFigure({
  size = 440,
  standing = null,
  domains = [],
  showConstructionLines = true,
  showTemple = true,
  label,
  className,
  variant = "atlas",
}: MetaVitruvianProps) {
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
  const tempo = role("motion.tempo");
  const reveal = role("motion.reveal");
  const transition = `stroke ${tempo} ${reveal}, opacity ${tempo} ${reveal}`;

  // Standing tints the inscribe frame + medallion ring; unset falls to geometry.
  const frameStroke = standing ? role(standingRoleName(standing)) : geometry;

  const S = size;
  const compact = variant === "compact";
  const drawConstruction = showConstructionLines && !compact;
  const drawTemple = showTemple && !compact;

  // Geometry (pure, deterministic — SSR-safe).
  const geo = inscribeGeometry(S);
  const pose = vitruvianPose(S);
  const litDomains = new Set(domains);
  const medallions = medallionRingPositions(META_VITRUVIAN_DOMAINS.length, S);

  const figureStrokeW = S * 0.006;
  const limbStrokeW = S * 0.0055;

  const L = (a: Point, b: Point, key: string, strokeW = limbStrokeW, opacity = 1) => (
    <line
      key={key}
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={inkBody}
      strokeWidth={strokeW}
      strokeLinecap="round"
      opacity={opacity}
      style={{ transition }}
    />
  );

  return (
    <div
      className={className}
      data-interpretation={interpretation.id}
      data-variant={variant}
      data-standing={standing ?? "none"}
      data-domains={domains.length ? domains.join(",") : "none"}
      style={{ position: "relative", width: S, height: S, lineHeight: 0 }}
    >
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-label={metaVitruvianAriaLabel({ standing, domains, label })}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Parchment ground. */}
        <rect x={0} y={0} width={S} height={S} fill={surfaceBase} opacity={0.0} />

        {/* Construction lines — faint notebook geometry: diagonals, axes, guide
            circle. Discovered rather than noticed. */}
        {drawConstruction && (
          <g stroke={geometry} strokeWidth={S * 0.0022} opacity={0.28} fill="none">
            <line x1={geo.cx} y1={geo.cy - geo.r} x2={geo.cx} y2={geo.cy + geo.r} />
            <line x1={geo.cx - geo.r} y1={geo.cy} x2={geo.cx + geo.r} y2={geo.cy} />
            <line
              x1={geo.square.x}
              y1={geo.square.y}
              x2={geo.square.x + geo.square.side}
              y2={geo.square.y + geo.square.side}
            />
            <line
              x1={geo.square.x + geo.square.side}
              y1={geo.square.y}
              x2={geo.square.x}
              y2={geo.square.y + geo.square.side}
            />
            <circle cx={geo.cx} cy={geo.cy} r={geo.r * 0.5} />
          </g>
        )}

        {/* Classical temple base — pediment + columns, behind/below the figure. */}
        {drawTemple &&
          (() => {
            const baseY = geo.cy + geo.r * 0.72;
            const tW = geo.r * 1.5;
            const tX = geo.cx - tW / 2;
            const colTop = baseY - geo.r * 0.62;
            const pedY = colTop - geo.r * 0.02;
            const nCols = 4;
            const step = tW / (nCols - 1);
            return (
              <g stroke={inkMuted} strokeWidth={S * 0.004} fill="none" opacity={0.4}>
                {/* Pediment (triangle). */}
                <path
                  d={`M ${tX - geo.r * 0.06} ${pedY} L ${geo.cx} ${pedY - geo.r * 0.3} L ${tX + tW + geo.r * 0.06} ${pedY} Z`}
                />
                {/* Architrave. */}
                <line x1={tX - geo.r * 0.06} y1={colTop} x2={tX + tW + geo.r * 0.06} y2={colTop} />
                {/* Stylobate (base steps). */}
                <line x1={tX - geo.r * 0.1} y1={baseY} x2={tX + tW + geo.r * 0.1} y2={baseY} />
                <line x1={tX - geo.r * 0.16} y1={baseY + geo.r * 0.05} x2={tX + tW + geo.r * 0.16} y2={baseY + geo.r * 0.05} />
                {/* Columns. */}
                {Array.from({ length: nCols }, (_, k) => {
                  const colX = tX + k * step;
                  return <line key={`col-${k}`} x1={colX} y1={colTop} x2={colX} y2={baseY} />;
                })}
              </g>
            );
          })()}

        {/* The Vitruvian frame — the circle + square the figure is inscribed in.
            Tinted by standing (or the geometry accent when unset). */}
        <rect
          x={geo.square.x}
          y={geo.square.y}
          width={geo.square.side}
          height={geo.square.side}
          fill="none"
          stroke={frameStroke}
          strokeWidth={S * 0.004}
          opacity={0.8}
          style={{ transition }}
        />
        <circle
          cx={geo.cx}
          cy={geo.cy}
          r={geo.r}
          fill="none"
          stroke={frameStroke}
          strokeWidth={S * 0.004}
          opacity={0.8}
          style={{ transition }}
        />

        {/* The figure — schematic line-human in the double-spread pose. */}
        <g>
          {/* Head. */}
          <circle
            cx={pose.head.cx}
            cy={pose.head.cy}
            r={pose.head.r}
            fill="none"
            stroke={inkBody}
            strokeWidth={figureStrokeW}
          />
          {/* Neck + spine. */}
          {L(pose.neck, pose.hip, "spine", figureStrokeW)}
          {/* Shoulders + hips. */}
          {L(pose.shoulderL, pose.shoulderR, "shoulders", figureStrokeW)}
          {L(pose.hipL, pose.hipR, "hips", figureStrokeW)}

          {/* Arms — both poses overlaid (horizontal + raised). */}
          {L(pose.shoulderL, pose.armsHorizontal[0], "arm-h-l")}
          {L(pose.shoulderR, pose.armsHorizontal[1], "arm-h-r")}
          {L(pose.shoulderL, pose.armsRaised[0], "arm-r-l")}
          {L(pose.shoulderR, pose.armsRaised[1], "arm-r-r")}

          {/* Legs — both poses overlaid (together + spread). */}
          {L(pose.hipL, pose.legsTogether[0], "leg-t-l")}
          {L(pose.hipR, pose.legsTogether[1], "leg-t-r")}
          {L(pose.hipL, pose.legsSpread[0], "leg-s-l")}
          {L(pose.hipR, pose.legsSpread[1], "leg-s-r")}

          {/* Hands + feet — small nodes where the limbs touch circle / square. */}
          {[
            pose.armsHorizontal[0],
            pose.armsHorizontal[1],
            pose.armsRaised[0],
            pose.armsRaised[1],
            pose.legsSpread[0],
            pose.legsSpread[1],
          ].map((p, i) => (
            <circle key={`node-${i}`} cx={p.x} cy={p.y} r={S * 0.006} fill={inkBody} />
          ))}

          {/* Blindfold band — privacy / minimum-disclosure across the eyes. */}
          <rect
            x={pose.head.cx - pose.head.r * 1.05}
            y={pose.head.cy - pose.head.r * 0.28}
            width={pose.head.r * 2.1}
            height={pose.head.r * 0.5}
            rx={pose.head.r * 0.12}
            fill={inkBody}
          />

          {/* Chest compass-star — the metaMe heart-mark. The human carries the
              constitutional compass (the Bearing Instrument's motif) at their
              centre: identity is oriented from within. Gold (highlight.principal
              — the reserved figure). Canonical detail from the standalone
              metaVitruvian reference. */}
          {(() => {
            const chestY = pose.neck.y + (pose.hip.y - pose.neck.y) * 0.34;
            const cr = S * 0.03;
            const star = Array.from({ length: 8 }, (_, i) => {
              const ang = -90 + i * 45;
              const len = i % 2 === 0 ? cr * 0.92 : cr * 0.42;
              return polar(pose.cx, chestY, len, ang);
            });
            return (
              <g style={{ transition }}>
                <circle cx={pose.cx} cy={chestY} r={cr} fill="none" stroke={principal} strokeWidth={S * 0.004} />
                <polygon
                  points={star.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={principal}
                  opacity={0.9}
                />
                <circle cx={pose.cx} cy={chestY} r={cr * 0.16} fill={surfaceRaised} stroke={principal} strokeWidth={S * 0.0025} />
              </g>
            );
          })()}
        </g>

        {/* Medallion ring — the mobility-stack domains framing the figure. */}
        {medallions.map((m) => {
          const domain = META_VITRUVIAN_DOMAINS[m.index];
          const lit = litDomains.size === 0 ? true : litDomains.has(domain);
          const tint = lit ? role(domainRole(domain)) : borderSubtle;
          return (
            <g key={`med-${domain}`} style={{ transition }} opacity={lit ? 1 : 0.5}>
              <circle
                cx={m.x}
                cy={m.y}
                r={m.r}
                fill={surfaceRaised}
                stroke={tint}
                strokeWidth={S * 0.005}
              />
              <circle cx={m.x} cy={m.y} r={m.r * 0.82} fill="none" stroke={tint} strokeWidth={S * 0.0025} opacity={0.5} />
              {domainGlyph(domainGlyphKey(domain), m.x, m.y, m.r * 0.5, tint)}
            </g>
          );
        })}

        {/* Title — the plate caption, in the serif title voice. */}
        {!compact && label && (
          <text
            x={geo.cx}
            y={S * 0.97}
            fill={inkBody}
            fontFamily={titleFont}
            fontSize={S * 0.038}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ userSelect: "none", letterSpacing: "0.04em" }}
          >
            {label}
          </text>
        )}

        {/* Principal register — a faint gold reference mark at the navel/centre,
            the still point the composition turns around (used sparingly). */}
        <circle cx={geo.cx} cy={geo.cy} r={S * 0.008} fill={principal} />
      </svg>
    </div>
  );
}

/**
 * MetaVitruvian — Canonical Asset 002. A thin dispatcher on `variant` so neither
 * path calls hooks conditionally; `atlas` (default) renders the full plate,
 * `compact` the inline mark.
 */
export function MetaVitruvian(props: MetaVitruvianProps) {
  return <MetaVitruvianFigure {...props} />;
}

export default MetaVitruvian;

// Re-export the FieldSector type touchpoint for consumers pairing this with the
// Bearing Instrument (the ring hues borrow the field vocabulary).
export type { FieldSector };
