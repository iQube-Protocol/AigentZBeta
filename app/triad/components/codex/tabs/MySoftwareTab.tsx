"use client";

/**
 * mySoftware — the sixth myCluster tab (PRD-MMC-IMPL-007 — Phase 1 of the
 * fuller "My Software" vision being chartered separately as SPEC-MMC-002).
 *
 * A compact, read-only mirror of the persona's OWN Developer-strand
 * (Dev Command Center / Constitutional Development Environment, CFS-020)
 * dev-loop sessions — composing the SAME `/api/dev-command-center/sessions`
 * route the DCC itself calls (extended here with `?list=true` for the
 * caller's full session list, never a new backend route). No new gate: the
 * route is persona-owned-only, no admin check.
 *
 * Phase 1 scope (deliberately): dev-loop sessions (`dev_loop_sessions`, a
 * genuine per-persona table) + best-effort Capability Registry enrichment
 * (`/api/constitutional/capability-registry`, admin-gated — silently skipped
 * for non-admin viewers, never blocks rendering). It deliberately does NOT
 * read `artifact_records` (the CFS-015/softwarePilot software-artifact
 * store): that table has no per-persona ownership column today (every row
 * is stamped `delegate: 'operator'`), so surfacing its rows as "mine" would
 * be a fabricated ownership claim. Persona-attributing `artifact_records` is
 * a Phase 2 prerequisite — see PRD-MMC-IMPL-007 §0.3.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Code, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { STAGE_ORDER, getStageLabel } from "@/services/devCommandCenter/devLoop";
import type { DevLoopStage, DevLoopReceipt, DevReceiptClass } from "@/types/devCommandCenter";

interface DevLoopSessionSummary {
  sessionId: string;
  stage: DevLoopStage;
  title: string;
  startedAt: string;
  updatedAt: string;
  receipts: DevLoopReceipt[];
}

interface SessionsListResponse {
  sessions?: DevLoopSessionSummary[];
  error?: string;
}

interface RegisteredCapabilitySummary {
  capabilityId: string;
  displayLabel: string;
  standingBand: string;
  object?: { payload?: { prNumber?: number | null; mergeCommit?: string | null } };
}

interface CapabilityRegistryResponse {
  ok?: boolean;
  capabilities?: RegisteredCapabilitySummary[];
}

function stageTone(stage: DevLoopStage): string {
  if (stage === "complete") return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (stage === "deployment_authorization" || stage === "consequence_validation" || stage === "remediation") {
    return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  }
  return "text-slate-400 border-slate-700 bg-slate-800/40";
}

function receiptClassCounts(receipts: DevLoopReceipt[]): Record<DevReceiptClass, number> {
  const counts: Record<DevReceiptClass, number> = { development: 0, constitutional: 0, deployment: 0 };
  for (const r of receipts) counts[r.class] = (counts[r.class] ?? 0) + 1;
  return counts;
}

/** Best-effort match: a session's generated pack/receipts may carry a PR
 *  number or merge commit that also appears on a registered capability's
 *  provenance payload. No FK exists — this is a display-only correlation,
 *  never a hard join, and never blocks rendering when it can't be found. */
function findMatchingCapability(
  session: DevLoopSessionSummary,
  capabilities: RegisteredCapabilitySummary[],
): RegisteredCapabilitySummary | null {
  if (capabilities.length === 0) return null;
  const sessionText = JSON.stringify(session);
  return (
    capabilities.find((c) => {
      const pr = c.object?.payload?.prNumber;
      const commit = c.object?.payload?.mergeCommit;
      if (pr != null && sessionText.includes(String(pr))) return true;
      if (commit && sessionText.includes(commit)) return true;
      return false;
    }) ?? null
  );
}

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

export function MySoftwareTab({ personaId, isAdmin }: Props) {
  const [sessions, setSessions] = useState<DevLoopSessionSummary[] | null>(null);
  const [capabilities, setCapabilities] = useState<RegisteredCapabilitySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/dev-command-center/sessions?list=true", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      const json = (await res.json()) as SessionsListResponse;
      if (!res.ok || json?.error) {
        setError(json?.error || `request failed (${res.status})`);
        setSessions(null);
      } else {
        setSessions(json.sessions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load dev-loop sessions");
      setSessions(null);
    } finally {
      setLoading(false);
    }

    // Best-effort capability-registry enrichment — admin-gated route, so a
    // 403 for a non-admin viewer is expected and silently ignored (never
    // blocks the session list from rendering).
    try {
      const capRes = await personaFetch("/api/constitutional/capability-registry", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (capRes.ok) {
        const capJson = (await capRes.json()) as CapabilityRegistryResponse;
        setCapabilities(capJson.capabilities ?? []);
      }
    } catch {
      /* best-effort only */
    }
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">mySoftware</h2>
          <span className="text-xs text-slate-500">Your Developer-strand builds — aigentZ Command Center</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !sessions && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your dev-loop sessions...
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {sessions && (
        <div className="flex flex-col gap-2">
          {sessions.length === 0 && (
            <div className="text-xs text-slate-500">
              No dev-loop sessions yet. Start one in aigentZ → Command Center.
            </div>
          )}
          {sessions.map((session) => {
            const counts = receiptClassCounts(session.receipts);
            const stageIdx = STAGE_ORDER.indexOf(session.stage);
            const capability = findMatchingCapability(session, capabilities);
            return (
              <div
                key={session.sessionId}
                className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{session.title}</span>
                    {capability && (
                      <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                        {capability.standingBand}
                      </span>
                    )}
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${stageTone(session.stage)}`}>
                    {getStageLabel(session.stage)}
                    {stageIdx >= 0 ? ` (${stageIdx + 1}/${STAGE_ORDER.length})` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Started {new Date(session.startedAt).toLocaleDateString()} · Updated{" "}
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                  <span>
                    {counts.development} development · {counts.constitutional} constitutional ·{" "}
                    {counts.deployment} deployment
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <ExternalLink className="h-3 w-3" />
        Build your own software in aigentZ → Command Center.
        {!isAdmin && capabilities.length === 0 && (
          <span> Capability standing badges require admin access to the Capability Registry.</span>
        )}
      </div>
    </div>
  );
}

export default MySoftwareTab;
