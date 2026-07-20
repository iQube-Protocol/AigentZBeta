"use client";

/**
 * Canonical Plates — the visual ontology of Invariant Intelligence, now a
 * REGISTRY of constitutional objects (operator + Aletheon, 2026-07-20), not a
 * document viewer. Extends CFS-027:
 *
 *   • The seven v1 plates render live from CANONICAL_PLATES_V1 (immutable
 *     seed canon, ratified 2026-07-12).
 *   • Composed plates (CP-008+) come from the Canonical Plate Registry and
 *     move draft → candidate → ratified (canonise) → published. Canonisation
 *     is the constitutional act; publishing merely exposes.
 *   • The machine representation (structure / plate.json) IS the plate —
 *     the SVG renderer draws it live; uploaded assets are alternative
 *     renderings referenced on the object.
 *   • Admins (stewards) get the Compose Plate flow; the public IRL OS
 *     edition lists published plates only (server-enforced).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ShieldCheck, Star, Upload } from "lucide-react";
import CanonicalPlateFigure from "@/components/publishing/CanonicalPlateFigure";
import { CANONICAL_PLATES_V1, PLATE_COMPOSITIONS, type CanonicalPlate } from "@/services/artifact/canonicalPlates";
import { personaFetch } from "@/utils/personaSpine";

interface RegisteredPlate {
  cpNumber: string;
  title: string;
  version: string;
  status: "draft" | "candidate" | "ratified" | "published";
  form: CanonicalPlate["form"];
  kind: string;
  structure: Record<string, unknown>;
  message: string;
  assets: { svg?: string; png?: string; pdf?: string };
  constitutionalRefs: string[];
  dependencies: string[];
  machineTags: string[];
  seed: boolean;
}

const STATUS_STYLE: Record<RegisteredPlate["status"], string> = {
  draft: "border-slate-600 text-slate-400",
  candidate: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  ratified: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

function toFigurePlate(p: RegisteredPlate): CanonicalPlate {
  const n = parseInt(p.cpNumber.replace("CP-", ""), 10) || 0;
  return {
    number: p.cpNumber,
    roman: String(n),
    id: p.cpNumber.toLowerCase(),
    title: p.title,
    form: p.form,
    kind: p.kind as CanonicalPlate["kind"],
    structure: p.structure as CanonicalPlate["structure"],
    message: p.message,
  };
}

export default function CanonicalPlatesTab({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const [plates, setPlates] = useState<RegisteredPlate[]>([]);
  const [selected, setSelected] = useState<string>(CANONICAL_PLATES_V1[0].number);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  // Composer fields — the JSON structure is the plate; assets are renderings.
  const [cTitle, setCTitle] = useState("");
  const [cMessage, setCMessage] = useState("");
  const [cForm, setCForm] = useState<CanonicalPlate["form"]>("branch");
  const [cStructure, setCStructure] = useState("");
  const [cRefs, setCRefs] = useState("");
  const [cDeps, setCDeps] = useState("");
  const [cSvg, setCSvg] = useState("");
  const [cPng, setCPng] = useState("");
  const [cPdf, setCPdf] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Spine transport always (CLAUDE.md rule). Non-admin sessions read the
      // public edition; the lab (admin) sees the full lifecycle.
      const url = isAdmin
        ? "/api/constitutional/canonical-plates"
        : "/api/constitutional/canonical-plates?edition=public";
      const res = await personaFetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setPlates(data.plates ?? []);
    } catch {
      // Degrade to the code-resident seed canon.
      setPlates([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const registry: RegisteredPlate[] = plates.length > 0
    ? plates
    : CANONICAL_PLATES_V1.map((p) => ({
        cpNumber: p.number, title: p.title, version: "1.0", status: "published" as const,
        form: p.form, kind: p.kind, structure: p.structure as Record<string, unknown>,
        message: p.message, assets: {}, constitutionalRefs: ["CFS-027"], dependencies: [],
        machineTags: p.signature ? ["signature"] : [], seed: true,
      }));

  const plate = useMemo(
    () => registry.find((p) => p.cpNumber === selected) ?? registry[0],
    [registry, selected],
  );
  const seedPlate = useMemo(
    () => CANONICAL_PLATES_V1.find((p) => p.number === plate?.cpNumber) ?? null,
    [plate],
  );
  const usedBy = useMemo(
    () => (seedPlate
      ? Object.entries(PLATE_COMPOSITIONS).filter(([, ps]) => ps.includes(seedPlate.number)).map(([pub]) => pub)
      : []),
    [seedPlate],
  );

  const act = useCallback(async (action: string, cpNumber?: string, plateBody?: Record<string, unknown>) => {
    setBusy(action);
    setNotice(null);
    try {
      const res = await personaFetch("/api/constitutional/canonical-plates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cpNumber, plate: plateBody }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        setNotice(`⚠ ${data?.error ?? "Action failed"}`);
      } else if (action === "validate") {
        setNotice(data.valid ? "✓ Plate is valid — ready to compose" : `⚠ ${(data.violations ?? []).join(" · ")}`);
      } else {
        setNotice(`✓ ${action}${data.cpNumber ? ` ${data.cpNumber}` : ""} → ${data.status}`);
        if (action === "compose") setShowComposer(false);
        await load();
      }
    } catch (e) {
      setNotice(`⚠ ${e instanceof Error ? e.message : "Action failed"}`);
    } finally {
      setBusy(null);
    }
  }, [load]);

  const composerPayload = useCallback((): Record<string, unknown> | null => {
    let structure: Record<string, unknown>;
    try {
      structure = JSON.parse(cStructure || "{}");
    } catch {
      setNotice("⚠ structure must be valid JSON (the machine representation IS the plate)");
      return null;
    }
    const assets: Record<string, string> = {};
    if (cSvg.trim()) assets.svg = cSvg.trim();
    if (cPng.trim()) assets.png = cPng.trim();
    if (cPdf.trim()) assets.pdf = cPdf.trim();
    return {
      title: cTitle, message: cMessage, form: cForm, kind: "ontology",
      structure, assets,
      constitutionalRefs: cRefs.split(",").map((s) => s.trim()).filter(Boolean),
      dependencies: cDeps.split(",").map((s) => s.trim()).filter(Boolean),
    };
  }, [cTitle, cMessage, cForm, cStructure, cRefs, cDeps, cSvg, cPng, cPdf]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Canonical Plate Registry</h3>
          <p className="text-sm text-slate-400 mt-1">
            Plates are registered constitutional objects (CFS-027) — the machine representation is the plate; every
            image is one rendering. CP-001..007 are the <span className="text-emerald-300">ratified v1 canon</span>;
            new plates enter via Compose → Validate → <span className="text-amber-300">Canonise</span> → Publish.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowComposer((s) => !s)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
          >
            <Plus className="h-3.5 w-3.5" /> Compose Plate
          </button>
        )}
      </div>

      {notice && <p className="text-xs text-slate-300">{notice}</p>}

      {/* Compose Plate — the constitutional intake (admin/steward only) */}
      {isAdmin && showComposer && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Title"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
            <select value={cForm} onChange={(e) => setCForm(e.target.value as CanonicalPlate["form"])}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100">
              {["branch", "radial", "circle", "stack", "flow"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <input value={cMessage} onChange={(e) => setCMessage(e.target.value)} placeholder="Message — what the plate MEANS (one line)"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
          <textarea value={cStructure} onChange={(e) => setCStructure(e.target.value)} rows={5}
            placeholder='structure (plate.json) — e.g. {"root":"Concept","branches":["A","B"]}'
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-500" />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input value={cRefs} onChange={(e) => setCRefs(e.target.value)} placeholder="Constitutional refs (comma-sep: CFS-019, Law XV, inv.polity.311)"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
            <input value={cDeps} onChange={(e) => setCDeps(e.target.value)} placeholder="Dependencies (comma-sep CP numbers: CP-001, CP-002)"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input value={cSvg} onChange={(e) => setCSvg(e.target.value)} placeholder="SVG rendering URL (optional)"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
            <input value={cPng} onChange={(e) => setCPng(e.target.value)} placeholder="PNG rendering URL (optional)"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
            <input value={cPdf} onChange={(e) => setCPdf(e.target.value)} placeholder="PDF rendering URL (optional)"
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { const p = composerPayload(); if (p) void act("validate", undefined, p); }}
              disabled={busy !== null}
              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
              {busy === "validate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Validate"}
            </button>
            <button onClick={() => { const p = composerPayload(); if (p) void act("compose", undefined, p); }}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50">
              {busy === "compose" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Compose as draft
            </button>
          </div>
        </div>
      )}

      {/* Plate selector — seed canon + composed, with lifecycle status */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading registry…
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {registry.map((p) => (
            <button
              key={p.cpNumber}
              onClick={() => setSelected(p.cpNumber)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition ${
                selected === p.cpNumber
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-100"
                  : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
              }`}
              title={`${p.title}${p.seed ? "" : ` · ${p.status}`}`}
            >
              {p.machineTags.includes("signature") && <Star className="h-3 w-3 text-amber-400" />}
              {p.cpNumber}
              {!p.seed && (
                <span className={`ml-0.5 rounded-full border px-1 text-[9px] ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* The drawing — always rendered live from the ontology */}
      {plate && (
        <>
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <CanonicalPlateFigure plate={seedPlate ?? toFigurePlate(plate)} />
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1.5 text-sm">
            <p className="text-slate-200">
              <span className="font-semibold">{plate.cpNumber} — {plate.title}.</span>{" "}
              <span className="text-slate-400">{plate.message}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>form: <span className="font-mono">{plate.form}</span></span>
              {plate.constitutionalRefs.map((r) => (
                <span key={r} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">{r}</span>
              ))}
              {plate.dependencies.length > 0 && <span>· depends on {plate.dependencies.join(", ")}</span>}
              {usedBy.length > 0 && (
                <>· composed by: {usedBy.map((u) => <span key={u} className="font-mono text-slate-400"> {u}</span>)}</>
              )}
              {(plate.assets.svg || plate.assets.png || plate.assets.pdf) && (
                <span>· renderings: {["svg", "png", "pdf"].filter((k) => plate.assets[k as keyof typeof plate.assets]).join(", ")}</span>
              )}
            </div>
            {/* Lifecycle acts — steward only, composed plates only */}
            {isAdmin && !plate.seed && (
              <div className="flex items-center gap-1.5 pt-1">
                {plate.status === "draft" && (
                  <button onClick={() => void act("submit", plate.cpNumber)} disabled={busy !== null}
                    className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-300 hover:bg-violet-500/20">Submit as candidate</button>
                )}
                {plate.status === "candidate" && (
                  <button onClick={() => void act("canonise", plate.cpNumber)} disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20">
                    <ShieldCheck className="h-3 w-3" /> Canonise (ratify)</button>
                )}
                {plate.status === "ratified" && (
                  <button onClick={() => void act("publish", plate.cpNumber)} disabled={busy !== null}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20">Publish to IRL OS</button>
                )}
                {(plate.status === "candidate" || plate.status === "ratified") && (
                  <button onClick={() => void act("withdraw", plate.cpNumber)} disabled={busy !== null}
                    className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300">Withdraw</button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
