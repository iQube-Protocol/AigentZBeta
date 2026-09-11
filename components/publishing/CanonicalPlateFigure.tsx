"use client";

/**
 * CanonicalPlateFigure — R1 of the CPS rendering layer (CFS-026 §rendering,
 * CFS-027). Renders a Canonical Plate as an SVG ENGINEERING DRAWING from its
 * encoded structure (`CANONICAL_PLATES_V1` — the same data registered in the
 * Canonical Asset Registry), so the drawing can never diverge from the ontology.
 *
 * Register: NASA / Bell Labs / IBM Systems Journal / Da Vinci notebook —
 * hairline strokes, boxes/rings/stacks/flows, numbered figure block, corner
 * registration ticks. No decoration; everything drawn is information.
 *
 * One renderer per PlateForm: branch · radial · circle · stack · flow.
 * Pure SVG (vector, reusable in papers/decks/Studio); no clock, no randomness.
 *
 * PALETTE NOTE: these are the CPS PUBLICATION inks (ivory/navy/gold manuscript
 * register, CFS-026 CPS_VISUAL) — a publication figure, not app chrome. The
 * slate house style governs panels/chrome and stays untouched; the inks live in
 * ONE named token object here (no scattered literals).
 */

import React from "react";
import type { CanonicalPlate } from "@/services/artifact/canonicalPlates";

/** The CPS manuscript inks — single source, CFS-026 palette (ivory·navy·gold·charcoal). */
export const CPS_INK = {
  paper: "#faf7f0", // ivory / paper-white
  line: "#8a7a5c", // drafting hairline (muted gold-brown)
  ink: "#1e3a5f", // navy — primary ink
  accent: "#a08444", // restrained gold
  muted: "#6b6255", // caption/annotation ink
} as const;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Arial, sans-serif";

interface NodeBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  emphasis?: boolean;
}

function NodeBox({ x, y, w, h, label, emphasis }: NodeBoxProps) {
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        fill={emphasis ? CPS_INK.ink : CPS_INK.paper}
        stroke={emphasis ? CPS_INK.ink : CPS_INK.line}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={11}
        letterSpacing={0.8}
        fill={emphasis ? CPS_INK.paper : CPS_INK.ink}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

/** A titled list panel (used for invariant families and long groups). */
function ListPanel({ x, y, w, title, items }: { x: number; y: number; w: number; title: string; items: readonly string[] }) {
  const rowH = 17;
  const h = 30 + items.length * rowH + 8;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={h} fill={CPS_INK.paper} stroke={CPS_INK.line} strokeWidth={1} />
      <text x={x} y={y + 19} textAnchor="middle" fontFamily={SANS} fontSize={10.5} letterSpacing={1.2} fill={CPS_INK.accent}>
        {title.toUpperCase()}
      </text>
      <line x1={x - w / 2 + 12} y1={y + 26} x2={x + w / 2 - 12} y2={y + 26} stroke={CPS_INK.line} strokeWidth={0.6} />
      {items.map((it, i) => (
        <text key={it} x={x} y={y + 42 + i * rowH} textAnchor="middle" fontFamily={SANS} fontSize={10.5} fill={CPS_INK.ink}>
          {it}
        </text>
      ))}
    </g>
  );
}

function VArrow({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g stroke={CPS_INK.line} strokeWidth={1} fill={CPS_INK.line}>
      <line x1={x} y1={y1} x2={x} y2={y2 - 5} />
      <polygon points={`${x - 3.5},${y2 - 6} ${x + 3.5},${y2 - 6} ${x},${y2}`} />
    </g>
  );
}

/** Split a structure into ordered [key, value] tiers. */
function tiersOf(plate: CanonicalPlate): Array<[string, string | readonly string[]]> {
  return Object.entries(plate.structure) as Array<[string, string | readonly string[]]>;
}

const humanize = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/-/g, " ").trim();

// ── Form renderers (viewBox width 800; height varies per form) ──────────────

