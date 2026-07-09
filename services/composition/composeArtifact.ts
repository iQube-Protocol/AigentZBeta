/**
 * Constitutional Composition engine — the façade (CFS-022b §4, gap G3).
 *
 * `retrieve → assemble → validate → provenance`. The engine RETRIEVES canonical
 * assets and ASSEMBLES them into an Atlas Plate, GENERATING only the novel delta
 * (which sector, which standing, the title/caption prose, the layout). It owns
 * no logic the organs already own — it calls into the AssetResolver port, the
 * grounding layer, the representation resolver, and the coherence check, and
 * glues their outputs into a provenanced artefact.
 *
 * COMPOSE-NOT-GENERATE is enforced STRUCTURALLY: every colour/type/material
 * value in the emitted SVG flows through `resolveRole` from a RETRIEVED asset and
 * is recorded as a `FieldBinding` with a `sourceRef`. The bindings ledger is the
 * proof; `validateComposition` fails any retrieved field that carries a raw
 * literal with no asset reference.
 *
 * OBSERVE-MODE: `mode` defaults to 'propose' — the engine PRODUCES a candidate +
 * a provenance draft and returns them. It NEVER writes a receipt or anchors
 * anything. `receiptId` stays null; the gated-publish path is a clearly-marked
 * seam (see `PUBLISH SEAM`). No T0 identifier is expressible in any output.
 *
 * The pure geometry below is PORTED from the Bearing Instrument atlas variant
 * (`components/representation/BearingInstrument.tsx`) so the engine stays
 * React-free and server/node-safe. Same math, same anatomy — a rendering of the
 * SAME canonical primitive under a resolved interpretation.
 */

import { createHash } from 'crypto';
import type { Interpretation, RepresentationRole, FieldSector } from '@/types/representation';
import {
  FIELD_SECTORS,
  STANDING_LEVELS,
  TYPE_ROLES,
  MATERIAL_ROLES,
  MOTION_ROLES,
} from '@/types/representation';
import { resolveRole, validateInterpretation } from '@/services/representation/representationResolver';
import { getInterpretation, DEFAULT_INTERPRETATION_ID } from '@/services/representation/interpretations';
import type { InvariantEdgeRecord } from '@/types/invariants';
import type { ObjectRef } from '@/types/constitutionalObject';
import type {
  AssetRef,
  AtlasPlateDelta,
  ComposedArtefact,
  CompositionProvenance,
  CompositionRequest,
  CompositionResult,
  FieldBinding,
  GroundedComponent,
  RetrievedComponent,
} from '@/types/composition';
import type { AssetResolver, ResolvedAsset } from './assetResolver';
import { InSituAssetResolver } from './assetResolver';
import { BEARING_TRINITY } from './canonicalAssets';
import { validateComposition } from './validateComposition';

// ─────────────────────────────────────────────────────────────────────────
// Ported pure geometry (from BearingInstrument.tsx — no React, no window)
// ─────────────────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wedgePath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number): string {
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
    'Z',
  ].join(' ');
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** Heading degrees (1..360; due-north Reasoning ≡ 360) for the active sector. */
export function atlasHeadingDegrees(sector: FieldSector | null | undefined): number | null {
  if (!sector) return null;
  const i = FIELD_SECTORS.indexOf(sector);
  if (i < 0) return null;
  const deg = Math.round((i / FIELD_SECTORS.length) * 360);
  return deg === 0 ? 360 : deg;
}

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** XML-escape a text value for safe embedding in the SVG. */
function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function n(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0';
}

// ─────────────────────────────────────────────────────────────────────────
// The bindings recorder — the compose-not-generate ledger
// ─────────────────────────────────────────────────────────────────────────

const COLOR_FAMILY_PREFIXES = ['surface.', 'ink.', 'border.', 'highlight.', 'accent.', 'standing.', 'state.', 'field.'];

class Assembler {
  readonly bindings: FieldBinding[] = [];
  private readonly seen = new Set<string>();

  constructor(
    private readonly interp: Interpretation,
    private readonly paletteRef: AssetRef | undefined,
    private readonly typographyRef: AssetRef | undefined,
    private readonly materialRef: AssetRef | undefined,
  ) {}

