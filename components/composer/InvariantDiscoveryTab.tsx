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
import { Loader2, Plus, Sparkles, Check, X, FileText, Layers, Star, GitCompare, ClipboardList } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { DEFAULT_DISCOVERY_DOMAIN } from "@/services/invariants/discoveryDomains";

interface DomainOption { key: string; label: string; kind: string }
type EvidenceProvenanceClass = "direct-horizontal" | "cross-vertical-observation";
interface EvidenceSupportBreakdown {
  directHorizontal: boolean; externalSourceCount: number;
  observedVerticals: string[]; crossVerticalRecurrence: number;
}
interface Recurrence {
  observedDomains: string[]; recurrenceCount: number;
  tier: "single-domain" | "cross-domain" | "broad-cross-domain";
  classificationFloor: "specialized" | "supported";
  maxAbstractionLevel: "L3" | "L4";
  // Operator ruling 2026-07-28 — a SIBLING field, never an overload of
  // recurrenceCount/observedDomains (those two keep their pre-existing
  // meaning exactly). Null for a vertical/unregistered domain.
  evidenceSupport?: EvidenceSupportBreakdown | null;
}

interface Evidence {
  id: string; domain: string; subDomain: string | null; title: string;
  sourceKind: string; content: string; sourceRef: string | null; createdAt: string;
  // Derived, never stored (inv.engineering.036) — null when the domain being
  // viewed isn't a horizontal-capability domain, where the distinction
  // doesn't exist.
  provenanceClass?: EvidenceProvenanceClass | null;
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
  createdAt: string; convergence?: Convergence; recurrence?: Recurrence;
  stage?: "constitutional" | "compare";
  classification?: Classification | null;
  coverage?: string[] | null;
  compression?: {
    role: "root" | "derived";
    parents: { parentCandidateId: string; relationship: "entails" | "specializes" | "depends_on" | "supports"; claim: string; confidence: number }[];
    rationale: string;
    materialized: boolean;
  } | null;
}
interface Preset { value: string; label: string }

/** The classification queue — the downstream of promotion (operator ruling
 *  2026-07-28: "'safe' should not become 'finished'"). Every field here is
 *  SERVER-COMPUTED by `buildClassificationQueue` /`canUseInvariantFor`; the
 *  client renders it and derives nothing, so the six checks and the refusal
 *  reasons cannot drift from what the gate actually enforces. */
interface ClassificationCheckState {
  id: string; label: string; requirement: string;
  decidedBy: "mechanical" | "steward";
  satisfied: boolean; detail: string;
}
interface QueueEntry {
  invariantId: string; statement: string; namespace: string; status: string;
  domain: string | null; checks: ClassificationCheckState[]; outstandingCheckIds: string[];
}
interface Prohibition { use: string; reason: string | null }

/**
 * The five ratified evidence-provenance classes. Assigning one is the ONLY act
 * that moves an invariant out of `unclassified` and into an experimental
 * population — and until 2026-07-28 no surface anywhere could perform it, so
 * the queue below could be read and never cleared (operator: "the same block …
 * we encountered before with the FS cross refd ones").
 *
 * Order matters: the two EXTERNAL classes come first because they are what a
 * discovery compressed from acquired institutional documents normally is, and
 * the platform classes are the ones a steward should have to reach for
 * deliberately.
 */
const PROVENANCE_CLASS_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "external-established", label: "External · established", hint: "Independently authored, already-established source (standards bodies, regulators, peer-reviewed literature)." },
  { value: "external-empirical", label: "External · empirical", hint: "Independently authored empirical findings — data, studies, measured outcomes." },
  { value: "platform-derived", label: "Platform · derived", hint: "Derived from this platform's own operation or artefacts." },
  { value: "platform-hypothesized", label: "Platform · hypothesized", hint: "Proposed by the platform, not yet evidenced externally." },
  { value: "platform-doctrine", label: "Platform · doctrine", hint: "Ratified platform doctrine — governance, method, house rules." },
];

