"use client";

/**
 * RepresentationFieldPreview — the adoption-proof surface (CFS-021).
 *
 * Mounts a RepresentationProvider, an interpretation switcher, and the
 * StandingBadge primitive so the operator can flip Constitutional Civic
 * Futurism ↔ High-Contrast Accessible and watch the SAME objects reskin
 * coherently. Every swatch and badge here consumes ROLES via the resolver —
 * none hardcodes a colour. This is the end-to-end demonstration that the
 * system is the invariant contract and a style is one interpretation of it.
 */

import React from "react";
import { RepresentationProvider, useRepresentation } from "./RepresentationProvider";
import { StandingBadge } from "./StandingBadge";
import { STANDING_LEVELS, FIELD_SECTORS, type RepresentationRole } from "@/types/representation";

function Switcher() {
  const { interpretation, setInterpretation, interpretations } = useRepresentation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">Interpretation</span>
      {interpretations.map((i) => {
        const active = i.id === interpretation.id;
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => setInterpretation(i.id)}
            className={`rounded-full px-3 py-1 text-xs border transition ${
              active
                ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40 font-semibold"
                : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200"
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

export function RepresentationFieldPreview() {
  return (
    <RepresentationProvider injectCssVars>
      <Preview />
    </RepresentationProvider>
  );
}
