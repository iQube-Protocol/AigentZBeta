"use client";

/**
 * Track 2 — the guided operator workflow (operator ruling, 2026-08-02).
 *
 *   > "The operator must not need to run curl commands."
 *
 * ── What this panel is ─────────────────────────────────────────────────────
 *
 * A ROUTER with three hands. It renders the eleven-stage programme the server
 * derives (`/api/research/track2/[experimentId]`) and, for the five pieces the
 * operator named as missing a front end, it provides the control inline:
 *
 *   · guided crystal assignment (dry run, then admit with a rationale)
 *   · freeze-artifact provisioning
 *   · the freeze act itself
 *   · clear readiness remedies, carried verbatim from the readiness engine
 *   · (relationship creation lives on the invariant detail surface, where the
 *     invariant is — not duplicated here)
 *
 * Every other stage NAMES its existing surface and sends the operator there.
 * Re-implementing Corpus Scout review or candidate promotion inside a workflow
 * panel would be the parallel-implementation defect this programme was written
 * to avoid — and the second copy would be the stale one.
 *
 * ── What it does not decide ────────────────────────────────────────────────
 *
 * No rule is evaluated here. Eligibility, cycle guards, staleness, signatory
 * shape and every refusal come from the server; this panel renders the server's
 * own words. `dryRun` defaults on, the freeze requires an explicit
 * confirmation, and the content hash submitted for a freeze is the one the
 * operator was shown — never one this component recomputed.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";

interface Stage {
  id: string;
  ordinal: number;
  label: string;
  does: string;
  capability: string;
  surface: string;
  workKind: "scientific" | "governance";
  actor: string;
  status: "complete" | "in-progress" | "not-started" | "blocked" | "unknown";
  detail: string;
  remedies: string[];
}

interface Programme {
  experimentId: string;
  crystalDomain: string;
  stages: Stage[];
  currentStageId: string;
  nextActions: string[];
  derivationNote: string;
}

interface RatifiedBoundary {
  domain: string;
  label: string;
  boundary: string;
  exclusions: string[];
  ratificationText: string | null;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  declarationHash: string;
  immutable: boolean;
  amendedBy: string;
}

interface Execution {
  wouldFreezeSucceed: boolean;
  nextAct: string;
  preconditions: { name: string; satisfied: boolean; detail: string; remedy: string | null }[];
}

interface AssignmentOutcome {
  invariantId: string;
  admitted: boolean;
  written: boolean;
  refusals: string[];
  detail: string;
  priorDomains: string[];
}

const STATUS_ICON: Record<Stage["status"], React.ReactNode> = {
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  "in-progress": <Circle className="h-3.5 w-3.5 text-amber-300" />,
  "not-started": <Circle className="h-3.5 w-3.5 text-slate-600" />,
  blocked: <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />,
  unknown: <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />,
};

/** `unknown` is never rendered as a failure — it means the signal could not be
 *  read, which is different from both "not started" and "blocked". */
const STATUS_LABEL: Record<Stage["status"], string> = {
  complete: "complete",
  "in-progress": "in progress",
  "not-started": "not started",
  blocked: "blocked",
  unknown: "not observable from here",
};

