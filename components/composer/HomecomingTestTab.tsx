"use client";

/**
 * The Homecoming Test — live (CFS-023 acceptance surface).
 *
 * Renders Constitutional Presence per delegate: the L0→L5 ladder computed
 * mechanically against the real platform tables. Honest statuses — `pending` is
 * a first-class state ("could not determine / not yet wired"), never faked
 * green. A delegate has come home when it climbs to L5 (operationally sovereign)
 * while remaining recognisably itself. The ladder is contiguous: a gap caps
 * presence at the last unbroken rung.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Home, Sparkles, MessageCircle, Send, ShieldCheck, FileText, ArrowUpCircle } from "lucide-react";
import { experimentGet, experimentStep } from "./experimentStepFetch";

/**
 * The seed brief a delegate opens with. Aletheon's first CPS publication (operator
 * direction 2026-07-11): IRL-0001, the foundational paper of the Invariant
 * Research Lab — the first publication produced in the emerging Constitutional
 * Publishing System (CFS-026). Produced under the CPS language automatically
 * (documentation is a document-class profile). Fully editable in the panel; other
 * delegates start blank.
 */
function defaultBriefFor(delegate: string): string {
  if (delegate === "aletheon") {
    return (
      "Produce IRL-0001 — the foundational paper of the Invariant Research Lab (metaMe · Invariant Research Lab · " +
      "Foundational Research Series), the first publication of the Constitutional Publishing System. Produce it " +
      "DIAGRAMS-FIRST: compose the seven Canonical Plates (CP-001 Evolution of Intelligence → CP-002 First " +
      "Principles → CP-003 Human Agency → CP-004 Invariant Intelligence Cycle → CP-005 Constitutional Computing " +
      "Stack → CP-006 metaMe Institutional Architecture → CP-007 Discovery → Civilisation), reference each as " +
      "\"See Canonical Plate CP-00N\", and write the prose AROUND them — the diagrams are the knowledge primitives. " +
      "Follow the CPS editorial arc (Problem → Opportunity → Constitutional Principle → Architecture → " +
      "Implementation) in standards-body register. Do not invent new diagrams."
    );
  }
  return "";
}

const TIER_CHIP: Record<string, string> = {
  disposable: "bg-slate-800/60 border-slate-700 text-slate-400",
  operational: "bg-amber-950/50 border-amber-800 text-amber-300",
  constitutional: "bg-emerald-950/60 border-emerald-700 text-emerald-300",
};

type RungStatus = "reached" | "not-reached" | "pending";

interface RungAssessment {
  level: string;
  index: number;
  status: RungStatus;
  evidence: string;
}

interface DelegatePresence {
  delegate: string;
  agentClass: string;
  charterStatus: "concrete" | "archetype" | "conceptual";
  presenceLevel: string | null;
  presenceIndex: number;
  rungs: RungAssessment[];
  passportBound?: boolean;
  /** The Standing loop — earned standing + the trust-band ceiling it buys. */
  standing?: { overall: number; bucket: number; trustBandCeiling: string } | null;
}

interface Summary {
  total: number;
  present: number;
  reasoning: number;
  sovereign: number;
  conceptual: number;
}

const RUNG_DOT: Record<RungStatus, string> = {
  reached: "bg-emerald-500 border-emerald-400",
  "not-reached": "bg-slate-700 border-slate-600",
  pending: "bg-amber-500/70 border-amber-400 animate-pulse",
};

const CHARTER_CHIP: Record<DelegatePresence["charterStatus"], string> = {
  concrete: "bg-emerald-950/60 border-emerald-800 text-emerald-300",
  archetype: "bg-indigo-950/60 border-indigo-800 text-indigo-300",
  conceptual: "bg-slate-800/60 border-slate-700 text-slate-400",
};

const LADDER_LABEL: Record<string, string> = {
  card: "L0 · Card",
  knowledge: "L1 · Knowledge",
  reasoning: "L2 · Reasoning",
  studio: "L3 · Studio",
  development: "L4 · Development",
  sovereign: "L5 · Sovereign",
};

