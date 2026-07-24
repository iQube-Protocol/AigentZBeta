"use client";

/**
 * mySoftware — the sixth myCluster tab (PRD-MMC-IMPL-007 Phase 1 +
 * SPEC-MMC-002 §6.2 Phase 2).
 *
 * A compact mirror of the persona's OWN Developer-strand output, from two
 * sources:
 *
 *  1. Dev-loop sessions (Dev Command Center / Constitutional Development
 *     Environment, CFS-020) — composing the SAME
 *     `/api/dev-command-center/sessions?list=true` route the DCC itself
 *     calls. No new gate: persona-owned-only, no admin check.
 *  2. (Phase 2, SPEC-MMC-002 §6.2) `artifact_records` software productions
 *     the caller themselves produced — via the new `/api/artifact/records/
 *     mine` route, which filters on the T2-safe `actor_commitment` column
 *     the 20260819000000 migration added. Phase 1 could not read this table
 *     at all (every row was stamped the generic `delegate: 'operator'` with
 *     no per-persona column — PRD-MMC-IMPL-007 §0.2/§0.3); Phase 2 closes
 *     that gap for GOING-FORWARD productions only. Rows written before the
 *     migration ran keep `actor_commitment: null` and correctly never
 *     appear here — that is honest, not a bug (nothing was guessed).
 *
 * Best-effort Capability Registry enrichment (`/api/constitutional/
 * capability-registry`, admin-gated) is silently skipped for non-admin
 * viewers and never blocks rendering — same as Phase 1.
 *
 * Deep links (SPEC-MMC-002 §6.2 bullet 5): every card links back into
 * aigentZ → Command Center. THIS IS AN IN-CARTRIDGE TAB SWITCH, not a
 * cross-cartridge navigation — mySoftware and Command Center are both tabs
 * of the SAME `metame` codex (`data/codex-configs.ts`'s `agentz` and
 * `mycluster` groups). The correct mechanism is the existing
 * `codex:navigate-tab` CustomEvent (`CodexPanelDynamic.tsx`'s handler,
 * already used by e.g. `LockerTab.tsx`) — dispatching it swaps the active
 * tab in place with no page reload. An earlier version of this file used
 * `buildCodexUrl()` + a plain `<a href>`, which (a) is the CROSS-cartridge
 * mechanism (every other real usage in this repo targets a DIFFERENT codex
 * slug — see `AlphaProgrammeTab.tsx`), so using it here forced a full page
 * navigation that looked like the app "popping out"; and (b) pointed at
 * `tab: 'dev-command-center'`, which is not a tab slug that exists on the
 * `metame` codex at all — metaMe's own Command Center mirror has
 * `slug: 'aigent-z'` (`data/codex-configs.ts`, id
 * `metame-agentz-command-center`; `'dev-command-center'` is a DIFFERENT
 * top-level codex's tab). Both bugs are fixed below.
 *
 * The Command Center (`DevCommandCenterTab.tsx`) hydrates only the caller's
 * MOST RECENT session on mount — it has no `sessionId` resume affordance
 * today, so this still honestly lands on Command Center generally, not a
 * specific past session. `artifact_records` rows have no originating
 * Builder/Studio surface wired yet either — they link to the same tab as
 * the closest reasonable destination, not a fabricated more-specific one.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Code, Loader2, RefreshCw, ExternalLink, Package } from "lucide-react";
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

/** Mirrors app/api/artifact/records/mine/route.ts's MySoftwareArtifactSummary. */
interface MySoftwareArtifactSummary {
  artifactId: string;
  profile: string;
  consequenceClass: string;
  title: string;
  brief: string;
  artefactType: string | null;
  runtimeHost: string | null;
  permissions: unknown;
  contentHashPrefix: string;
  receiptId: string | null;
  createdAt: string;
}

interface ArtifactRecordsMineResponse {
  records?: MySoftwareArtifactSummary[];
  error?: string;
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

/** In-cartridge tab switch to aigentZ → Command Center (SPEC-MMC-002 §6.2
 *  bullet 5) — see the module header for why this is a `codex:navigate-tab`
 *  dispatch (no page reload) at the `aigent-z` slug, not a `buildCodexUrl`
 *  href (that's the cross-cartridge mechanism, and pointed at a slug this
 *  codex doesn't have). Mirrors `LockerTab.tsx`'s existing usage. */
function navigateToCommandCenter(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: "aigent-z" } }));
}

/** Same mechanism, targeting myLedger (`slug: 'my-ledger'` — already correct
 *  on this codex, unlike Command Center's slug). */
function navigateToMyLedger(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: "my-ledger" } }));
}

export function MySoftwareTab({ personaId, isAdmin }: Props) {
  const [sessions, setSessions] = useState<DevLoopSessionSummary[] | null>(null);
  const [capabilities, setCapabilities] = useState<RegisteredCapabilitySummary[]>([]);
  const [artifactRecords, setArtifactRecords] = useState<MySoftwareArtifactSummary[]>([]);
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

    // Phase 2 (SPEC-MMC-002 §6.2): the caller's own attributable
    // artifact_records software productions. Best-effort — a failure here
    // (e.g. migration not yet applied, or a transient network error) never
    // blocks the dev-loop session list above from rendering; it just leaves
    // this section empty, exactly as the capability-registry enrichment
    // below already degrades.
    try {
      const recRes = await personaFetch("/api/artifact/records/mine", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (recRes.ok) {
        const recJson = (await recRes.json()) as ArtifactRecordsMineResponse;
        setArtifactRecords(recJson.records ?? []);
      }
    } catch {
      /* best-effort only */
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
                <a
                  href="#"
                  onClick={navigateToCommandCenter}
                  className="flex w-fit items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300"
                >
                  Continue in Command Center
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Phase 2 (SPEC-MMC-002 §6.2) — the caller's own artifact_records
         software productions, now attributable via actor_commitment. An
         additional section, not a replacement: dev-loop-session cards above
         are unchanged. Rows produced before the 20260819000000 migration ran
         simply never appear (actor_commitment: null, correctly excluded —
         see the module header). Renders nothing (not even an empty-state
         line) when there are none, so a persona with zero productions today
         sees exactly the Phase 1 experience. */}
      {artifactRecords.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">
            Produced software artifacts
          </div>
          {artifactRecords.map((record) => (
            <div
              key={record.artifactId}
              className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-sm font-medium text-slate-200">{record.title}</span>
                  {record.artefactType && (
                    <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                      {record.artefactType}
                    </span>
                  )}
                </div>
                <span className="rounded border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] text-slate-400">
                  {record.consequenceClass}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Created {new Date(record.createdAt).toLocaleDateString()}
                  {record.runtimeHost ? ` · ${record.runtimeHost}` : ""}
                </span>
                <span className="font-mono">{record.contentHashPrefix}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <a
                  href="#"
                  onClick={navigateToCommandCenter}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                >
                  Continue in Command Center
                </a>
                {record.receiptId && (
                  <a
                    href="#"
                    onClick={navigateToMyLedger}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-300"
                  >
                    Inspect receipt {record.receiptId.slice(0, 10)}…
                  </a>
                )}
              </div>
            </div>
          ))}
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