  private sourceRefFor(role: RepresentationRole): AssetRef | undefined {
    if ((TYPE_ROLES as readonly string[]).includes(role)) return this.typographyRef;
    if ((MATERIAL_ROLES as readonly string[]).includes(role)) return this.materialRef ?? this.paletteRef;
    if ((MOTION_ROLES as readonly string[]).includes(role)) return this.materialRef ?? this.paletteRef;
    if (COLOR_FAMILY_PREFIXES.some((p) => role.startsWith(p))) return this.paletteRef;
    return this.paletteRef;
  }

  /** Resolve a role AND record it as a RETRIEVED binding with its asset source. */
  role(role: RepresentationRole): string {
    const value = resolveRole(role, this.interp);
    if (!this.seen.has(`r:${role}`)) {
      this.seen.add(`r:${role}`);
      this.bindings.push({ class: 'retrieved', key: role, value, sourceRef: this.sourceRefFor(role) });
    }
    return value;
  }

  /** Record a GENERATED delta field (the only licensed generation surface). */
  generated(key: string, value: string): void {
    if (this.seen.has(`g:${key}`)) return;
    this.seen.add(`g:${key}`);
    this.bindings.push({ class: 'generated', key, value });
  }

  /** Record a GROUNDED knowledge field (canon the artefact is true to). */
  grounded(key: string, value: string, sourceRef?: AssetRef): void {
    if (this.seen.has(`k:${key}`)) return;
    this.seen.add(`k:${key}`);
    this.bindings.push({ class: 'grounded', key, value, sourceRef });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// The Atlas Plate SVG — assembled from the ported geometry, zero literals
// ─────────────────────────────────────────────────────────────────────────

function buildAtlasPlateSvg(
  a: Assembler,
  delta: AtlasPlateDelta,
  publicRef: string,
  canonVersion: string,
): { svg: string; bearingProps: Record<string, unknown> } {
  const S = 440;
  const marginTop = 84; // title + caption band
  const marginBottom = 56; // provenance cartouche band
  const W = S;
  const H = S + marginTop + marginBottom;
  const cx = S / 2;
  const cy = marginTop + S / 2;

  // Retrieved look/type/material — every value flows through a role.
  const surfaceBase = a.role('surface.base');
  const surfaceRaised = a.role('surface.raised');
  const borderSubtle = a.role('border.subtle');
  const inkBody = a.role('ink.body');
  const inkMuted = a.role('ink.muted');
  const principal = a.role('highlight.principal');
  const geometry = a.role('accent.geometry');
  const titleFont = a.role('type.title');
  const annotationFont = a.role('type.annotation');
  const monoFont = a.role('type.mono');
  a.role('motion.tempo');
  a.role('motion.reveal');

  // Radii (fractions of S) — ported from the atlas variant.
  const rOuter = S * 0.47;
  const rBezelInner = S * 0.4;
  const rTickOuter = S * 0.455;
  const rTickInner = S * 0.425;
  const rBandOuter = S * 0.39;
  const rBandInner = S * 0.305;
  const rTrinityLabel = S * 0.345;
  const rStandingArc = S * 0.365;
  const rStandingLabel = S * 0.435;

  const activeSector = delta.activeSector;
  const standing = delta.standing;
  const standingIndex = STANDING_LEVELS.indexOf(standing);
  const heading = atlasHeadingDegrees(activeSector);

  const parts: string[] = [];

  // Plate ground.
  parts.push(`<rect x="0" y="0" width="${n(W)}" height="${n(H)}" fill="${surfaceBase}" stroke="${borderSubtle}" stroke-width="2"/>`);

  // GENERATED: title + caption (novel prose).
  a.generated('title', delta.title);
  parts.push(
    `<text x="${n(cx)}" y="40" fill="${inkBody}" font-family="${esc(titleFont)}" font-size="26" text-anchor="middle" style="letter-spacing:0.04em;font-weight:600">${esc(delta.title)}</text>`,
  );
  if (delta.caption) {
    a.generated('caption', delta.caption);
    parts.push(
      `<text x="${n(cx)}" y="66" fill="${inkMuted}" font-family="${esc(annotationFont)}" font-size="14" text-anchor="middle">${esc(delta.caption)}</text>`,
    );
  }

  // Bezel + inner ground.
  parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rOuter)}" fill="${surfaceRaised}" stroke="${borderSubtle}" stroke-width="${n(S * 0.02)}"/>`);
  parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rBezelInner)}" fill="${surfaceBase}" stroke="${borderSubtle}" stroke-width="${n(S * 0.008)}"/>`);

  // Tick ring.
  for (let k = 0; k < 36; k++) {
    const deg = -90 + k * 10;
    const major = k % 3 === 0;
    const p = polar(cx, cy, major ? rTickInner - S * 0.012 : rTickInner, deg);
    const q = polar(cx, cy, rTickOuter, deg);
    parts.push(
      `<line x1="${n(p.x)}" y1="${n(p.y)}" x2="${n(q.x)}" y2="${n(q.y)}" stroke="${inkMuted}" stroke-width="${n(major ? S * 0.006 : S * 0.003)}" opacity="${major ? 0.8 : 0.45}"/>`,
    );
  }

  // GROUNDED: the Constitutional Trinity octants (retrieved labels, canon order).
  a.grounded('field-taxonomy.trinity', BEARING_TRINITY.join(','));
  const trinityArc = { start: -158, end: -22 };
  const trinitySpan = (trinityArc.end - trinityArc.start) / BEARING_TRINITY.length;
  const trinityGap = 4;
  BEARING_TRINITY.forEach((sector, i) => {
    const start = trinityArc.start + i * trinitySpan + trinityGap / 2;
    const end = trinityArc.start + (i + 1) * trinitySpan - trinityGap / 2;
    const emphasised = sector === activeSector;
    const fill = a.role(`field.${sector}` as RepresentationRole);
    const mid = (start + end) / 2;
    const lp = polar(cx, cy, rTrinityLabel, mid);
    parts.push(
      `<path d="${wedgePath(cx, cy, rBandInner, rBandOuter, start, end)}" fill="${fill}" stroke="${emphasised ? geometry : borderSubtle}" stroke-width="${n(emphasised ? S * 0.006 : S * 0.003)}" opacity="${emphasised ? 0.9 : 0.62}"/>`,
    );
    parts.push(
      `<text x="${n(lp.x)}" y="${n(lp.y)}" fill="${surfaceRaised}" font-family="${esc(titleFont)}" font-size="${n(S * 0.036)}" text-anchor="middle" dominant-baseline="middle" style="letter-spacing:0.12em;font-weight:600">${esc(sector.toUpperCase())}</text>`,
    );
  });

  // GENERATED: related-sector navigation ticks (selection is delta).
  const related = delta.relatedSectors ?? [];
  if (related.length) a.generated('relatedSectors', related.join(','));
  related.forEach((sector) => {
    const i = FIELD_SECTORS.indexOf(sector);
    if (i < 0) return;
    const centre = -90 + (i * 360) / FIELD_SECTORS.length;
    const p = polar(cx, cy, rTickInner - S * 0.02, centre);
    const q = polar(cx, cy, rTickInner, centre);
    const stroke = a.role(`field.${sector}` as RepresentationRole);
    parts.push(`<line x1="${n(p.x)}" y1="${n(p.y)}" x2="${n(q.x)}" y2="${n(q.y)}" stroke="${stroke}" stroke-width="${n(S * 0.02)}" stroke-linecap="round"/>`);
  });

  // Standing ring — four rungs across the bottom, lit up to the delta standing.
  a.generated('standing', standing);
  const standingArc = { start: 158, end: 22 };
  const standingSpan = (standingArc.start - standingArc.end) / STANDING_LEVELS.length;
  const standingGap = 4;
  STANDING_LEVELS.forEach((level, j) => {
    const start = standingArc.start - j * standingSpan - standingGap / 2;
    const end = standingArc.start - (j + 1) * standingSpan + standingGap / 2;
    const lit = j <= standingIndex;
    const stroke = lit ? a.role(`standing.${level}` as RepresentationRole) : borderSubtle;
    const mid = (start + end) / 2;
    const lp = polar(cx, cy, rStandingLabel, mid);
    parts.push(
      `<path d="${arcPath(cx, cy, rStandingArc, end, start)}" fill="none" stroke="${stroke}" stroke-width="${n(S * 0.018)}" stroke-linecap="round" opacity="${lit ? 1 : 0.4}"/>`,
    );
    parts.push(
      `<text x="${n(lp.x)}" y="${n(lp.y)}" fill="${lit ? stroke : inkMuted}" font-family="${esc(annotationFont)}" font-size="${n(S * 0.022)}" text-anchor="middle" dominant-baseline="middle" opacity="${lit ? 1 : 0.7}" style="letter-spacing:0.06em">${esc(level.toUpperCase())}</text>`,
    );
  });

  // REGISTER marker at due-south.
  {
    const tip = polar(cx, cy, rStandingArc + S * 0.02, 90);
    const base = polar(cx, cy, rStandingArc - S * 0.02, 90);
    parts.push(`<line x1="${n(base.x)}" y1="${n(base.y)}" x2="${n(tip.x)}" y2="${n(tip.y)}" stroke="${principal}" stroke-width="${n(S * 0.01)}" stroke-linecap="round"/>`);
  }

  // Needle — orientation to the active sector.
  a.generated('activeSector', activeSector);
  if (heading !== null) {
    const needleFill = a.role(`field.${activeSector}` as RepresentationRole);
    const top = `${n(cx)},${n(cy - S * 0.13)} ${n(cx - S * 0.028)},${n(cy)} ${n(cx + S * 0.028)},${n(cy)}`;
    const bottom = `${n(cx)},${n(cy + S * 0.055)} ${n(cx - S * 0.028)},${n(cy)} ${n(cx + S * 0.028)},${n(cy)}`;
    parts.push(
      `<g transform="rotate(${heading}, ${n(cx)}, ${n(cy)})"><polygon points="${top}" fill="${needleFill}"/><polygon points="${bottom}" fill="${geometry}" opacity="0.4"/></g>`,
    );
  }
  parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(S * 0.02)}" fill="${principal}" stroke="${surfaceRaised}" stroke-width="${n(S * 0.006)}"/>`);

  // HDG / GS / ALT / TRK windows (readouts are GENERATED / operator gauges).
  const gs = delta.readouts?.gs ?? '—';
  const alt = delta.readouts?.alt ?? '—';
  a.generated('readouts.gs', gs);
  a.generated('readouts.alt', alt);
  const winW = S * 0.17;
  const winH = S * 0.105;
  const drawWindow = (wx: number, wy: number, tag: string, value: string, valFill: string) => {
    parts.push(
      `<rect x="${n(wx - winW / 2)}" y="${n(wy - winH / 2)}" width="${n(winW)}" height="${n(winH)}" rx="${n(winH * 0.22)}" fill="${surfaceRaised}" stroke="${borderSubtle}" stroke-width="${n(winH * 0.05)}"/>` +
        `<text x="${n(wx)}" y="${n(wy - winH * 0.14)}" fill="${inkMuted}" font-family="${esc(annotationFont)}" font-size="${n(S * 0.026)}" text-anchor="middle" dominant-baseline="middle" style="letter-spacing:0.08em">${esc(tag)}</text>` +
        `<text x="${n(wx)}" y="${n(wy + winH * 0.2)}" fill="${valFill}" font-family="${esc(monoFont)}" font-size="${n(S * 0.05)}" text-anchor="middle" dominant-baseline="middle">${esc(value)}</text>`,
    );
  };
  drawWindow(cx, cy - rOuter, 'HDG', heading !== null ? `${heading}°` : '—', principal);
  drawWindow(cx - rOuter, cy, 'GS', gs, inkBody);
  drawWindow(cx + rOuter, cy, 'ALT', alt, inkBody);
  drawWindow(cx, cy + rOuter, 'TRK', standing.slice(0, 5).toUpperCase(), principal);

  // GENERATED: provenance cartouche (layout arrangement is delta).
  a.generated('layout', 'dial+title+caption+standing-ring+cartouche');
  const cartY = H - marginBottom + 20;
  parts.push(
    `<text x="16" y="${n(cartY)}" fill="${inkMuted}" font-family="${esc(monoFont)}" font-size="12" text-anchor="start">ref ${esc(publicRef)}</text>`,
  );
  parts.push(
    `<text x="${n(W - 16)}" y="${n(cartY)}" fill="${inkMuted}" font-family="${esc(monoFont)}" font-size="12" text-anchor="end">canon ${esc(canonVersion)}</text>`,
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(H)}" viewBox="0 0 ${n(W)} ${n(H)}" role="img" ` +
    `aria-label="Atlas Plate — ${esc(delta.title)}, oriented to ${esc(titleCase(activeSector))}, standing ${esc(titleCase(standing))}">` +
    parts.join('') +
    `</svg>`;

  const bearingProps: Record<string, unknown> = {
    variant: 'atlas',
    activeSector,
    standing,
    relatedSectors: related,
    readouts: { gs, alt },
    showLayerLabels: true,
    size: S,
  };

  return { svg, bearingProps };
}