function BranchForm({ plate }: { plate: CanonicalPlate }) {
  const cx = 400;
  const tiers = tiersOf(plate);
  let y = 56;
  const parts: React.ReactNode[] = [];
  let prevY: number | null = null;
  for (const [key, value] of tiers) {
    if (typeof value === "string") {
      if (prevY !== null) parts.push(<VArrow key={`a-${key}`} x={cx} y1={prevY} y2={y - 14} />);
      parts.push(<NodeBox key={key} x={cx} y={y} w={280} h={30} label={value} emphasis={key === "root" || key === "object"} />);
      prevY = y + 15;
      y += 62;
    } else if (value.length <= 3) {
      // small array — a row of nodes
      const gap = 230;
      const x0 = cx - ((value.length - 1) * gap) / 2;
      if (prevY !== null) {
        value.forEach((_, i) => parts.push(<line key={`l-${key}-${i}`} x1={cx} y1={prevY as number} x2={x0 + i * gap} y2={y - 15} stroke={CPS_INK.line} strokeWidth={1} />));
      }
      value.forEach((v, i) => parts.push(<NodeBox key={`${key}-${v}`} x={x0 + i * gap} y={y} w={200} h={30} label={v} />));
      prevY = y + 15;
      y += 62;
    } else {
      // long array — a titled list panel; two long arrays side-by-side handled by columns
      const longArrays = tiers.filter(([, v]) => Array.isArray(v) && v.length > 3);
      const idx = longArrays.findIndex(([k]) => k === key);
      const cols = longArrays.length;
      const colX = cols > 1 ? cx - 190 + idx * 380 : cx;
      if (prevY !== null) parts.push(<line key={`l-${key}`} x1={cx} y1={prevY} x2={colX} y2={y} stroke={CPS_INK.line} strokeWidth={1} />);
      parts.push(<ListPanel key={key} x={colX} y={y} w={300} title={humanize(key)} items={value} />);
      // advance y only after the LAST long column
      if (idx === cols - 1) {
        const maxLen = Math.max(...longArrays.map(([, v]) => (v as readonly string[]).length));
        prevY = y + 38 + maxLen * 17;
        y = (prevY as number) + 46;
      }
    }
  }
  return <g>{parts}</g>;
}

