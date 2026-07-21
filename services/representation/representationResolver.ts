/**
 * Constitutional Representation System — the resolver + validation gate
 * (CFS-021).
 *
 * The representation-invariant analog of the Canonical Ontology Service
 * (services/constitutional/ontologyResolver.ts): one authoritative,
 * contract-first service. Three responsibilities, all pure:
 *
 *   1. validateInterpretation — the GATE. An interpretation is valid ONLY if it
 *      satisfies the contract: fills every required role AND preserves every
 *      relationship law (standing monotonic, principal distinct, body contrast).
 *      This is CFS-021 §3.1's "an interpretation is valid only if it satisfies
 *      the contract" made executable + canary-pinned.
 *   2. resolveRole — interpretation-agnostic role resolution. Same role name,
 *      different value under each interpretation, same key.
 *   3. emitCssVariables — bind every role to a CSS custom property so a
 *      component reskins for free when the interpretation changes.
 *
 * No `window`, no I/O, no T0 identifiers — safe on server and client.
 */

import type {
  Interpretation,
  RepresentationContract,
  RepresentationRole,
  RelationshipRule,
  ValidationResult,
} from '@/types/representation';
import {
  CONSTITUTIONAL_REPRESENTATION_CONTRACT,
  roleCssVar,
} from '@/types/representation';

// ---------------------------------------------------------------------------
// Pure colour math (WCAG) — the relationship laws are measured, not asserted
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` / `#rrggbb` to 0–255 channels. Returns null for non-hex
 * (font/motion tokens legitimately are not colours). */
export function parseHex(value: string): Rgb | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** WCAG relative luminance of a colour. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Euclidean RGB distance — a coarse perceptual-distinctness proxy. */
export function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

// ---------------------------------------------------------------------------
// §1 The validation gate
// ---------------------------------------------------------------------------

function evaluateRule(
  rule: RelationshipRule,
  interp: Interpretation,
): string[] {
  const violations: string[] = [];
  const val = (role: RepresentationRole): string | undefined => interp.roles[role];

  switch (rule.kind) {
    case 'required-roles': {
      for (const role of rule.roles) {
        const v = val(role);
        if (typeof v !== 'string' || v.trim() === '') {
          violations.push(`[${rule.id}] missing or empty role "${role}"`);
        }
      }
      break;
    }
    case 'standing-monotonic': {
      const base = val(rule.against);
      const baseRgb = base ? parseHex(base) : null;
      if (!baseRgb) {
        violations.push(`[${rule.id}] reference role "${rule.against}" is not a colour`);
        break;
      }
      let prev = -Infinity;
      let prevRole = '';
      for (const role of rule.order) {
        const c = val(role);
        const rgb = c ? parseHex(c) : null;
        if (!rgb) {
          violations.push(`[${rule.id}] standing role "${role}" is not a colour`);
          continue;
        }
        const emphasis = contrastRatio(rgb, baseRgb);
        if (emphasis <= prev) {
          violations.push(
            `[${rule.id}] "${role}" emphasis ${emphasis.toFixed(2)} is not greater than "${prevRole}" (${prev.toFixed(2)}) — standing scale must be strictly increasing`,
          );
        }
        prev = emphasis;
        prevRole = role;
      }
      break;
    }
    case 'distinct': {
      const target = val(rule.role);
      const targetRgb = target ? parseHex(target) : null;
      if (!targetRgb) {
        violations.push(`[${rule.id}] role "${rule.role}" is not a colour`);
        break;
      }
      for (const other of rule.from) {
        const o = val(other);
        const oRgb = o ? parseHex(o) : null;
        if (!oRgb) continue;
        const d = rgbDistance(targetRgb, oRgb);
        if (d < rule.minDelta) {
          violations.push(
            `[${rule.id}] "${rule.role}" is too close to "${other}" (distance ${d.toFixed(1)} < ${rule.minDelta})`,
          );
        }
      }
      break;
    }
    case 'min-contrast': {
      const fg = val(rule.foreground);
      const bg = val(rule.background);
      const fgRgb = fg ? parseHex(fg) : null;
      const bgRgb = bg ? parseHex(bg) : null;
      if (!fgRgb || !bgRgb) {
        violations.push(
          `[${rule.id}] "${rule.foreground}" on "${rule.background}" — one or both are not colours`,
        );
        break;
      }
      const ratio = contrastRatio(fgRgb, bgRgb);
      if (ratio < rule.ratio) {
        violations.push(
          `[${rule.id}] "${rule.foreground}" on "${rule.background}" contrast ${ratio.toFixed(2)} < required ${rule.ratio}`,
        );
      }
      break;
    }
  }
  return violations;
}