const CLASSIFICATION_META: Record<Classification, { label: string; cls: string }> = {
  // "Convergent", not "Supported": a compare output in this class recurs across
  // multiple independent sub-domains that converged on the same behavioural
  // constraint — empirical convergence, not mere agreement with a baseline.
  supported: { label: "Convergent", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
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
  // Domain, its label, and its sub-domain ladder all come from the Discovery
  // Domain Registry via the route (PRD-IDE-002) — never a literal here.
  const [domain, setDomain] = useState<string>(DEFAULT_DISCOVERY_DOMAIN);
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [domainKind, setDomainKind] = useState<string | null>(null);
  const [observedIn, setObservedIn] = useState<string[]>([]);
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
  const [linkFor, setLinkFor] = useState<{ id: string; mode: "promote" | "relink"; suggestions: ParentSuggestion[]; selected: Set<string> } | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  // The open classify form, if any. One at a time — a steward classifies a
  // specific invariant with specific evidence, never several at once.
  const [classifyFor, setClassifyFor] = useState<
    { invariantId: string; to: string; evidenceRefs: string; rationale: string; error: string | null } | null
  >(null);
  const [prohibitions, setProhibitions] = useState<{ use: string; reason: string }[]>([]);
  const [permittedUses, setPermittedUses] = useState<string[]>([]);

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
        if (Array.isArray(data.domains)) setDomains(data.domains);
        setDomainKind(typeof data.domainKind === "string" ? data.domainKind : null);
        setObservedIn(Array.isArray(data.observedIn) ? data.observedIn : []);
        setQueue(Array.isArray(data.classificationQueue) ? data.classificationQueue : []);
        // Only prohibitions the gate actually refused. A `reason: null` would
        // mean the gate ALLOWED the use, and rendering it as a prohibition
        // would be the surface asserting a rule the gate does not enforce.
        setProhibitions(
          (Array.isArray(data.unclassifiedProhibitions) ? (data.unclassifiedProhibitions as Prohibition[]) : [])
            .filter((p): p is { use: string; reason: string } => typeof p.reason === "string" && p.reason.length > 0),
        );
        setPermittedUses(Array.isArray(data.permittedUnclassifiedUses) ? data.permittedUnclassifiedUses : []);
      } else setNotice(`⚠ ${data?.error ?? "Load failed"}`);
    } catch (e) {
      setNotice(`⚠ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally { setLoading(false); }
  }, [domain, subDomain]);

  useEffect(() => { void load(); }, [load]);

  // `opts.silent` returns the failure body to the CALLER instead of raising
  // the page-level notice — used by the classify form, which renders the
  // server's refusal next to the field that caused it (a refusal about a
  // specific invariant's evidence does not belong in a banner about the whole
  // domain). Default behaviour is unchanged for every existing caller.
  const post = useCallback(async (
    body: Record<string, unknown>,
    label: string,
    opts?: { silent?: boolean },
  ) => {
    setBusy(label); if (!opts?.silent) setNotice(null);
    try {
      const res = await personaFetch("/api/invariants/discovery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, ...body }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        if (opts?.silent) return data ?? { ok: false, error: "Action failed" };
        setNotice(`⚠ ${data?.error ?? "Action failed"}`); return null;
      }
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Action failed";
      if (opts?.silent) return { ok: false, error: message };
      setNotice(`⚠ ${message}`); return null;
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
      // Compression ratio — the reasoning-compression metric: how many
      // independently-discovered sub-domain invariants collapsed into how many
      // earned domain invariants (inv.reasoning.342 recurrence → compression).
      const input = Number(r.inputInvariantCount ?? 0);
      const output = (r.candidates ?? []).length;
      const subs = (r.comparedSubDomains ?? []).length;
      const ratio = output > 0 && input > 0 ? `${(input / output).toFixed(1)}:1` : "—";
      setNotice(
        `✓ Compressed ${input} sub-domain invariant(s) across ${subs} sub-domains → ${output} earned domain invariant(s) · compression ${ratio}`,
      );
      await load();
    }
  }, [post, load]);

  // Recursive compression — the parent-child keystone: find the derivation
  // structure among the earned domain invariants (roots vs derived).
  const compressDomain = useCallback(async () => {
    setSubDomain(""); // operates on the domain-baseline invariants
    const r = await post({ action: "compress-domain" }, "compress-domain");
    if (r) {
      const roots = Number(r.rootCount ?? 0);
      const derived = Number(r.derivedCount ?? 0);
      const total = roots + derived;
      const ratio = roots > 0 ? `${(total / roots).toFixed(1)}:1` : "—";
      setNotice(
        `✓ Recursive compression (proposed): ${total} domain invariant(s) → ${roots} root(s) + ${derived} derived · depth compression ${ratio}. Promote roots + derived, then Confirm edges to insert into the graph.`,
      );
      await load();
    }
  }, [post, load]);

  // Operator-confirmed materialisation of a derived candidate's proposed typed
  // edges into the invariant graph (nothing is auto-inserted on promotion).
  const materializeEdges = useCallback(async (id: string) => {
    const r = await post({ action: "materialize-edges", candidateId: id }, `materialize-${id}`);
    if (r) {
      const linked = Number(r.linked ?? 0);
      const skipped = Number(r.skipped ?? 0);
      setNotice(
        linked > 0
          ? `✓ Inserted ${linked} derivation edge(s) into the graph${skipped ? ` · ${skipped} skipped (parent not promoted yet)` : ""}`
          : `No edges inserted${skipped ? ` — ${skipped} parent(s) not promoted yet (promote the root parents first)` : ""}`,
      );
      await load();
    }
  }, [post, load]);

  const promote = useCallback(async (id: string, parentInvariantIds: string[] = []) => {
    const r = await post({ action: "promote", candidateId: id, parentInvariantIds }, `promote-${id}`);
    if (r) {
      const linked = Number(r.linkedParents ?? 0);
      // A re-discovery is a RESULT, not a failure, and must not read like one.
      // The candidate's statement already exists, so nothing was inserted —
      // but the discovery converged on it a second time, which is a recurrence
      // signal worth naming rather than a duplicate worth apologising for.
      setNotice(
        r.alreadyExisted
          ? `✓ Already discovered — this candidate resolved to the existing invariant (${String(r.invariantId).slice(0, 8)}…). No duplicate created; the re-discovery is recorded as recurrence evidence.`
          : `✓ Promoted → proposed${linked > 0 ? ` · specializes ${linked} parent invariant${linked === 1 ? "" : "s"}` : ""} (validation next)`,
      );
      setLinkFor(null);
      await load();
    }
  }, [post, load]);

  // Retro-link an already-promoted sub-domain invariant to its domain parents.
  const relink = useCallback(async (id: string, parentInvariantIds: string[]) => {
    const r = await post({ action: "link-parents", candidateId: id, parentInvariantIds }, `relink-${id}`);
    if (r) {
      const linked = Number(r.linkedParents ?? 0);
      setNotice(linked > 0 ? `✓ Linked — specializes ${linked} parent invariant${linked === 1 ? "" : "s"}` : "✓ No new parent links (already linked or none selected)");
      setLinkFor(null);
      await load();
    }
  }, [post, load]);

  // Sub-domain candidates route through a parent-link confirm (Aletheon keystone):
  // propose parent domain invariants, operator confirms which to `specialize`.
  const openLinkPanel = useCallback(async (c: Candidate, mode: "promote" | "relink") => {
    const r = await post({ action: "suggest-parents", candidateId: c.id }, `suggest-${c.id}`);
    const suggestions: ParentSuggestion[] = (r?.suggestions as ParentSuggestion[]) ?? [];
    // Preselect strong matches (similarity ≥ 0.2) so the common case is one click.
    setLinkFor({ id: c.id, mode, suggestions, selected: new Set(suggestions.filter((s) => s.similarity >= 0.2).map((s) => s.invariantId)) });
  }, [post]);

  const startPromote = useCallback(async (c: Candidate) => {
    if (!c.subDomain) { void promote(c.id, []); return; } // domain-level → direct
    await openLinkPanel(c, "promote");
  }, [promote, openLinkPanel]);

  const toggleParent = useCallback((invariantId: string) => {
    setLinkFor((lf) => {
      if (!lf) return lf;
      const selected = new Set(lf.selected);
      if (selected.has(invariantId)) selected.delete(invariantId); else selected.add(invariantId);
      return { ...lf, selected };
    });
  }, []);

  /**
   * Assign an evidence-provenance class — the act that clears the queue entry.
   *
   * Every refusal (unratified class, no evidence refs, blank rationale, no-op
   * reclass, and the anti-laundering rule that a move into Population A must
   * cite at least one non-repo-internal source) is enforced SERVER-SIDE by
   * `applyProvenanceReclassification`. This form deliberately does not
   * pre-validate any of them: the ruling is the server's to speak, and a
   * client that mirrored the rules would be a second copy of them that could
   * drift. The server's exact refusal text is shown to the steward.
   */
  const classify = useCallback(async () => {
    if (!classifyFor) return;
    const refs = classifyFor.evidenceRefs
      .split(/[\n,]/)
      .map((r) => r.trim())
      .filter(Boolean);
    const r = await post(
      {
        action: "classify",
        invariantId: classifyFor.invariantId,
        to: classifyFor.to,
        evidenceRefs: refs,
        rationale: classifyFor.rationale,
      },
      `classify-${classifyFor.invariantId}`,
      { silent: true },
    );
    if (r?.ok) {
      setClassifyFor(null);
      await load(); // the entry leaves the queue — it now carries a provenance
    } else {
      setClassifyFor((f) => (f ? { ...f, error: (r?.error as string) ?? "Classification failed." } : f));
    }
  }, [classifyFor, post, load]);

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

  /**
   * The classify control on a queue entry — the door out of `unclassified`.
   * Collapsed to a single button until the steward opens it, so the queue
   * still reads as a checklist rather than a wall of forms.
   */
  const renderClassifyPanel = (q: QueueEntry) => {
    const open = classifyFor?.invariantId === q.invariantId;
    if (!open) {
      return (
        <div className="pl-1 pt-0.5">
          <button
            onClick={() =>
              setClassifyFor({ invariantId: q.invariantId, to: "external-established", evidenceRefs: "", rationale: "", error: null })
            }
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Check className="h-2.5 w-2.5" /> Assign evidence provenance
          </button>
        </div>
      );
    }
    const f = classifyFor;
    return (
      <div className="mt-1 space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
        <div className="text-[10px] uppercase tracking-wide text-amber-300/80">
          Assign evidence provenance — what KIND of evidence this rests on
        </div>
        <select
          value={f.to}
          onChange={(e) => setClassifyFor({ ...f, to: e.target.value, error: null })}
          className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-200"
        >
          {PROVENANCE_CLASS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-[10px] leading-snug text-slate-500">
          {PROVENANCE_CLASS_OPTIONS.find((o) => o.value === f.to)?.hint}
        </p>
        <textarea
          value={f.evidenceRefs}
          onChange={(e) => setClassifyFor({ ...f, evidenceRefs: e.target.value, error: null })}
          rows={2}
          placeholder="Evidence refs — one per line or comma-separated (source URLs, DOIs, discovery_evidence ids). At least one is required."
          className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        <textarea
          value={f.rationale}
          onChange={(e) => setClassifyFor({ ...f, rationale: e.target.value, error: null })}
          rows={2}
          placeholder="Rationale — why this evidence supports this class. Recorded permanently on the invariant."
          className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        {f.error && (
          <p className="rounded border border-rose-800/60 bg-rose-950/40 px-1.5 py-1 text-[10px] leading-snug text-rose-300">
            {f.error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void classify()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Record classification
          </button>
          <button
            onClick={() => setClassifyFor(null)}
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Operator-confirmed parent-link panel — reused by promote (open candidates)
  // and retro-link (already-promoted candidates). Branch on linkFor.mode.
  const renderLinkPanel = (candidateId: string) => {
    if (linkFor?.id !== candidateId) return null;
    const lf = linkFor;
    const confirm = () => { if (lf.mode === "promote") void promote(candidateId, [...lf.selected]); else void relink(candidateId, [...lf.selected]); };
    const confirmLabel = lf.mode === "promote"
      ? (lf.selected.size > 0 ? `Link ${lf.selected.size} & promote` : "Promote (no parent)")
      : (lf.selected.size > 0 ? `Link ${lf.selected.size} parent${lf.selected.size === 1 ? "" : "s"}` : "Close");
    return (
      <div className="mt-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">
          {lf.mode === "promote" ? "Link as a specialization of a domain invariant (optional)" : "Link this promoted invariant to its domain parent(s)"}
        </div>
        {lf.suggestions.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No promoted domain invariants yet — promote domain candidates first to build the parent layer.</p>
        ) : (
          lf.suggestions.map((s) => (
            <label key={s.invariantId} className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-300">
              <input type="checkbox" className="mt-0.5 accent-emerald-500" checked={lf.selected.has(s.invariantId)} onChange={() => toggleParent(s.invariantId)} />
              <span className="min-w-0 flex-1">{s.statement} <span className="text-slate-500">· sim {s.similarity}</span></span>
            </label>
          ))
        )}
        <div className="flex items-center gap-2 pt-0.5">
          <button onClick={confirm} disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
            <Check className="h-3 w-3" /> {confirmLabel}
          </button>
          <button onClick={() => setLinkFor(null)} className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-slate-100">
          Invariant Discovery Engine — {domains.find((d) => d.key === domain)?.label ?? domain}
        </h3>
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
        <select
          value={domain}
          // Clearing the notice is part of changing scope. A notice describes
          // an act performed IN a scope; carried across, it renders as a
          // statement about the scope now on screen. The operator hit exactly
          // this: a Financial Services duplicate warning displayed under the
          // Commercialisation heading, which reads as Commercialisation having
          // a duplicate it does not have. A stale observation must never
          // render as current (MS-10).
          onChange={(e) => { setDomain(e.target.value); setSubDomain(""); setNotice(null); }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          title="Discovery domain — vertical (own corpus) or horizontal capability (observed across verticals)"
        >
          {(domains.length ? domains : [{ key: domain, label: domain, kind: "" }]).map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
        <span className="text-slate-600">›</span>
        <select
          value={subDomain}
          // Same rule as the domain select above: a sub-domain rung is a scope.
          onChange={(e) => { setSubDomain(e.target.value); setNotice(null); }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        >
          <option value="">Domain baseline (whole domain)</option>
          {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span className="text-[11px] text-slate-500">
          {subDomain ? "sub-domain invariants refine the baseline" : "the invariants that hold across the whole domain"}
        </span>
        {domainKind === "horizontal-capability" && observedIn.length > 0 && (
          <span className="text-[11px] text-amber-300/80" title="A horizontal capability domain has no corpus of its own — its evidence is observed inside these verticals, and recurrence across them is the confidence signal.">
            horizontal · observed in {observedIn.join(", ")}
          </span>
        )}
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
            {!subDomain && (
              <button onClick={() => void compressDomain()} disabled={busy !== null}
                title="Recursive compression: find which domain invariants derive from which — the parent-child hierarchy (roots = constitutional candidates)"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">
                {busy === "compress-domain" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Compress (recursive)
              </button>
            )}
            {/* A REFUSAL MUST SAY WHY. Discovery with no evidence in scope is a
                correct refusal — the engine compresses evidence, so with none
                there is nothing to compress. But a greyed-out button with no
                reason is indistinguishable from a broken instrument, and the
                operator reads it as "the IDE is not ready" rather than "this
                domain has no corpus yet". Name the reason and the next step. */}
            <button onClick={() => void extract()} disabled={busy !== null || evidence.length === 0}
              title={evidence.length === 0
                ? `No evidence in scope for ${scopeLabel}. Discovery compresses evidence — add evidence, or acquire this domain's external corpus, before it can run.`
                : "Compress the evidence in scope into candidate invariants"}
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
          <p className="text-xs text-slate-500 italic">
            No evidence in scope — <span className="text-slate-400">Discover invariants is disabled until this domain has evidence.</span>{' '}
            Add regulatory/compliance text above, or acquire this domain&apos;s external corpus via Corpus Scout.
          </p>
        ) : (
          <div className="space-y-1">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                <span className="rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{e.sourceKind}</span>
                {e.provenanceClass && (
                  <span
                    title={
                      e.provenanceClass === "direct-horizontal"
                        ? "Direct-horizontal — evidence acquired ABOUT this capability itself (the plain domain corpus)."
                        : "Cross-vertical observation — this capability observed manifesting inside a vertical."
                    }
                    className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
                      e.provenanceClass === "direct-horizontal"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-sky-500/40 bg-sky-500/10 text-sky-300"
                    }`}
                  >
                    {e.provenanceClass === "direct-horizontal" ? "direct" : "cross-vertical"}
                  </span>
                )}
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
                    {c.recurrence && c.recurrence.recurrenceCount > 0 && (
                      <span
                        title={`Cross-Domain Recurrence — evidence observed in: ${c.recurrence.observedDomains.join(" · ")}. Floor: ${c.recurrence.classificationFloor}; max abstraction ${c.recurrence.maxAbstractionLevel} (Amendment D §D.4a). Derived from the evidence, never stored.`}
                        className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
                          c.recurrence.tier === "broad-cross-domain"
                            ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                            : c.recurrence.tier === "cross-domain"
                              ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                              : "border-slate-600 bg-slate-800 text-slate-400"
                        }`}
                      >
                        ↻ {c.recurrence.recurrenceCount} domain{c.recurrence.recurrenceCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {c.recurrence?.evidenceSupport?.directHorizontal && (
                      <span
                        title={`Direct-horizontal evidence — ${c.recurrence.evidenceSupport.externalSourceCount} external source(s) about the capability itself. Strengthens confidence but never counts toward cross-domain recurrence (operator ruling 2026-07-28).`}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
                      >
                        ⊕ {c.recurrence.evidenceSupport.externalSourceCount} external
                      </span>
                    )}
                    {c.compression && (
                      c.compression.role === "root" ? (
                        <span title="Foundational — proposed as a root (does not derive from another invariant in the set); a constitutional candidate for this domain"
                          className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-200">
                          ◆ Root
                        </span>
                      ) : (
                        <span
                          title={c.compression.parents
                            .map((p) => `${p.relationship} (${Math.round(p.confidence * 100)}%): ${p.claim}`)
                            .join("\n") || c.compression.rationale}
                          className="rounded-full border border-slate-500/50 bg-slate-500/10 px-1.5 py-0.5 text-[9px] text-slate-300">
                          → {[...new Set(c.compression.parents.map((p) => p.relationship))].join("/")} ({c.compression.parents.length})
                          {c.compression.materialized && <span className="ml-1 text-emerald-400">✓ in graph</span>}
                        </span>
                      )
                    )}
                    {c.compression?.role === "derived" && c.status === "promoted" && !c.compression.materialized && (
                      <button
                        onClick={() => void materializeEdges(c.id)}
                        disabled={busy !== null}
                        title="Confirm these proposed derivation edges and insert them into the invariant graph (parents must also be promoted)"
                        className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">
                        {busy === `materialize-${c.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <GitCompare className="h-2.5 w-2.5" />} Confirm edges
                      </button>
                    )}
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

                  {renderLinkPanel(c.id)}
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
                <div key={c.id} className="rounded bg-white/5 px-2 py-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${c.status === "promoted" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-600 text-slate-500"}`}>{c.status}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{c.statement}</span>
                    {/* Retro-link: already-promoted sub-domain invariants (e.g. Investment/
                        Market Ops) that predate parent-linking can link up to the baseline. */}
                    {c.status === "promoted" && c.subDomain && (
                      <button onClick={() => void openLinkPanel(c, "relink")} disabled={busy !== null}
                        title="Link this promoted sub-domain invariant to its domain parent(s)"
                        className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300/90 hover:bg-emerald-500/10 disabled:opacity-50">
                        {busy === `suggest-${c.id}` || busy === `relink-${c.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <GitCompare className="h-2.5 w-2.5" />} Link parents
                      </button>
                    )}
                  </div>
                  {renderLinkPanel(c.id)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stage 4 — Classification queue.
          "The promotion path is fail-closed… But 'safe' should not become
          'finished.'" Promotion lands every invariant unclassified, in NO
          experimental population. Correct — and outstanding work, not a
          resting state. This is where it stays visible. */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-amber-300" />
          <h3 className="text-xs font-semibold text-slate-200">Classification queue</h3>
          <span className="text-slate-500 text-[11px]">
            ({queue.length} promoted &amp; unclassified · {scopeLabel})
          </span>
        </div>

        {/* The prohibition, in the GATE'S OWN words. These strings come from
            canUseInvariantFor on the server — prose written here instead would
            drift from what the gate actually refuses. */}
        {prohibitions.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-amber-300/90">
              Permitted while unclassified: {permittedUses.join(" · ") || "—"}
            </div>
            {prohibitions.map((p) => (
              <div key={p.use} className="text-[11px] leading-snug">
                <span className="text-amber-200">Must not be used as {p.use.replace(/-/g, " ")}</span>
                <span className="text-slate-400"> — {p.reason}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        ) : queue.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Nothing outstanding — every invariant this domain has promoted carries an evidence provenance,
            so each one sits in a decided experimental population.
          </p>
        ) : (
          <div className="space-y-2">
            {queue.map((q) => (
              <div key={q.invariantId} className="rounded bg-white/5 px-2 py-1.5 space-y-1">
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="flex-shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                    unclassified
                  </span>
                  <span className="flex-shrink-0 rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">
                    {q.status}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-300">{q.statement}</span>
                  <span className="flex-shrink-0 text-[10px] text-slate-500">
                    {q.outstandingCheckIds.length}/{q.checks.length} outstanding
                  </span>
                </div>
                <div className="space-y-0.5 pl-1">
                  {q.checks.map((c) => (
                    <div key={c.id} className="flex items-start gap-1.5 text-[10px] leading-snug">
                      {c.satisfied
                        ? <Check className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-emerald-400" />
                        : <span className="mt-[3px] h-2 w-2 flex-shrink-0 rounded-full border border-amber-500/60" />}
                      <span className={c.satisfied ? "text-slate-500" : "text-slate-300"}>{c.label}</span>
                      {c.decidedBy === "steward" && (
                        <span className="flex-shrink-0 rounded-full border border-slate-700 px-1 text-[8px] text-slate-500">steward</span>
                      )}
                      <span className="min-w-0 text-slate-500">— {c.detail}</span>
                    </div>
                  ))}
                </div>
                {renderClassifyPanel(q)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