function RadialForm({ plate }: { plate: CanonicalPlate }) {
  const tiers = tiersOf(plate);
  const centre = (tiers.find(([, v]) => typeof v === "string")?.[1] as string) ?? plate.title;
  const ring = (tiers.find(([, v]) => Array.isArray(v))?.[1] as readonly string[]) ?? [];
  const cx = 400;
  const cy = 300;
  const R = 190;
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={CPS_INK.line} strokeWidth={0.7} strokeDasharray="3 4" />
      {ring.map((label, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length;
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);
        return (
          <g key={label}>
            <line x1={cx + 62 * Math.cos(a)} y1={cy + 62 * Math.sin(a)} x2={x - 0} y2={y} stroke={CPS_INK.line} strokeWidth={0.8} />
            <NodeBox x={x} y={y} w={168} h={28} label={label} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={58} fill={CPS_INK.ink} stroke={CPS_INK.accent} strokeWidth={1.5} />
      {centre.split(" ").map((word, i, arr) => (
        <text key={word} x={cx} y={cy + (i - (arr.length - 1) / 2) * 15 + 4} textAnchor="middle" fontFamily={SANS} fontSize={12} letterSpacing={1} fill={CPS_INK.paper}>
          {word.toUpperCase()}
        </text>
      ))}
    </g>
  );
}

function CircleForm({ plate }: { plate: CanonicalPlate }) {
  const cycle = (tiersOf(plate).find(([, v]) => Array.isArray(v))?.[1] as readonly string[]) ?? [];
  const cx = 400;
  const cy = 300;
  const R = 195;
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={CPS_INK.line} strokeWidth={0.9} />
      {cycle.map((label, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / cycle.length;
        const mid = a + Math.PI / cycle.length; // arrow midway to next node
        return (
          <g key={label}>
            <NodeBox x={cx + R * Math.cos(a)} y={cy + R * Math.sin(a)} w={158} h={28} label={label} />
            <polygon
              points="0,-4 7,0 0,4"
              transform={`translate(${cx + R * Math.cos(mid)}, ${cy + R * Math.sin(mid)}) rotate(${(mid * 180) / Math.PI + 90})`}
              fill={CPS_INK.accent}
            />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={3} fill={CPS_INK.accent} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontFamily={SERIF} fontSize={11} fontStyle="italic" fill={CPS_INK.muted}>
        a circle, not a pipeline
      </text>
    </g>
  );
}

function StackForm({ plate }: { plate: CanonicalPlate }) {
  const layers = (tiersOf(plate).find(([, v]) => Array.isArray(v))?.[1] as readonly string[]) ?? [];
  const cx = 400;
  const w = 380;
  const h = 40;
  return (
    <g>
      {layers.map((label, i) => (
        <g key={label}>
          <rect x={cx - w / 2} y={56 + i * (h + 8)} width={w} height={h} fill={i === 0 ? CPS_INK.paper : CPS_INK.paper} stroke={CPS_INK.line} strokeWidth={1} />
          <text x={cx} y={56 + i * (h + 8) + h / 2 + 4} textAnchor="middle" fontFamily={SANS} fontSize={11.5} letterSpacing={1} fill={CPS_INK.ink}>
            {label.toUpperCase()}
          </text>
          <text x={cx - w / 2 - 16} y={56 + i * (h + 8) + h / 2 + 3.5} textAnchor="end" fontFamily={SANS} fontSize={9} fill={CPS_INK.muted}>
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

function FlowForm({ plate }: { plate: CanonicalPlate }) {
  const tiers = tiersOf(plate);
  const header = tiers.find(([, v]) => typeof v === "string")?.[1] as string | undefined;
  const arrays = tiers.filter(([, v]) => Array.isArray(v)) as Array<[string, readonly string[]]>;
  const main = arrays[0]?.[1] ?? [];
  const side = arrays[1]?.[1];
  const cx = side ? 320 : 400;
  let y = 56;
  const parts: React.ReactNode[] = [];
  if (header) {
    parts.push(<NodeBox key="hdr" x={cx} y={y} w={260} h={32} label={header} emphasis />);
    y += 58;
  }
  const step = 52;
  main.forEach((label, i) => {
    if (i > 0 || header) parts.push(<VArrow key={`a${i}`} x={cx} y1={y - (i === 0 && header ? 42 : 37)} y2={y - 16} />);
    parts.push(<NodeBox key={label} x={cx} y={y} w={280} h={30} label={label} />);
    y += step;
  });
  // closed-loop return line (institution/discovery cycles read as loops)
  parts.push(
    <path
      key="loop"
      d={`M ${cx + 150} ${y - step} C ${cx + 235} ${y - step}, ${cx + 235} ${header ? 56 : 56}, ${cx + 150} ${header ? 56 : 56}`}
      fill="none"
      stroke={CPS_INK.line}
      strokeWidth={0.8}
      strokeDasharray="4 4"
    />,
  );
  if (side) {
    const x = 640;
    side.forEach((label, i) => {
      const sy = 120 + i * ((y - 160) / Math.max(1, side.length - 1));
      parts.push(
        <g key={`s-${label}`}>
          <text x={x} y={sy} textAnchor="middle" fontFamily={SERIF} fontSize={12} fontStyle="italic" fill={CPS_INK.accent}>
            {label}
          </text>
          <text x={x} y={sy + 14} textAnchor="middle" fontFamily={SANS} fontSize={9} letterSpacing={1} fill={CPS_INK.muted}>
            CONTRIBUTES HERE
          </text>
        </g>,
      );
    });
  }
  return <g>{parts}</g>;
}

const FORM_HEIGHT: Record<CanonicalPlate["form"], number> = {
  branch: 560,
  radial: 600,
  circle: 600,
  stack: 460,
  flow: 560,
};

const FORM_RENDERER: Record<CanonicalPlate["form"], (p: { plate: CanonicalPlate }) => React.ReactElement> = {
  branch: BranchForm,
  radial: RadialForm,
  circle: CircleForm,
  stack: StackForm,
  flow: FlowForm,
};

/** Corner registration ticks — drafting-sheet chrome (useful, not decorative). */
function RegistrationMarks({ w, h }: { w: number; h: number }) {
  const m = 10;
  const t = 12;
  const corners = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ] as const;
  return (
    <g stroke={CPS_INK.line} strokeWidth={0.7}>
      {corners.map(([x, y, dx, dy], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x + dx * t} y2={y} />
          <line x1={x} y1={y} x2={x} y2={y + dy * t} />
        </g>
      ))}
    </g>
  );
}

export interface CanonicalPlateFigureProps {
  plate: CanonicalPlate;
  /** Rendered width (SVG scales); default 800. */
  width?: number | string;
}

export default function CanonicalPlateFigure({ plate, width = "100%" }: CanonicalPlateFigureProps) {
  const Form = FORM_RENDERER[plate.form];
  const bodyH = FORM_HEIGHT[plate.form];
  const H = bodyH + 96; // header + caption chrome
  return (
    <svg viewBox={`0 0 800 ${H}`} width={width} role="img" aria-label={`${plate.number} — ${plate.title}`} style={{ background: CPS_INK.paper, display: "block" }}>
      <rect x={4} y={4} width={792} height={H - 8} fill="none" stroke={CPS_INK.line} strokeWidth={0.9} />
      <RegistrationMarks w={800} h={H} />
      {/* Figure block */}
      <text x={26} y={34} fontFamily={SANS} fontSize={10} letterSpacing={2} fill={CPS_INK.accent}>
        {`PLATE ${plate.roman} · ${plate.number}`.toUpperCase()}
      </text>
      {plate.signature && (
        <text x={774} y={34} textAnchor="end" fontFamily={SANS} fontSize={10} letterSpacing={1.5} fill={CPS_INK.accent}>
          SIGNATURE PLATE
        </text>
      )}
      <text x={400} y={58} textAnchor="middle" fontFamily={SERIF} fontSize={20} fill={CPS_INK.ink}>
        {plate.title}
      </text>
      <line x1={330} y1={68} x2={470} y2={68} stroke={CPS_INK.accent} strokeWidth={0.8} />
      {/* Body */}
      <g transform="translate(0, 78)">
        <Form plate={plate} />
      </g>
      {/* Caption */}
      <line x1={26} y1={H - 44} x2={774} y2={H - 44} stroke={CPS_INK.line} strokeWidth={0.6} />
      <foreignObject x={26} y={H - 40} width={748} height={34}>
        <div style={{ fontFamily: SERIF, fontSize: 11, fontStyle: "italic", color: CPS_INK.muted, textAlign: "center", lineHeight: 1.25 }}>
          {plate.message}
        </div>
      </foreignObject>
    </svg>
  );
}
