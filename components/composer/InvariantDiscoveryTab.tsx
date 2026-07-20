"use client";

/**
 * Invariant Discovery Engine workspace — CFS-048 Phase 0 (constitutional arm).
 * The upstream primitive: assemble domain evidence → run constitutional
 * discovery → review candidate invariants → promote into the canonical
 * registry as `proposed` (never canonical — validation stays separate).
 *
 * Laboratory-internal, admin-gated. Financial Services is the first domain.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Check, X, FileText } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Evidence {
  id: string; domain: string; title: string;
  sourceKind: string; content: string; sourceRef: string | null; createdAt: string;
}
interface Candidate {
  id: string; domain: string; discoveryClass: string; statement: string;
  rationale: string; evidenceIds: string[]; confidence: number;
  status: "candidate" | "promoted" | "rejected"; promotedInvariantId: string | null; createdAt: string;
}

const SOURCE_KINDS = ["legislation", "regulation", "compliance", "standard", "contract", "policy", "other"];

export default function InvariantDiscoveryTab() {
  const [domain] = useState("financial-services");
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch(`/api/invariants/discovery?domain=${encodeURIComponent(domain)}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) { setEvidence(data.evidence ?? []); setCandidates(data.candidates ?? []); }
      else setNotice(`⚠ ${data?.error ?? "Load failed"}`);
    } catch (e) {
      setNotice(`⚠ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally { setLoading(false); }
  }, [domain]);

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
    const r = await post({ action: "add-evidence", title: eTitle, sourceKind: eKind, sourceRef: eRef || undefined, content: eContent }, "add");
    if (r) { setETitle(""); setERef(""); setEContent(""); setShowAdd(false); setNotice("✓ Evidence added"); await load(); }
  }, [eTitle, eKind, eRef, eContent, post, load]);

  const extract = useCallback(async () => {
    const r = await post({ action: "extract" }, "extract");
    if (r) { setNotice(`✓ Discovery run — ${(r.candidates ?? []).length} candidate(s) proposed`); await load(); }
  }, [post, load]);

  const promote = useCallback(async (id: string) => {
    const r = await post({ action: "promote", candidateId: id }, `promote-${id}`);
    if (r) { setNotice(`✓ Promoted → proposed in the registry (validation next)`); await load(); }
  }, [post, load]);

  const reject = useCallback(async (id: string) => {
    const r = await post({ action: "reject", candidateId: id }, `reject-${id}`);
    if (r) { await load(); }
  }, [post, load]);

  const open = candidates.filter((c) => c.status === "candidate");
  const closed = candidates.filter((c) => c.status !== "candidate");

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-slate-100">Invariant Discovery Engine — Financial Services</h3>
        <p className="text-sm text-slate-400 mt-1">
          CFS-048 Phase 0 · constitutional arm. Assemble evidence → discover candidate invariants (compression,
          not summarisation) → promote into the registry as <span className="text-violet-300">proposed</span>. Discovery
          never canonises — validation stays a separate, earned act.
        </p>
      </div>
      {notice && <p className="text-xs text-slate-300">{notice}</p>}

      {/* Stage 1 — Evidence Explorer */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200"><FileText className="h-4 w-4 text-slate-400" /> Evidence <span className="text-slate-500">({evidence.length})</span></h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"><Plus className="h-3 w-3" /> Add evidence</button>
            <button onClick={() => void extract()} disabled={busy !== null || evidence.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy === "extract" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Discover candidates
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
            <input value={eRef} onChange={(e) => setERef(e.target.value)} placeholder="Source reference / URL (optional)"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500" />
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
          <p className="text-xs text-slate-500 italic">No evidence yet. Add regulatory/compliance text to discover candidate invariants.</p>
        ) : (
          <div className="space-y-1">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                <span className="rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{e.sourceKind}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{e.title}</span>
                <span className="text-slate-500">{e.content.length.toLocaleString()} chars</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stages 2-3 — Candidate Explorer */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <h4 className="text-sm font-semibold text-slate-200">Candidate invariants <span className="text-slate-500">({open.length} awaiting review)</span></h4>
        {open.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No open candidates. Add evidence and run discovery.</p>
        ) : (
          <div className="space-y-2">
            {open.map((c) => (
              <div key={c.id} className="rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1">
                <p className="text-sm text-slate-100">{c.statement}</p>
                {c.rationale && <p className="text-[11px] text-slate-400">{c.rationale}</p>}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] text-slate-500">confidence {Math.round(c.confidence * 100)}% · {c.evidenceIds.length} evidence · {c.discoveryClass}</span>
                  <span className="flex-1" />
                  <button onClick={() => void promote(c.id)} disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
                    {busy === `promote-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Promote → proposed
                  </button>
                  <button onClick={() => void reject(c.id)} disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-50">
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
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
