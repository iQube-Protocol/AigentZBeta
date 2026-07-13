"use client";

/**
 * Canonical Plates — the visual ontology of Invariant Intelligence, rendered
 * live from the encoded plate data (CFS-027; R1 of the CPS rendering layer).
 * Every drawing derives from `CANONICAL_PLATES_V1` — the same data registered in
 * the Canonical Asset Registry — so this gallery IS the ontology, not an
 * illustration of it. Compare against the operator reference render at
 * codexes/packs/irl/foundation/plates/canonical-plates-v1.0-reference.png.
 */

import React, { useMemo, useState } from "react";
import { Star } from "lucide-react";
import CanonicalPlateFigure from "@/components/publishing/CanonicalPlateFigure";
import { CANONICAL_PLATES_V1, PLATE_COMPOSITIONS } from "@/services/artifact/canonicalPlates";

export default function CanonicalPlatesTab() {
  const [selected, setSelected] = useState<string>(CANONICAL_PLATES_V1[0].number);
  const plate = useMemo(
    () => CANONICAL_PLATES_V1.find((p) => p.number === selected) ?? CANONICAL_PLATES_V1[0],
    [selected],
  );
  const usedBy = useMemo(
    () => Object.entries(PLATE_COMPOSITIONS).filter(([, plates]) => plates.includes(plate.number)).map(([pub]) => pub),
    [plate],
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-slate-100">Canonical Plates of Invariant Intelligence — v1.0</h3>
        <p className="text-sm text-slate-400 mt-1">
          Seven plates. One discipline. Rendered live from the encoded ontology (CFS-027,{" "}
          <span className="text-emerald-300">ratified 2026-07-12</span> — canonical band) — every publication is a
          composition of these, never new diagrams.
        </p>
      </div>

      {/* Plate selector */}
      <div className="flex flex-wrap gap-1.5">
        {CANONICAL_PLATES_V1.map((p) => (
          <button
            key={p.number}
            onClick={() => setSelected(p.number)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition ${
              selected === p.number
                ? "border-amber-500/60 bg-amber-500/15 text-amber-100"
                : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
            }`}
            title={p.title}
          >
            {p.signature && <Star className="h-3 w-3 text-amber-400" />}
            {p.number}
          </button>
        ))}
      </div>

      {/* The drawing */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <CanonicalPlateFigure plate={plate} />
      </div>

      {/* Reading + reuse */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1.5 text-sm">
        <p className="text-slate-200">
          <span className="font-semibold">{plate.number} · Plate {plate.roman} — {plate.title}.</span>{" "}
          <span className="text-slate-400">{plate.message}</span>
        </p>
        <p className="text-xs text-slate-500">
          form: <span className="font-mono">{plate.form}</span> · figure kind: <span className="font-mono">{plate.kind}</span>
          {usedBy.length > 0 && (
            <> · composed by: {usedBy.map((u) => <span key={u} className="font-mono text-slate-400"> {u}</span>)}</>
          )}
        </p>
      </div>
    </div>
  );
}