// ─────────────────────────────────────────────────────────────────────────
// composeAtlasPlate — the pure, synchronous core (retrieve already done)
// ─────────────────────────────────────────────────────────────────────────

export interface ComposeAtlasPlateInput {
  request: CompositionRequest;
  interpretation: Interpretation;
  /** Resolved assets from the AssetResolver port. */
  resolved: ResolvedAsset[];
  /** Grounded knowledge (may be empty when the substrate is unavailable). */
  grounded: GroundedComponent;
  /** Contradiction edges among grounded invariants (optional; from graph.ts). */
  groundedEdges?: InvariantEdgeRecord[];
  /** Canon version stamp at composition time (stamped by the caller). */
  canonVersion?: string;
  /** ISO timestamp — stamped by the caller/route, never read from the clock. */
  composedAt?: string | null;
}

/**
 * Compose ONE Constitutional Atlas Plate — PURE + synchronous. Assembles the SVG
 * from resolved assets, validates, and builds the provenance decomposition. No
 * DB, no clock, no receipt. Deterministic: same inputs → same contentHash.
 */
export function composeAtlasPlate(input: ComposeAtlasPlateInput): CompositionResult {
  const { request, interpretation, resolved, grounded } = input;
  const delta = request.delta;
  const canonVersion = input.canonVersion ?? 'canon:in-situ';
  const composedAt = input.composedAt ?? null;

  const retrievedComponents: RetrievedComponent[] = resolved.map((r) => r.component);
  const paletteRef = retrievedComponents.find((r) => r.role === 'palette')?.assetRef;
  const typographyRef = retrievedComponents.find((r) => r.role === 'typography')?.assetRef;
  const materialRef = retrievedComponents.find((r) => r.role === 'material')?.assetRef;

  const assembler = new Assembler(interpretation, paletteRef, typographyRef, materialRef);

  // A deterministic id seed from the delta + interpretation → publicRef, so the
  // commitment is stable and drillable (no randomness, no clock).
  const idSeed = createHash('sha256')
    .update(JSON.stringify({ target: request.target, delta, interpretationId: interpretation.id }))
    .digest('hex');
  const publicRef = createHash('sha256').update('composition:' + idSeed).digest('hex').slice(0, 16);

  const { svg, bearingProps } = buildAtlasPlateSvg(assembler, delta, publicRef, canonVersion);

  const artefact: ComposedArtefact = {
    kind: 'atlas-plate',
    svg,
    bearingProps,
    interpretationId: interpretation.id,
    bindings: assembler.bindings,
  };

  // Serialize ONCE — this exact string is hashed (publishResult.ts discipline).
  const canonicalString = JSON.stringify({
    svg: artefact.svg,
    bearingProps: artefact.bearingProps,
    interpretationId: artefact.interpretationId,
  });
  const contentHash = createHash('sha256').update(canonicalString).digest('hex');

  // Validate — fail-closed.
  const interpretationValidation = validateInterpretation(interpretation);
  const compositionValidation = validateComposition({
    artefact,
    retrieved: retrievedComponents,
    grounded,
    delta,
    groundedEdges: input.groundedEdges,
  });
  const pass = interpretationValidation.valid && compositionValidation.pass;

  // composedFrom — the ObjectRef audit trail (P0), deduped by id.
  const composedFrom: ObjectRef[] = [];
  const seenRefs = new Set<string>();
  for (const r of resolved) {
    const key = `${r.component.objectRef.kind}:${r.component.objectRef.id}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);
    composedFrom.push(r.component.objectRef);
  }

  const provenance: CompositionProvenance = {
    contentHash,
    publicRef,
    // PUBLISH SEAM: receiptId stays null in propose-mode. The gated-publish path
    // (mode==='publish' AND operator gate) would write a
    // `composition_published` receipt at the ROUTE layer and set this — never
    // here. This slice is propose-only by design (CFS-022b §7).
    receiptId: null,
    retrieved: retrievedComponents,
    grounded,
    generated: {
      description:
        'The novel delta: which sector is active, the standing shown, the related-sector selection, the plate title/caption prose, and the dial+cartouche layout arrangement.',
      delta,
    },
    composedFrom,
    canonVersion,
    composedAt,
  };

  return {
    ok: pass,
    target: 'atlas-plate',
    artefact,
    validation: {
      interpretation: interpretationValidation,
      composition: compositionValidation,
      pass,
    },
    provenance,
    recommendations: compositionValidation.recommendations,
    error: pass ? undefined : 'composition failed validation (fail-closed)',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// composeArtifact — the async façade: retrieve → ground → assemble → validate
// ─────────────────────────────────────────────────────────────────────────

export interface ComposeArtifactOptions {
  /** Canon version stamp (from the invariant substrate); default in-situ. */
  canonVersion?: string;
  /** ISO timestamp stamped by the route (never read from the clock here). */
  composedAt?: string | null;
}

/**
 * Compose an artefact from a request. RETRIEVES via the AssetResolver port,
 * GROUNDS via the invariant substrate (best-effort — a grounding outage never
 * blocks a propose), then ASSEMBLES + VALIDATES via composeAtlasPlate.
 *
 * mode defaults to 'propose' — no receipt is ever written here (observe-mode).
 */
export async function composeArtifact(
  request: CompositionRequest,
  resolver: AssetResolver = new InSituAssetResolver(),
  options: ComposeArtifactOptions = {},
): Promise<CompositionResult> {
  // Interpretation to render under — the listed interpretation asset, else the
  // request's interpretationId, else the registry default (house style).
  const interpretationRef = request.assets.find((a) => a.kind === 'interpretation')?.ref;
  const interpretationId = request.interpretationId ?? interpretationRef ?? DEFAULT_INTERPRETATION_ID;
  const interpretation = getInterpretation(interpretationId);

  // (1) RETRIEVE.
  const resolved = await resolver.resolve(request.assets);

  // (2) GROUND — best-effort. The invariant substrate is server/DB-backed; a
  // failure (no DB in a pure drill) must not block a propose. Import lazily so
  // the pure composeAtlasPlate path never pulls the substrate.
  let grounded: GroundedComponent = { invariantIds: [], closureRootIds: [] };
  try {
    const { buildInvariantSlice } = await import('@/services/invariants/grounding');
    const slice = await buildInvariantSlice({
      domains: request.grounding.domains,
      ontologyClassIds: request.grounding.ontologyClassIds,
    });
    grounded = { invariantIds: slice.citedIds, closureRootIds: slice.citedIds };
  } catch {
    // Grounding unavailable — proceed with an empty slice (recommendation is
    // surfaced by validateComposition's coherence law).
    grounded = { invariantIds: [], closureRootIds: [] };
  }

  // (3)+(4) ASSEMBLE + VALIDATE (+ propose-only PROVENANCE).
  return composeAtlasPlate({
    request,
    interpretation,
    resolved,
    grounded,
    canonVersion: options.canonVersion,
    composedAt: options.composedAt ?? null,
  });
}
