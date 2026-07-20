"use client";

/**
 * Invariant Discovery Engine workspace — CFS-048 Phase 1a (constitutional arm).
 * The upstream primitive: assemble domain evidence → run constitutional
 * discovery → review candidate invariants → promote into the canonical
 * registry as `proposed` (never canonical — validation stays separate).
 *
 * Phase 1a adds the domain LADDER (discover at the domain baseline OR a
 * sub-domain beneath it — Payments/Trading/… or the CRP-003 capability domains)
 * and two self-measuring signals per candidate: an ABSTRACTION-LEVEL badge (L2/L3
 * — verbatim/summary are rejected) and a CROSS-FRAMEWORK CONVERGENCE chip (how
 * many independent sources imply it — a priority signal, not validity). Open
 * candidates sort by convergence.
 *
 * Laboratory-internal, admin-gated. Financial Services is the first domain.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Check, X, FileText, Layers, Star, GitCompare } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Evidence {
  id: string; domain: string; subDomain: string | null; title: string;
  sourceKind: string; content: string; sourceRef: string | null; createdAt: string;
}
interface Convergence { supportCount: number; frameworks: string[]; tier: "single" | "strong" | "broad" }
type Classification = "supported" | "specialized" | "split" | "novel" | "equivalent";
interface ParentSuggestion { invariantId: string; statement: string; similarity: number }
interface Candidate {
  id: string; domain: string; subDomain: string | null;
  scopeLevel: "domain" | "sub-domain" | "capability";
  abstractionLevel: "L0" | "L1" | "L2" | "L3" | "L4" | null;
  discoveryClass: string; statement: string;
  rationale: string; evidenceIds: string[]; confidence: number;
  status: "candidate" | "promoted" | "rejected"; promotedInvariantId: string | null;
  createdAt: string; convergence?: Convergence;
  stage?: "constitutional" | "compare";
  classification?: Classification | null;
  coverage?: string[] | null;
}
interface Preset { value: string; label: string }

const CLASSIFICATION_META: Record<Classification, { label: string; cls: string }> = {
  supported: { label: "Supported", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  novel: { label: "Novel", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  specialized: { label: "Specialized", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  split: { label: "Split", cls: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  equivalent: { label: "Equivalent", cls: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
};

const SOURCE_KINDS = ["legislation", "regulation", "compliance", "standard", "contract", "policy", "other"];

const ABSTRACTION_META: Record<string, { label: string; cls: string }> = {
  L2: { label: "L2 · cross-regulation", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  L3: { label: "L3 · domain-constitutional", cls: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  L4: { label: "L4 · domain-independent", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
};
const CONVERGENCE_META: Record<Convergence["tier"], string> = {
  broad: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  strong: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  single: "border-slate-600 bg-slate-800 text-slate-400",
};

export default function InvariantDiscoveryTab() {
  const [domain] = useState("financial-services");
  const [subDomain, setSubDomain] = useState<string>(""); // "" = domain baseline
  const [presets, setPresets] = useState<Preset[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eKind, setEKind] = useState("regulation");
  const [eRef, setERef] = useState("");
  const [eContent, setEContent] = useState("");
  const [eSubDomain, setESubDomain] = useState(""); // "" = domain-wide evidence
  const [linkFor, setLinkFor] = useState<{ id: string; suggestions: ParentSuggestion[]; selected: Set<string> } | null>(null);

  const scopeLabel = subDomain ? (presets.find((p) => p.value === subDomain)?.label ?? subDomain) : "Domain baseline";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ domain });
      if (subDomain) qs.set("subDomain", subDomain);
      const res = await personaFetch(`/api/invariants/discovery?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        setEvidence(data.evidence ?? []);
        setCandidates(data.candidates ?? []);
        if (Array.isArray(data.subDomainPresets)) setPresets(data.subDomainPresets);
      } else setNotice(`⚠ ${data?.error ?? "Load failed"}`);
    } catch (e) {
      setNotice(`⚠ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally { setLoading(false); }
  }, [domain, subDomain]);

  useEffect(() => { void load(); }, [load]);

  const post = useCallback(async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setNotice(null);
    try {
      const res = await personaFetch("/api/invariants/discovery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, ...body }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) { setNotice(`⚠ ${data?.error ?? "Action failed"}`); return null; }
      return data;
    } catch (e) {
      setNotice(`⚠ ${e instanceof Error ? e.message : "Action failed"}`); return null;
    } finally { setBusy(null); }
  }, [domain]);

  const addEvidence = useCallback(async () => {
    if (!eTitle.trim() || !eContent.trim()) { setNotice("⚠ title and content required"); return; }
    const r = await post({
      action: "add-evidence", title: eTitle, sourceKind: eKind,
      sourceRef: eRef || undefined, content: eContent,
      subDomain: eSubDomain || undefined,
    }, "add");
    if (r) { setETitle(""); setERef(""); setEContent(""); setESubDomain(""); setShowAdd(false); setNotice("✓ Evidence added"); await load(); }
  }, [eTitle, eKind, eRef, eContent, eSubDomain, post, load]);

  const extract = useCallback(async () => {
    const r = await post({ action: "extract", subDomain: subDomain || undefined }, "extract");
    if (r) { setNotice(`✓ Discovery run (${scopeLabel}) — ${(r.candidates ?? []).length} candidate(s) proposed`); await load(); }
  }, [post, load, subDomain, scopeLabel]);

  // Phase 2: compress the independently-discovered sub-domain candidate sets into
  // EARNED domain-level invariants (runs at the domain-baseline scope).
  const compare = useCallback(async () => {
    setSubDomain(""); // compare outputs land at the domain baseline
    const r = await post({ action: "compare" }, "compare");
    if (r) {
      setNotice(`✓ Compared ${(r.comparedSubDomains ?? []).length} sub-domains → ${(r.candidates ?? []).length} domain candidate(s) (supported / specialized / split / novel)`);
      await load();
    }
  }, [post, load]);

  const promote = useCallback(async (id: string, parentInvariantIds: string[] = []) => {
    const r = await post({ action: "promote", candidateId: id, parentInvariantIds }, `promote-${id}`);
    if (r) {
      const linked = Number(r.linkedParents ?? 0);
      setNotice(`✓ Promoted → proposed${linked > 0 ? ` · specializes ${linked} parent invariant${linked === 1 ? "" : "s"}` : ""} (validation next)`);
      setLinkFor(null);
      await load();
    }
  }, [post, load]);

  // Sub-domain candidates route through a parent-link confirm (Aletheon keystone):
  // propose parent domain invariants, operator confirms which to `specialize`.
  const startPromote = useCallback(async (c: Candidate) => {
    if (!c.subDomain) { void promote(c.id, []); return; } // domain-level → direct
    const r = await post({ action: "suggest-parents", candidateId: c.id }, `suggest-${c.id}`);
    const suggestions: ParentSuggestion[] = (r?.suggestions as ParentSuggestion[]) ?? [];
    // Preselect strong matches (similarity ≥ 0.2) so the common case is one click.
    setLinkFor({ id: c.id, suggestions, selected: new Set(suggestions.filter((s) => s.similarity >= 0.2).map((s) => s.invariantId)) });
  }, [post, promote]);

  const toggleParent = useCallback((invariantId: string) => {
    setLinkFor((lf) => {
      if (!lf) return lf;
      const selected = new Set(lf.selected);
      if (selected.has(invariantId)) selected.delete(invariantId); else selected.add(invariantId);
      return { ...lf, selected };
    });
  }, []);

  const reject = useCallback(async (id: string) => {
    const r = await post({ action: "reject", candidateId: id }, `reject-${id}`);
    if (r) { await load(); }
  }, [post, load]);

  const open = candidates
    .filter((c) => c.status === "candidate")
    // Priority order: strongest cross-framework convergence first (a priority
    // signal, not validity — Law XII), then confidence.
    .sort((a, b) => (b.convergence?.supportCount ?? 0) - (a.convergence?.supportCount ?? 0) || b.confidence - a.confidence);
  const closed = candidates.filter((c) => c.status !== "candidate");

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-slate-100">Invariant Discovery Engine — Financial Services</h3>
        <p className="text-sm text-slate-400 mt-1">
          CFS-048 · constitutional arm. Assemble evidence → discover candidate invariants (compression, not
          summarisation) → promote into the registry as <span className="text-violet-300">proposed</span>. Discovery is
          domain-first: discover the domain baseline, then ladder into sub-domains. Universality is discovered later by
          cross-domain comparison — never presupposed.
        </p>
      </div>

      {/* Scope bar — domain baseline vs a sub-domain rung */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Layers className="h-3.5 w-3.5 text-slate-400" /> Scope</span>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">Financial Services</span>
        <span className="text-slate-600">›</span>
        <select
          value={subDomain}
          onChange={(e) => setSubDomain(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        >
          <option value="">Domain baseline (whole domain)</option>
          {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span className="text-[11px] text-slate-500">
          {subDomain ? "sub-domain invariants refine the baseline" : "the invariants that hold across the whole domain"}
        </span>
      </div>
      {notice && <p className="text-xs text-slate-300">{notice}</p>}

      {/* Stage 1 — Evidence Explorer */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200"><FileText className="h-4 w-4 text-slate-400" /> Evidence <span className="text-slate-500">({evidence.length})</span></h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"><Plus className="h-3 w-3" /> Add evidence</button>
            {!subDomain && (
              <button onClick={() => void compare()} disabled={busy !== null}
                title="Compress the independently-discovered sub-domain candidates into earned domain-level invariants"
                className="inline-flex items-center gap-1.5 rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50">
                {busy === "compare" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />} Compare sub-domains
              </button>
            )}
            <button onClick={() => void extract()} disabled={busy !== null || evidence.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy === "extract" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Discover {subDomain ? `${scopeLabel} ` : ""}invariants
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="rounded-md border border-slate-700 bg-slate-950/40 p-2.5 space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Title (e.g. FATF Recommendation 10 — CDD)"
                className="md:col-span-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
              <select value={eKind} onChange={(e) => setEKind(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100">
                {SOURCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input value={eRef} onChange={(e) => setERef(e.target.value)} placeholder="Source reference / URL (optional)"
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
              <select value={eSubDomain} onChange={(e) => setESubDomain(e.target.value)} title="Tag this source to a sub-domain, or leave domain-wide"
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100">
                <option value="">Domain-wide (applies to all sub-domains)</option>
                {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <textarea value={eContent} onChange={(e) => setEContent(e.target.value)} rows={6} placeholder="Paste the regulatory/compliance text…"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500" />
            <button onClick={() => void addEvidence()} disabled={busy === "add"}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50">
              {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        ) : evidence.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No evidence in scope. Add regulatory/compliance text to discover candidate invariants.</p>
        ) : (
          <div className="space-y-1">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                <span className="rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{e.sourceKind}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{e.title}</span>
                {e.subDomain && <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">{e.subDomain}</span>}
                <span className="text-slate-500">{e.content.length.toLocaleString()} chars</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stages 2-3 — Candidate Explorer */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <h4 className="text-sm font-semibold text-slate-200">
          {subDomain ? "Sub-domain invariant candidates" : "Domain invariant candidates"}
          <span className="text-slate-500"> ({open.length} awaiting review · {scopeLabel})</span>
        </h4>
        {open.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No open candidates in scope. Add evidence and run discovery.</p>
        ) : (
          <div className="space-y-2">
            {open.map((c) => {
              const abs = c.abstractionLevel ? ABSTRACTION_META[c.abstractionLevel] : null;
              const cv = c.convergence;
              const cls = c.stage === "compare" && c.classification ? CLASSIFICATION_META[c.classification] : null;
              const frameworkLabel = cv
                ? (cv.frameworks.length > 0 && cv.frameworks.length <= 3
                    ? cv.frameworks.join(" · ")
                    : `${cv.supportCount} framework${cv.supportCount === 1 ? "" : "s"}`)
                : null;
              return (
                <div key={c.id} className={`rounded-md border p-2.5 space-y-1 ${c.stage === "compare" ? "border-fuchsia-500/30 bg-fuchsia-500/5" : "border-violet-500/20 bg-violet-500/5"}`}>
                  <p className="text-sm text-slate-100">{c.statement}</p>
                  {c.rationale && <p className="text-[11px] text-slate-400">{c.rationale}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-500">confidence {Math.round(c.confidence * 100)}% · {c.evidenceIds.length} evidence · {c.discoveryClass}</span>
                    {cls && <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${cls.cls}`}>{cls.label}</span>}
                    {c.stage === "compare" && Array.isArray(c.coverage) && c.coverage.length > 0 && (
                      <span title={c.coverage.join(" · ")} className="rounded-full border border-fuchsia-500/30 px-1.5 py-0.5 text-[9px] text-fuchsia-300/90">
                        {c.coverage.length} sub-domain{c.coverage.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {abs && <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${abs.cls}`}>{abs.label}</span>}
                    {cv && (
                      <span title={cv.frameworks.join(" · ") || "no linked sources"}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] ${CONVERGENCE_META[cv.tier]}`}>
                        <Star className="h-2.5 w-2.5" /> {frameworkLabel}
                      </span>
                    )}
                    <span className="flex-1" />
                    <button onClick={() => void startPromote(c)} disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
                      {busy === `promote-${c.id}` || busy === `suggest-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Promote → proposed
                    </button>
                    <button onClick={() => void reject(c.id)} disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-50">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>

                  {/* Parent-link confirm — the sub-domain invariant `specializes` the
                      chosen domain invariant(s); a graph, not a tree. Operator-confirmed. */}
                  {linkFor?.id === c.id && (
                    <div className="mt-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">
                        Link as a specialization of a domain invariant (optional)
                      </div>
                      {linkFor.suggestions.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No promoted domain invariants yet — promote domain candidates first to build the parent layer.</p>
                      ) : (
                        linkFor.suggestions.map((s) => (
                          <label key={s.invariantId} className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-300">
                            <input type="checkbox" className="mt-0.5 accent-emerald-500" checked={linkFor.selected.has(s.invariantId)} onChange={() => toggleParent(s.invariantId)} />
                            <span className="min-w-0 flex-1">{s.statement} <span className="text-slate-500">· sim {s.similarity}</span></span>
                          </label>
                        ))
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <button onClick={() => void promote(c.id, [...linkFor.selected])} disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
                          <Check className="h-3 w-3" /> {linkFor.selected.size > 0 ? `Link ${linkFor.selected.size} & promote` : "Promote (no parent)"}
                        </button>
                        <button onClick={() => setLinkFor(null)} className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {closed.length > 0 && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Reviewed ({closed.length})</div>
            <div className="space-y-1">
              {closed.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${c.status === "promoted" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-600 text-slate-500"}`}>{c.status}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-400">{c.statement}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