export function Track2ProgrammePanel({ experimentId = "EXP-P1" }: { experimentId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programme, setProgramme] = useState<Programme | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}`, {
        cache: "no-store",
      });
      const d = await res.json().catch(() => null);
      if (!d?.requestSucceeded) {
        throw new Error(d?.error || `the Track 2 programme could not be read (HTTP ${res.status})`);
      }
      setProgramme(d.programme as Programme);
    } catch (e) {
      setError(e instanceof Error ? e.message : "the Track 2 programme could not be read");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className={PANEL}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Track 2 — corpus acquisition to frozen crystal
          </h3>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}

        {programme && (
          <>
            <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
              <div className="text-slate-500">crystal domain</div>
              <div className="font-mono text-slate-200">{programme.crystalDomain}</div>
              <div className="mt-1.5 text-slate-500">next</div>
              <ul className="space-y-0.5">
                {programme.nextActions.map((a, i) => (
                  <li key={i} className="text-slate-200">
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            <ol className="space-y-2">
              {programme.stages.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-lg border p-2.5 text-[11px] ${
                    s.id === programme.currentStageId
                      ? "border-slate-700 bg-slate-950"
                      : "border-slate-800 bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{STATUS_ICON[s.status]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-slate-100">
                          {s.ordinal}. {s.label}
                        </span>
                        <span className="text-slate-500">{STATUS_LABEL[s.status]}</span>
                        <span
                          className={
                            s.workKind === "governance" ? "text-violet-300" : "text-cyan-300"
                          }
                        >
                          {s.workKind}
                        </span>
                      </div>
                      <div className="text-slate-400">{s.does}</div>
                      <div className="mt-0.5 text-slate-500">{s.detail}</div>
                      {s.remedies.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {s.remedies.map((r, i) => (
                            <li
                              key={i}
                              className="rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-amber-100"
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-1 text-[10px] text-slate-600">
                        {s.surface} · {s.actor}
                      </div>
                      <div className="text-[10px] font-mono text-slate-700">{s.capability}</div>

                      {s.id === "assign-to-crystal" && (
                        <AssignmentControl experimentId={experimentId} onDone={() => void load()} />
                      )}
                      {s.id === "freeze" && (
                        <FreezeControl experimentId={experimentId} onDone={() => void load()} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-2 text-[10px] text-slate-600">{programme.derivationNote}</div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Guided crystal assignment. Dry run is the DEFAULT and the only thing the
 * first button does — the server also defaults `dryRun` to true, so a forgotten
 * flag inspects rather than writes. The admit button is disabled until a dry
 * run has been seen and a rationale entered.
 */
function AssignmentControl({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [idsText, setIdsText] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dryRun: boolean;
    admitted: number;
    refused: number;
    written: number;
    notFound: string[];
    outcomes: AssignmentOutcome[];
    receiptWritten: boolean;
    receiptWarning?: string;
  } | null>(null);

  const invariantIds = idsText
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch(
          `/api/research/crystal/${encodeURIComponent(experimentId)}/assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invariantIds, dryRun, ...(dryRun ? {} : { rationale }) }),
          },
        );
        const d = await res.json().catch(() => null);
        if (!d?.requestSucceeded) throw new Error(d?.error || `assignment failed (HTTP ${res.status})`);
        setResult(d);
        if (!dryRun) onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the assignment could not be evaluated");
      } finally {
        setBusy(false);
      }
    },
    [experimentId, invariantIds, rationale, onDone],
  );

  const dryRunSeen = result?.dryRun === true;

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2">
      <textarea
        value={idsText}
        onChange={(e) => {
          setIdsText(e.target.value);
          setResult(null);
        }}
        rows={2}
        placeholder="invariant ids, whitespace or comma separated"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
      />
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="why these invariants are admitted (required to write — recorded on the assignment receipt)"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => void run(true)}
          disabled={busy || invariantIds.length === 0}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Dry run"}
        </button>
        <button
          onClick={() => void run(false)}
          disabled={busy || !dryRunSeen || !rationale.trim() || (result?.admitted ?? 0) === 0}
          className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
        >
          Admit to crystal
        </button>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">{err}</div>
      )}

      {result && (
        <div className="space-y-1 text-[11px]">
          <div className="text-slate-300">
            {result.dryRun ? "DRY RUN — nothing written. " : "Written. "}
            {result.admitted} admitted · {result.refused} refused
            {!result.dryRun && ` · ${result.written} context row(s) written`}
            {!result.dryRun && (
              <span className={result.receiptWritten ? " text-emerald-300" : " text-amber-200"}>
                {result.receiptWritten ? " · receipted" : " · RECEIPT FAILED"}
              </span>
            )}
          </div>
          {result.receiptWarning && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-100">
              {result.receiptWarning}
            </div>
          )}
          {result.notFound.length > 0 && (
            <div className="text-amber-200">not found: {result.notFound.join(", ")}</div>
          )}
          <ul className="space-y-1">
            {result.outcomes.map((o) => (
              <li
                key={o.invariantId}
                className={`rounded border p-1.5 ${
                  o.admitted ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <span className="font-mono text-slate-400">{o.invariantId}</span>{" "}
                <span className={o.admitted ? "text-emerald-300" : "text-amber-200"}>
                  {o.admitted ? "admitted" : o.refusals.join(", ")}
                </span>
                <div className="text-slate-500">{o.detail}</div>
                <div className="text-[10px] text-slate-600">
                  prior domains: {o.priorDomains.join(", ") || "none"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The freeze ceremony.
 *
 * THE BOUNDARY IS RENDERED, NEVER TYPED. The server reads it from the ratified
 * declaration and returns it as immutable text; the operator confirms this
 * exact boundary. There is no field here that can change it — a different
 * boundary requires a formal amendment to the domain declaration.
 *
 * THE HASH SUBMITTED IS THE ONE SHOWN. The freeze posts the `contentHash` the
 * preview returned, and the server recomputes and refuses a mismatch. Nothing
 * here recomputes or substitutes a hash.
 */
function FreezeControl({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [operatorRef, setOperatorRef] = useState("");
  const [reviewerRef, setReviewerRef] = useState("");
  const [rationale, setRationale] = useState("");
  const [boundaryAcknowledged, setBoundaryAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<RatifiedBoundary | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [frozen, setFrozen] = useState<{ receiptId: string | null; invariantCount: number } | null>(null);

  const call = useCallback(
    async (path: string, body: Record<string, unknown>, successField: "ok" | "requestSucceeded") => {
      const res = await personaFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!d?.[successField]) {
        // The server's own words win. A mismatch refusal names both hashes.
        throw new Error(
          [d?.error, d?.currentContentHash ? `current: ${d.currentContentHash}` : null]
            .filter(Boolean)
            .join(" — ") || `request failed (HTTP ${res.status})`,
        );
      }
      return d as Record<string, unknown>;
    },
    [],
  );

  const runPreview = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setFrozen(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze-preview`,
        {
          operatorRef,
          reviewerRef: reviewerRef || undefined,
          freezeRationale: rationale,
          ratifiedAt: new Date().toISOString(),
          // domainBoundary is deliberately NOT sent — the route refuses it.
        },
        "ok",
      );
      const pkg = d.package as { contentHash: string; eligibleForRatification: boolean };
      setBoundary(d.ratifiedBoundary as RatifiedBoundary);
      setContentHash(pkg.contentHash);
      setEligible(pkg.eligibleForRatification);
      setExecution(d.execution as Execution);
      setBoundaryAcknowledged(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze preview could not be built");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, operatorRef, reviewerRef, rationale]);

  const provision = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        { action: "provision" },
        "requestSucceeded",
      );
      await runPreview();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the artifact could not be provisioned");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, runPreview, onDone]);

  const freeze = useCallback(async () => {
    if (!contentHash) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        {
          action: "freeze",
          confirm: true,
          contentHash,
          signedBy: [operatorRef, reviewerRef].filter(Boolean),
          freezeRationale: rationale,
        },
        "requestSucceeded",
      );
      setFrozen({
        receiptId: (d.receiptId as string | null) ?? null,
        invariantCount: Number(d.invariantCount ?? 0),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze was refused");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, contentHash, operatorRef, reviewerRef, rationale, onDone]);

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="grid gap-1.5 sm:grid-cols-2">
        <input
          value={operatorRef}
          onChange={(e) => setOperatorRef(e.target.value)}
          placeholder="operator reference (T2-safe, never a persona UUID)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
        <input
          value={reviewerRef}
          onChange={(e) => setReviewerRef(e.target.value)}
          placeholder="reviewer reference (optional)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
      </div>
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="why this freeze, now — the ratifying words"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => void runPreview()}
          disabled={busy || !operatorRef.trim() || !rationale.trim()}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview package"}
        </button>
        <button
          onClick={() => void provision()}
          disabled={busy}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
        >
          Provision artifact
        </button>
        <button
          onClick={() => void freeze()}
          disabled={
            busy ||
            !contentHash ||
            !boundaryAcknowledged ||
            eligible !== true ||
            execution?.wouldFreezeSucceed !== true
          }
          className="flex items-center gap-1 rounded border border-violet-800 bg-violet-900/30 px-2.5 py-1 text-violet-200 disabled:opacity-50"
        >
          <Lock className="h-3 w-3" /> Freeze
        </button>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
      )}

      {boundary && (
        <div className="rounded border border-slate-700 bg-slate-950 p-2">
          <div className="mb-1 text-slate-500">
            Ratified domain boundary — <span className="text-slate-300">immutable</span>, read from the
            declaration. You confirm it; you do not reproduce it.
          </div>
          <div className="text-slate-200">{boundary.boundary}</div>
          {boundary.exclusions.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-slate-400">
              {boundary.exclusions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <div className="mt-1 text-[10px] text-slate-600">
            ratified by {boundary.ratifiedBy ?? "—"} on {boundary.ratifiedAt ?? "—"} · declaration{" "}
            <span className="font-mono">{boundary.declarationHash.slice(0, 16)}…</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">{boundary.amendedBy}</div>
          <label className="mt-1.5 flex items-center gap-1.5 text-slate-200">
            <input
              type="checkbox"
              checked={boundaryAcknowledged}
              onChange={(e) => setBoundaryAcknowledged(e.target.checked)}
            />
            I ratify this exact boundary
          </label>
        </div>
      )}

      {contentHash && (
        <div className="text-slate-400">
          content commitment <span className="font-mono text-slate-200">{contentHash.slice(0, 24)}…</span> ·
          evidence eligible:{" "}
          <span className={eligible ? "text-emerald-300" : "text-amber-200"}>{String(eligible)}</span>
        </div>
      )}

      {execution && (
        <ul className="space-y-0.5">
          {execution.preconditions.map((p) => (
            <li key={p.name} className={p.satisfied ? "text-slate-500" : "text-amber-200"}>
              {p.satisfied ? "✓" : "○"} {p.name} — {p.detail}
              {p.remedy && <div className="text-[10px] text-slate-500">{p.remedy}</div>}
            </li>
          ))}
        </ul>
      )}

      {frozen && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-200">
          Frozen — {frozen.invariantCount} invariant(s) committed. Receipt{" "}
          <span className="font-mono">{frozen.receiptId ?? "—"}</span>. Publication as canonical is a separate
          act and is out of scope for EXP-P1.
        </div>
      )}
    </div>
  );
}
