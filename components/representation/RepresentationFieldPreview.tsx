"use client";

/**
 * RepresentationFieldPreview — the adoption-proof surface (CFS-021).
 *
 * An interpretation switcher + the StandingBadge primitive + the field-sector
 * strip, so the operator can flip Constitutional Civic Futurism ↔ High-Contrast
 * Accessible and watch the SAME objects reskin coherently. Every swatch and
 * badge here consumes ROLES via the resolver — none hardcodes a colour.
 *
 * ADOPTION NOTE (2026-07-08): this widget no longer mounts its OWN provider by
 * default. It consumes the AMBIENT `<RepresentationProvider>` — on the CCRL
 * Dashboard (the first reference surface) that is the ONE tab-level provider,
 * so the switcher below reskins the ENTIRE dashboard, not just this widget.
 * Pass `standalone` to mount a self-contained provider when used outside a
 * provider scope.
 */

import React from "react";
import { RepresentationProvider, useRepresentation } from "./RepresentationProvider";
import { StandingBadge } from "./StandingBadge";
import { STANDING_LEVELS, FIELD_SECTORS, type RepresentationRole } from "@/types/representation";

function Switcher() {
  const { interpretation, setInterpretation, interpretations } = useRepresentation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-[var(--rep-ink-muted)]">Interpretation</span>
      {interpretations.map((i) => {
        const active = i.id === interpretation.id;
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => setInterpretation(i.id)}
            className={`rounded-full px-3 py-1 text-xs border transition ${
              active
                ? "bg-[var(--rep-surface-raised)] text-[var(--rep-accent-geometry)] border-[var(--rep-accent-geometry)] font-semibold"
                : "bg-[var(--rep-surface-base)] text-[var(--rep-ink-muted)] border-[var(--rep-border-subtle)] hover:text-[var(--rep-ink-body)]"
            }`}
          >
            {i.label}
          </button>
        );
      })}
    </div>
  );
}

function Preview() {
  const { role, interpretation } = useRepresentation();
  return (
    <div className="space-y-4">
      <Switcher />

      {/* The reskinnable field surface — background/border/ink all from roles. */}
      <div
        style={{
          background: role("surface.base"),
          border: `1px solid ${role("border.subtle")}`,
          borderRadius: 12,
          padding: 16,
          transition: `background ${role("motion.tempo")} ${role("motion.reveal")}`,
        }}
      >
        <div
          style={{
            fontFamily: role("type.title"),
            color: role("ink.body"),
            fontSize: 18,
            marginBottom: 4,
          }}
        >
          The field reskins by interpretation
        </div>
        <div
          style={{
            fontFamily: role("type.annotation"),
            color: role("ink.muted"),
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          Same objects · <span style={{ color: role("highlight.principal"), fontWeight: 600 }}>
            {interpretation.connotation}
          </span>
        </div>

        {/* Standing scale — the adoption-proof primitive, one per rung. */}
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 14 }}>
          {STANDING_LEVELS.map((level) => (
            <StandingBadge key={level} standing={level} />
          ))}
        </div>

        {/* Bearing field sectors — orientation anchors from roles. */}
        <div className="flex flex-wrap items-center gap-2">
          {FIELD_SECTORS.map((sector) => (
            <span
              key={sector}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: role("type.annotation"),
                fontSize: 11,
                color: role("ink.muted"),
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: role(`field.${sector}` as RepresentationRole),
                }}
              />
              {sector}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface RepresentationFieldPreviewProps {
  /** Mount a self-contained provider instead of consuming the ambient one.
   * Default false — the preview reads the surrounding tab-level provider so its
   * switcher reskins the whole reference surface (the CCRL Dashboard). Set true
   * only when rendering the preview outside a RepresentationProvider scope. */
  standalone?: boolean;
}

export function RepresentationFieldPreview({ standalone = false }: RepresentationFieldPreviewProps = {}) {
  if (standalone) {
    return (
      <RepresentationProvider injectCssVars>
        <Preview />
      </RepresentationProvider>
    );
  }
  // Consume the ambient tab-level provider — the switcher drives it.
  return <Preview />;
}