/**
 * THE GATE. An interpretation is valid ONLY if it satisfies the contract.
 * Pure — same input, same result; drillable in node.
 */
export function validateInterpretation(
  interp: Interpretation,
  contract: RepresentationContract = CONSTITUTIONAL_REPRESENTATION_CONTRACT,
): ValidationResult {
  const violations: string[] = [];
  for (const rule of contract.rules) {
    violations.push(...evaluateRule(rule, interp));
  }
  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// §2 Interpretation-agnostic role resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a semantic role to its concrete value under an interpretation.
 * Components consume ROLES through this (or the CSS var / hook) — never raw
 * values. Swapping the interpretation reskins the whole field.
 */
export function resolveRole(
  role: RepresentationRole,
  interp: Interpretation,
): string {
  const value = interp.roles[role];
  if (typeof value !== 'string' || value === '') {
    throw new Error(
      `Interpretation "${interp.id}" does not bind required role "${role}" — validate it before use.`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// §3 Surface material — the substance a panel paints WITH
// ---------------------------------------------------------------------------

/** The composed surface-material style for a panel (CFS-021 §3;
 * `inv.representation.129`). Non-colour CSS values — a fill, a backdrop-filter,
 * a hairline border, an elevation shadow. */
export interface SurfaceStyle {
  background: string;
  backdropFilter: string;
  WebkitBackdropFilter: string;
  border: string;
  boxShadow: string;
}

/**
 * Compose the panel material for an interpretation. A component must NOT
 * hand-assemble glass — it paints with the interpretation's MATERIAL roles: the
 * (possibly translucent) tint, the backdrop blur, the hairline edge, the
 * elevation. Under a FLAT interpretation (Constitutional Civic Futurism,
 * High-Contrast Accessible) this yields an opaque matte panel — `material.blur`
 * is `none`, `material.tint` is the interpretation's opaque raised surface,
 * `material.elevation` is `none` — visually identical to the pre-material
 * `bg-surface-raised` panel. Under AgentiQ Liquid Glass the SAME call yields the
 * liquid-glass panel (real blur, translucent tint, white hairline, soft shadow +
 * inset highlight). Pure + SSR-safe: backdrop-filter is CSS-only, no `window`.
 */
export function surfaceStyle(interp: Interpretation): SurfaceStyle {
  const blur = resolveRole('material.blur', interp);
  return {
    background: resolveRole('material.tint', interp),
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    border: `1px solid ${resolveRole('material.hairline', interp)}`,
    boxShadow: resolveRole('material.elevation', interp),
  };
}

// ---------------------------------------------------------------------------
// §4 CSS-variable binding
// ---------------------------------------------------------------------------

/**
 * Bind every role to a CSS custom property (`surface.base` → `--rep-surface-base`).
 * Components read `var(--rep-ink-body)` (or the hook); injecting a different
 * interpretation's map reskins them with no component change.
 */
export function emitCssVariables(
  interp: Interpretation,
  contract: RepresentationContract = CONSTITUTIONAL_REPRESENTATION_CONTRACT,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const role of contract.requiredRoles) {
    const value = interp.roles[role];
    if (typeof value === 'string' && value !== '') {
      vars[roleCssVar(role)] = value;
    }
  }
  return vars;
}
