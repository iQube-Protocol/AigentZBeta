"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

/**
 * The two-mode EXP-P1 execution model surface (operator ruling, 2026-09-07:
 * "Update the experiment execution model so we can rehearse internally
 * without weakening the registered confirmatory protocol."). Standalone,
 * mounted unconditionally in both host surfaces — never gated on Track 2's
 * own slow programme composition — mirroring
 * `FreezeVP2InternalPilotAction.tsx`'s own pattern and rationale
 * (CI-2026-09-07-GOVERNED-ACT-ELIGIBILITY-INDEPENDENT-OF-SLOW-COMPOSITION-001).
 *
 * Reads/writes `GET`/`POST /api/research/crystal/[experimentId]/rehearsal`
 * only — never re-derives eligibility, the frozen substrate, or the
 * confirmatory blocker list client-side; every one of those is resolved
 * server-side from the REGISTERED protocol's own artifact ladder
 * (`deriveProtocolRatified`) and the frozen crystal's own lifecycle
 * (`latestFrozenCrystalArtifact`) — never a hardcoded generation number.
 *
 * Renders nothing until SOME crystal-version generation has ever been
 * frozen — before that there is nothing to rehearse and nothing yet to call
 * "blocked" (the pre-freeze state is already covered by
 * `FreezeVP2InternalPilotAction`'s own eligible/not-eligible phases).
 */

interface RehearsalEligibilityView {
  eligible: boolean;
  reason?: string;
  frozenCrystalArtifactId: string | null;
  frozenCrystalContentHash: string | null;
}

interface PastRehearsalRunView {
  id: string;
  frozenAt: string | null;
  taskSetId: string;
  taskSetProvenance: string;
  armIds: string[];
  taskCount: number;
  receiptId: string | null;
}

interface StatusView {
  eligibility: RehearsalEligibilityView;
  frozenSubstrateLabel: string | null;
  confirmatoryBlockers: string[];
  pastRehearsalRuns: PastRehearsalRunView[];
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "none" }
  | { kind: "ready"; data: StatusView };

export function ExpP1ExecutionStatus({
  experimentId,
  personaId,
}: {
  experimentId: string;
  /** See `FreezeVP2InternalPilotAction`'s identical prop for the full
   *  rationale — threaded onto every fetch this component makes so it
   *  resolves the SAME persona the rest of the embed already resolved. */
  personaId?: string;
}) {
  const personaHintOpt = useMemo(() => (personaId ? { personaIdHint: personaId } : {}), [personaId]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [lastRunNote, setLastRunNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/rehearsal`, {
        cache: "no-store",
        ...personaHintOpt,
      });
      const body = await res.json().catch(() => null);
      if (!body?.requestSucceeded) {
        throw new Error(body?.error || `could not read the EXP-P1 execution status (HTTP ${res.status})`);
      }
      if (!body.eligibility?.frozenCrystalArtifactId) {
        setPhase({ kind: "none" });
        setRefreshErr(null);
        return;
      }
      setPhase({
        kind: "ready",
        data: {
          eligibility: body.eligibility,
          frozenSubstrateLabel: body.frozenSubstrateLabel ?? null,
          confirmatoryBlockers: Array.isArray(body.confirmatoryBlockers) ? body.confirmatoryBlockers : [],
          pastRehearsalRuns: Array.isArray(body.pastRehearsalRuns) ? body.pastRehearsalRuns : [],
        },
      });
      setRefreshErr(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "could not read the EXP-P1 execution status";
      setPhase((prev) => (prev.kind === "ready" ? prev : { kind: "error", message }));
      setRefreshErr(message);
    }
  }, [experimentId, personaHintOpt]);

  useEffect(() => {
    void load();
  }, [load]);

  const runRehearsal = useCallback(async () => {
    setBusy(true);
    setRunErr(null);
    setLastRunNote(null);
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/rehearsal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        ...personaHintOpt,
      });
      const body = await res.json().catch(() => null);
      if (!body?.requestSucceeded) {
        throw new Error(body?.error || `the rehearsal run was refused (HTTP ${res.status})`);
      }
      const taskCount = Array.isArray(body.taskResults) ? body.taskResults.length : 0;
      setLastRunNote(`Rehearsal complete — ${taskCount} task(s) across arms A/B/C/D. ${body.note ?? ""}`.trim());
      await load();
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "the rehearsal run was refused");
    } finally {
      setBusy(false);
    }
  }, [experimentId, load, personaHintOpt]);

  if (phase.kind === "loading") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Reading the EXP-P1 execution status…
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mt-2 space-y-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
        <div>Could not read the EXP-P1 execution status — {phase.message}.</div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-100 hover:bg-rose-500/20"
        >
          Retry
        </button>
      </div>
    );
  }

  if (phase.kind === "none") {
    return null;
  }

  const { data } = phase;
  const { eligibility } = data;

  return (
    <div className="mt-2 space-y-2 text-[11px]">
      {data.frozenSubstrateLabel && (
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2 text-slate-300">
          Frozen substrate: <span className="font-medium text-slate-100">{data.frozenSubstrateLabel}</span>
        </div>
      )}

      {/* Internal rehearsal — READY / not eligible */}
      <div className="rounded border border-sky-900/50 bg-sky-950/10 p-2">
        <div className="flex items-center gap-1.5 font-medium text-sky-200">
          <FlaskConical className="h-3.5 w-3.5" />
          Internal rehearsal — {eligibility.eligible ? "READY" : "not eligible"}
        </div>
        {!eligibility.eligible && eligibility.reason && (
          <div className="mt-1 text-slate-500">{eligibility.reason}</div>
        )}
        {eligibility.eligible && (
          <>
            <div className="mt-1 text-slate-500">
              Exercises the real four-arm harness against the frozen substrate above.{" "}
              <span className="font-medium text-amber-300">
                INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE
              </span>
              . Results may never be promoted into the confirmatory EXP-P1 result set.
            </div>
            {runErr && (
              <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{runErr}</div>
            )}
            {lastRunNote && (
              <div className="mt-1.5 rounded border border-emerald-900/50 bg-emerald-950/20 p-1.5 text-emerald-200">
                {lastRunNote}
              </div>
            )}
            <button
              onClick={() => void runRehearsal()}
              disabled={busy}
              className="mt-1.5 flex items-center gap-1 rounded border border-sky-800 bg-sky-900/30 px-2.5 py-1 text-sky-200 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Run EXP-P1
              internal rehearsal
            </button>
            {data.pastRehearsalRuns.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-slate-800 pt-1.5 text-slate-500">
                {data.pastRehearsalRuns.slice(0, 3).map((r) => (
                  <div key={r.id}>
                    {r.frozenAt ?? "—"} · {r.taskCount} task(s) · taskSet {r.taskSetProvenance} · arms {r.armIds.join(",")}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmatory execution — BLOCKED */}
      <div className="rounded border border-rose-900/50 bg-rose-950/10 p-2">
        <div className="flex items-center gap-1.5 font-medium text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          Confirmatory execution — BLOCKED
        </div>
        <ul className="mt-1 space-y-0.5 text-slate-400">
          {data.confirmatoryBlockers.map((b) => (
            <li key={b}>○ {b}</li>
          ))}
        </ul>
      </div>

      {refreshErr && <div className="text-amber-300/80">Last refresh could not confirm this is still current — {refreshErr}.</div>}
    </div>
  );
}