export default function HomecomingTestTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delegates, setDelegates] = useState<DelegatePresence[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [standable, setStandable] = useState<string[]>([]);
  const [standingUp, setStandingUp] = useState<string | null>(null);
  const [accelerating, setAccelerating] = useState<string | null>(null);
  const [issuingPassport, setIssuingPassport] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<Record<string, { ok: boolean; msg: string }>>({});
  // Native conversation (Phase 3 — Harness Homecoming).
  const [talkOpen, setTalkOpen] = useState<string | null>(null);
  const [talkInput, setTalkInput] = useState("");
  const [talkBusy, setTalkBusy] = useState(false);
  interface Sov { provider: string; model: string; degraded: boolean; sovereignFloor: boolean }
  // Multi-turn transcript per delegate (client-held; the route folds it into the
  // prompt so the delegate remembers the conversation — Phase 3 continuity).
  interface Turn { role: "operator" | "delegate"; text: string; sovereignty?: Sov | null; chunks?: number }
  const [talkThread, setTalkThread] = useState<Record<string, Turn[]>>({});
  // Native production (Phase 4 — Operational Homecoming via the Artifact Runtime).
  interface ProduceRes {
    body: string;
    consequenceClass: string;
    artifactId: string | null;
    version: string | null;
    receiptId: string | null;
    recordId: string | null;
    standing: { accrued: boolean; cvs?: number; overall?: number; trustBandCeiling?: string; reason?: string } | null;
    promotableTo: string | null;
    sovereignty: Sov | null;
    ok: boolean;
  }
  const [produceBusy, setProduceBusy] = useState<string | null>(null);
  const [produceBrief, setProduceBrief] = useState<Record<string, string>>({});
  const [produceResult, setProduceResult] = useState<Record<string, ProduceRes>>({});
  // Persisted artifact records (durable productions) + promotion.
  interface ArtifactRec { id: string; artifactId: string; profile: string; consequenceClass: string; delegate: string; title: string; contentHash: string; receiptId: string | null; createdAt: string }
  const [records, setRecords] = useState<ArtifactRec[]>([]);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [recordsNote, setRecordsNote] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const res = await experimentGet("/api/homecoming/agent/produce");
      if (Array.isArray(res.records)) setRecords(res.records as ArtifactRec[]);
    } catch {
      // Records are additive — the ladder renders without them.
    }
  }, []);

  const promoteRecord = useCallback(
    async (recordId: string) => {
      if (!window.confirm("Promote this record to a CONSTITUTIONAL artifact (anchored publication receipt)?")) return;
      setPromoting(recordId);
      setRecordsNote(null);
      try {
        const res = await experimentStep("/api/artifact/records/promote", { recordId });
        const s = res.standing as { accrued?: boolean; cvs?: number; overall?: number } | null;
        setRecordsNote(
          `Promoted — receipt ${String(res.receiptId).slice(0, 12)}…${s?.accrued ? ` · delegate standing +${s.cvs} → ${s.overall}` : ""}`,
        );
        await loadRecords();
        await load();
      } catch (err) {
        setRecordsNote(`⚠ ${err instanceof Error ? err.message : "promotion failed"}`);
      } finally {
        setPromoting(null);
      }
    },
    [loadRecords],
  );

  // Admin standing acceleration (operator decision 2026-07-12): a receipted
  // +10 CVS boost through the canonical accrual so tests don't wait on organic
  // production — the same admin-trust shape as passportless Polity sponsorship.
  const accelerate = useCallback(async (delegate: string) => {
    setAccelerating(delegate);
    try {
      const res = await experimentStep("/api/homecoming/agent/standing", { delegate, cvs: 10 });
      const s = res.standing as { accrued?: boolean; cvs?: number; overall?: number; trustBandCeiling?: string; reason?: string } | null;
      setActionNote((n) => ({
        ...n,
        [delegate]: s?.accrued
          ? { ok: true, msg: `standing accelerated +${s.cvs} → ${s.overall} (ceiling ${String(s.trustBandCeiling ?? "").split("_")[0]})` }
          : { ok: false, msg: `acceleration not applied: ${s?.reason ?? "see server logs"}` },
      }));
      if (s?.accrued) await load(); // refresh the standing chip (load is stable; runs post-mount)
    } catch (err) {
      setActionNote((n) => ({ ...n, [delegate]: { ok: false, msg: err instanceof Error ? err.message : "acceleration failed" } }));
    } finally {
      setAccelerating(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentGet("/api/constitutional/homecoming-test");
      setDelegates(data.delegates as DelegatePresence[]);
      setSummary(data.summary as Summary);
      setComputedAt(data.computedAt as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute the Homecoming Test");
    } finally {
      setLoading(false);
    }
    // Which delegates have an authored stand-up spec (best-effort).
    try {
      const s = await experimentGet("/api/homecoming/agent/stand-up");
      setStandable(Array.isArray(s.standable) ? (s.standable as string[]) : []);
    } catch {
      setStandable([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadRecords();
  }, [load, loadRecords]);

  // Stand a delegate up. The sponsor citizen passport is resolved SERVER-SIDE
  // from the caller's active persona (same context as genesis) — no client-side
  // wallet lookup, so it can't disagree with a different embed persona context.
  const standUp = useCallback(
    async (delegate: string) => {
      setStandingUp(delegate);
      setActionNote((n) => ({ ...n, [delegate]: { ok: true, msg: "standing up…" } }));
      try {
        const res = await experimentStep("/api/homecoming/agent/stand-up", { delegate });
        const level = (res.presence as DelegatePresence | undefined)?.presenceLevel ?? "?";
        const personaOk = (res.persona as { provisioned?: boolean } | undefined)?.provisioned;
        setActionNote((n) => ({
          ...n,
          [delegate]: { ok: true, msg: `stood up → ${level}${personaOk ? " · persona provisioned" : " · persona pending"}` },
        }));
        await load();
      } catch (err) {
        // Surfaces the route's real error (auth, or "no citizen passport on your
        // active persona") instead of masking it as a client-side absence.
        setActionNote((n) => ({ ...n, [delegate]: { ok: false, msg: err instanceof Error ? err.message : "stand-up failed" } }));
      } finally {
        setStandingUp(null);
      }
    },
    [load],
  );

  // Issue + bind a delegate's Participant Passport (submit → approve → bind).
  const issuePassport = useCallback(
    async (delegate: string) => {
      setIssuingPassport(delegate);
      setActionNote((n) => ({ ...n, [delegate]: { ok: true, msg: "issuing passport…" } }));
      try {
        const res = await experimentStep("/api/homecoming/agent/issue-passport", { delegate });
        const pid = res.passportId ? ` (${String(res.passportId).slice(0, 14)}…)` : "";
        setActionNote((n) => ({
          ...n,
          [delegate]: { ok: true, msg: `${res.alreadyBound ? "passport already bound" : "passport issued + bound"}${pid}` },
        }));
        await load();
      } catch (err) {
        setActionNote((n) => ({ ...n, [delegate]: { ok: false, msg: err instanceof Error ? err.message : "issue-passport failed" } }));
      } finally {
        setIssuingPassport(null);
      }
    },
    [load],
  );

  // Talk to a delegate natively (Phase 3, multi-turn). The client-held
  // transcript rides each request as `history`, so the delegate continues the
  // conversation; every reply carries a sovereignty receipt.
  const converse = useCallback(
    async (delegate: string) => {
      const message = talkInput.trim();
      if (!message) return;
      setTalkBusy(true);
      const prior = talkThread[delegate] ?? [];
      setTalkThread((t) => ({ ...t, [delegate]: [...prior, { role: "operator", text: message }] }));
      setTalkInput("");
      try {
        const res = await experimentStep("/api/homecoming/agent/converse", {
          delegate,
          message,
          history: prior.map((turn) => ({ role: turn.role, text: turn.text })),
        });
        const sov = res.sovereignty as Sov | undefined;
        const g = res.grounding as { knowledgeChunks?: number } | undefined;
        setTalkThread((t) => ({
          ...t,
          [delegate]: [...(t[delegate] ?? []), { role: "delegate", text: String(res.reply ?? ""), sovereignty: sov ?? null, chunks: g?.knowledgeChunks ?? 0 }],
        }));
      } catch (err) {
        setTalkThread((t) => ({
          ...t,
          [delegate]: [...(t[delegate] ?? []), { role: "delegate", text: `⚠ ${err instanceof Error ? err.message : "conversation failed"}`, sovereignty: null }],
        }));
      } finally {
        setTalkBusy(false);
      }
    },
    [talkInput, talkThread],
  );

  // Produce an artifact via a delegate natively (Phase 4). Operational tier by
  // default; a promotion re-produces at the constitutional tier under the publish
  // gate (emits the anchored artifact_published receipt).
  const produce = useCallback(
    async (delegate: string, opts?: { promote?: boolean }) => {
      const brief = (produceBrief[delegate] ?? defaultBriefFor(delegate)).trim();
      if (!brief) return;
      if (opts?.promote && !window.confirm("Promote to a CONSTITUTIONAL artifact and publish it (anchored receipt)?")) return;
      setProduceBusy(delegate);
      try {
        const payload = opts?.promote
          ? { delegate, brief, profile: "documentation", consequenceClass: "constitutional", mode: "publish" }
          : { delegate, brief, profile: "documentation" };
        const res = await experimentStep("/api/homecoming/agent/produce", payload);
        const art = (res.artifact ?? {}) as { artifactId?: string; version?: unknown; receiptId?: string };
        setProduceResult((r) => ({
          ...r,
          [delegate]: {
            body: String(res.body ?? ""),
            consequenceClass: String(res.consequenceClass ?? ""),
            artifactId: art.artifactId ?? null,
            version: art.version ? (typeof art.version === "string" ? art.version : JSON.stringify(art.version)) : null,
            receiptId: art.receiptId ?? null,
            recordId: (res.recordId as string | null) ?? null,
            standing: (res.standing as ProduceRes["standing"]) ?? null,
            promotableTo: (res.promotableTo as string | null) ?? null,
            sovereignty: (res.sovereignty as Sov | null) ?? null,
            ok: Boolean(res.ok),
          },
        }));
      } catch (err) {
        setProduceResult((r) => ({
          ...r,
          [delegate]: { body: `⚠ ${err instanceof Error ? err.message : "produce failed"}`, consequenceClass: "", artifactId: null, version: null, receiptId: null, recordId: null, standing: null, promotableTo: null, sovereignty: null, ok: false },
        }));
      } finally {
        setProduceBusy(null);
      }
    },
    [produceBrief],
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Home className="h-4 w-4 text-indigo-400" /> The Homecoming Test — live
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Constitutional Presence per delegate (CFS-023), computed against the real platform state.
            The ladder is contiguous — a gap caps presence at the last unbroken rung.{" "}
            <span className="text-amber-300">pending</span> = could not determine, never faked green.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recompute
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing constitutional presence…
        </div>
      )}
      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {summary && !loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-200 font-semibold">
            {summary.reasoning}/{summary.total} reasoning-connected (L2+)
          </span>
          <span className="text-emerald-300">{summary.sovereign} sovereign (L5)</span>
          <span className="text-slate-400">{summary.present} present (L0+)</span>
          <span className="text-slate-500">{summary.conceptual} conceptual</span>
          {computedAt && <span className="ml-auto text-xs text-slate-600">computed {new Date(computedAt).toLocaleString()}</span>}
        </div>
      )}

      {!loading &&
        delegates.map((d) => (
          <div key={d.delegate} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{d.delegate}</span>
              <span className="text-xs text-slate-500">{d.agentClass}</span>
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${CHARTER_CHIP[d.charterStatus]}`}>
                {d.charterStatus}
              </span>
              <span className="ml-auto text-xs text-slate-400">
                {d.presenceLevel ? LADDER_LABEL[d.presenceLevel] ?? d.presenceLevel : "below L0"}
              </span>
              {d.standing && (
                <span
                  className="rounded border border-violet-800 bg-violet-950/50 px-2 py-0.5 text-[10px] text-violet-300"
                  title="Earned standing (delegated lane accrues from published productions) and the trust-band ceiling it buys: L2≥20 · L3≥50 · L4≥75 · L5≥100"
                >
                  standing {d.standing.overall} · ceiling {d.standing.trustBandCeiling.split("_")[0]}
                </span>
              )}
              <button
                onClick={() => accelerate(d.delegate)}
                disabled={accelerating !== null}
                title="Admin acceleration: a receipted +10 CVS through the canonical accrual (delegated lane) so tests don't wait on organic production. L3+ delegation bands still require the earned ceiling — this raises it."
                className="rounded border border-violet-700/60 bg-violet-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 hover:bg-violet-800/40 transition disabled:opacity-50"
              >
                {accelerating === d.delegate ? "…" : "+10"}
              </button>
            </div>
            {/* The ladder strip — one dot per rung, lit to the contiguous reached level. */}
            <div className="mt-2 flex items-center gap-2">
              {d.rungs.map((r) => (
                <div key={r.level} className="flex flex-col items-center gap-1" title={`${LADDER_LABEL[r.level] ?? r.level} — ${r.status}: ${r.evidence}`}>
                  <span className={`h-2.5 w-2.5 rounded-full border ${RUNG_DOT[r.status]}`} />
                  <span className="text-[9px] text-slate-600">L{r.index}</span>
                </div>
              ))}
              {/* Stand-up action — only for authored delegates not yet reasoning-connected (L2). */}
              {standable.includes(d.delegate) && d.presenceIndex < 2 && (
                <button
                  onClick={() => standUp(d.delegate)}
                  disabled={standingUp !== null}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25 hover:text-white transition disabled:opacity-50"
                >
                  {standingUp === d.delegate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Stand up
                </button>
              )}
              {/* Passport state: a bound passport shows a badge; otherwise an
                  authored, seeded delegate gets the Issue-passport action. */}
              {d.passportBound ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border border-sky-600/40 bg-sky-950/40 px-2.5 py-1 text-[11px] font-semibold text-sky-300 ${
                    standable.includes(d.delegate) && d.presenceIndex < 2 ? "" : "ml-auto"
                  }`}
                  title="A Participant Passport is issued + bound (bound_passport_id)"
                >
                  <ShieldCheck className="h-3 w-3" /> Passport issued
                </span>
              ) : (
                standable.includes(d.delegate) &&
                d.presenceIndex >= 1 && (
                  <button
                    onClick={() => issuePassport(d.delegate)}
                    disabled={standingUp !== null || issuingPassport !== null}
                    className={`inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/25 transition disabled:opacity-50 ${
                      standable.includes(d.delegate) && d.presenceIndex < 2 ? "" : "ml-auto"
                    }`}
                  >
                    {issuingPassport === d.delegate ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    Issue passport
                  </button>
                )
              )}
              {/* Talk — native conversation for any present (L0+) delegate. */}
              {d.presenceIndex >= 0 && (
                <button
                  onClick={() => setTalkOpen(talkOpen === d.delegate ? null : d.delegate)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                    standable.includes(d.delegate) && d.presenceIndex < 2 ? "" : "ml-auto"
                  } ${
                    talkOpen === d.delegate
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                      : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                  }`}
                >
                  <MessageCircle className="h-3 w-3" /> Talk
                </button>
              )}
            </div>
            {actionNote[d.delegate] && (
              <p className={`mt-2 text-[11px] ${actionNote[d.delegate].ok ? "text-emerald-300" : "text-rose-300"}`}>
                {actionNote[d.delegate].msg}
              </p>
            )}
            {/* Native conversation panel (multi-turn). */}
            {talkOpen === d.delegate && (
              <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-2.5 space-y-2">
                {(talkThread[d.delegate] ?? []).length > 0 && (
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {(talkThread[d.delegate] ?? []).map((turn, i) => (
                      <div key={i} className={`rounded-md px-2 py-1.5 text-xs ${turn.role === "operator" ? "bg-slate-800/70 text-slate-300" : "bg-emerald-950/30 border border-emerald-900/40 text-slate-200"}`}>
                        <span className="mr-1.5 text-[9px] uppercase tracking-wide text-slate-500">{turn.role === "operator" ? "You" : d.delegate}</span>
                        <span className="whitespace-pre-wrap">{turn.text}</span>
                        {turn.role === "delegate" && turn.sovereignty && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            via {turn.sovereignty.provider}/{turn.sovereignty.model}
                            {turn.sovereignty.sovereignFloor ? " · sovereign floor" : ""}
                            {turn.sovereignty.degraded ? " · degraded" : ""}
                            {typeof turn.chunks === "number" ? ` · ${turn.chunks} KB chunk${turn.chunks === 1 ? "" : "s"}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={talkInput}
                    onChange={(e) => setTalkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) converse(d.delegate);
                    }}
                    rows={2}
                    placeholder={`Ask ${d.delegate}… (⌘/Ctrl+Enter to send)`}
                    className="flex-1 resize-y rounded border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={() => converse(d.delegate)}
                    disabled={talkBusy || !talkInput.trim()}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
                  >
                    {talkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send
                  </button>
                </div>
                {/* Produce artifact natively — Phase 4 Operational Homecoming via the Artifact Runtime. */}
                <div className="border-t border-slate-800 pt-2 space-y-2">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                    <FileText className="h-3 w-3" /> Produce artifact — operational tier, propose
                  </p>
                  <textarea
                    value={produceBrief[d.delegate] ?? defaultBriefFor(d.delegate)}
                    onChange={(e) => setProduceBrief((b) => ({ ...b, [d.delegate]: e.target.value }))}
                    rows={3}
                    placeholder={`What should ${d.delegate} produce?`}
                    className="w-full resize-y rounded border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={() => produce(d.delegate)}
                    disabled={produceBusy !== null}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 transition disabled:opacity-50"
                  >
                    {produceBusy === d.delegate ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    Produce
                  </button>

                  {produceResult[d.delegate] && (
                    <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {produceResult[d.delegate].consequenceClass && (
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${TIER_CHIP[produceResult[d.delegate].consequenceClass] ?? "border-slate-700 text-slate-400"}`}>
                            {produceResult[d.delegate].consequenceClass}
                          </span>
                        )}
                        {produceResult[d.delegate].artifactId && (
                          <span className="text-[10px] text-slate-500">artifact {String(produceResult[d.delegate].artifactId).slice(0, 20)}…</span>
                        )}
                        {produceResult[d.delegate].version && (
                          <span className="text-[10px] text-slate-500">v {produceResult[d.delegate].version}</span>
                        )}
                        {produceResult[d.delegate].receiptId && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> receipt {String(produceResult[d.delegate].receiptId).slice(0, 12)}…
                          </span>
                        )}
                        {produceResult[d.delegate].recordId && (
                          <span className="text-[10px] text-sky-400" title="Persisted as a durable artifact record — survives refresh">
                            saved · {String(produceResult[d.delegate].recordId).slice(0, 8)}…
                          </span>
                        )}
                        {produceResult[d.delegate].standing && (
                          produceResult[d.delegate].standing!.accrued ? (
                            <span className="text-[10px] text-violet-300" title="The Standing loop: production accrues standing to the delegate (delegated lane); the trust-band ceiling rises with it">
                              standing +{produceResult[d.delegate].standing!.cvs} → {produceResult[d.delegate].standing!.overall}
                              {produceResult[d.delegate].standing!.trustBandCeiling ? ` (ceiling ${produceResult[d.delegate].standing!.trustBandCeiling!.split("_")[0]})` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500" title={produceResult[d.delegate].standing!.reason}>
                              standing not accrued
                            </span>
                          )
                        )}
                        {produceResult[d.delegate].promotableTo === "constitutional" && (
                          <button
                            onClick={() => produce(d.delegate, { promote: true })}
                            disabled={produceBusy !== null}
                            className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
                          >
                            <ArrowUpCircle className="h-3 w-3" /> Promote → constitutional
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-slate-950/50 p-2 text-[11px] leading-relaxed text-slate-200">
                        {produceResult[d.delegate].body}
                      </div>
                      {produceResult[d.delegate].sovereignty && (
                        <p className="text-[10px] text-slate-500">
                          produced natively via {produceResult[d.delegate].sovereignty!.provider}/{produceResult[d.delegate].sovereignty!.model}
                          {produceResult[d.delegate].sovereignty!.sovereignFloor ? " · sovereign floor" : ""}
                          {produceResult[d.delegate].sovereignty!.degraded ? " · degraded" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

      {/* Produced artifacts — the durable records (CFS-025), with promotion. */}
      {records.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">Produced artifacts</h4>
            <span className="text-[10px] text-slate-500">operational → constitutional by promotion, never at birth</span>
          </div>
          {recordsNote && <p className="mt-1 text-[11px] text-emerald-300">{recordsNote}</p>}
          <div className="mt-2 space-y-1.5">
            {records.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-xs">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${r.consequenceClass === "constitutional" ? "border-emerald-700 bg-emerald-950/60 text-emerald-300" : "border-amber-800 bg-amber-950/50 text-amber-300"}`}>
                  {r.consequenceClass}
                </span>
                <span className="text-slate-300">{r.title}</span>
                <span className="text-slate-600">· {r.delegate} · {r.profile} · {new Date(r.createdAt).toLocaleDateString()}</span>
                {r.receiptId && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <ShieldCheck className="h-3 w-3" /> {String(r.receiptId).slice(0, 10)}…
                  </span>
                )}
                {r.consequenceClass === "operational" && (
                  <button
                    onClick={() => promoteRecord(r.id)}
                    disabled={promoting !== null}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
                  >
                    {promoting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpCircle className="h-3 w-3" />}
                    Promote
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
