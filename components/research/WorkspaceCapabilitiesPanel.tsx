"use client";

/**
 * WorkspaceCapabilitiesPanel — the Workspace Overview's WORKSPACE-BOUND
 * capability section (2026-09-08, IRL OS Workspace consolidation; refactored
 * 2026-09-12, information-architecture correction).
 *
 * INFORMATION-ARCHITECTURE CORRECTION (2026-09-12, operator instruction
 * verbatim: "you have taken most of the authorized Laboratory content and
 * rendered it sequentially underneath EXP-P1... one canonical state/artifact
 * -> one primary Workspace home -> lightweight status/reference elsewhere").
 * This component used to ALSO render Experimental Readiness, Reviewer Kit,
 * Review & Countersignature, Instrument Validation, Track 2, and Crystal +
 * Independent Review — every one of them a DUPLICATE of that content's real
 * canonical home:
 *   - Readiness/Reviewer-Kit/Countersignature are the Review surface's own
 *     content, already rendered there straight from the canonical
 *     `selectedWorkspaceState` resolver (`liveState` in
 *     PartnerProgrammesTab.tsx) — this component re-fetching and re-rendering
 *     them in Overview was a second, redundant projection of the SAME state.
 *   - Instrument Validation (IRV-001/IPV-001) is NOT part of EXP-P1's own
 *     dossier — it now renders under the Validation Programme v1 workspace's
 *     own Experiments tab (PartnerProgrammesTab.tsx), never nested under
 *     EXP-P1.
 *   - Crystal + Independent Review (`CrystalObserverReviewPanel`) is Austin's
 *     actual review action — it now renders on the Review surface, replacing
 *     the readiness-only mount that used to live there.
 *   - Track 2's full inspection UI has no Workspace home yet at all (the
 *     Laboratory's Track 2 Programme has no corresponding Workspace entity in
 *     the research-workspace registry) — deliberately NOT wired anywhere in
 *     Workspace rather than mis-homed under EXP-P1; named as an open gap.
 *
 * What remains here, and what was ADDED:
 *   - Reciprocal Artifact Exchange (WORKSPACE-bound, keyed off `workspaceId`
 *     directly, no `experimentId` needed — OCSGA's own concern, untouched by
 *     this pass) — same as before.
 *   - A compact `WorkspaceDependencyStatus` (2026-09-12, new) — the ONLY
 *     experiment-bound content Overview keeps: a capability badge, the
 *     frozen Crystal's real generation + next governed action (a one-line
 *     REFERENCE, never the full Crystal UI), and a pointer to Instrument
 *     Validation's real home. Every field comes from
 *     `GET /api/participation/workspace-capabilities`, which does not
 *     duplicate `selectedWorkspaceState`'s own fields (readiness/documents/
 *     reviewAgreement) any more — it now returns ONLY the fields Overview
 *     genuinely needs and no other canonical resolver already provides.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronRight, FileText, Gem, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { personaFetch } from "@/utils/personaSpine";

// Reciprocal Artifact Exchange (PRD-IRL-AX-001) — the WORKSPACE-BOUND
// capability (2026-09-08, generalization pass): keyed directly off
// workspaceId via `parentExperimentId`, never requires an `experimentId`
// binding. Reuses the SAME generic tab every other exchange entrance mounts
// (IRLExchangeTab.tsx's own header: "not architecture- or OCSGA-specific") —
// no fork, just scoped via its existing `workspaceScopeId` prop.
const IRLExchangeTab = dynamic(
  () => import("@/app/triad/components/codex/tabs/IRLExchangeTab").then((m) => ({ default: m.IRLExchangeTab })),
  { ssr: false, loading: () => <span className="text-[10px] text-slate-400">Loading exchange…</span> },
);

export interface WorkspaceDocument {
  path: string;
  url: string;
}

interface CapabilitiesPayload {
  experimentId: string | null;
  instrumentValidationAvailable: boolean;
  /** The ordinary-ladder rung this caller holds at this experiment
   *  (`resolveEffectiveExperimentCapability`) — 'admin' for a platform
   *  admin, otherwise the highest of run/write/review this persona's
   *  capability rows grant, or 'read' with none. Never inferred from which
   *  sections happen to be visible — it is returned by the server so the
   *  badge below can never say something the gate itself would refuse. */
  effectiveCapability: "read" | "review" | "write" | "run" | "admin";
  /** The frozen Crystal's OWN generation label ("vP2"), or null when not
   *  frozen / unreadable. A one-line REFERENCE — the full Crystal UI lives
   *  in the Review surface's Crystal + Independent Review section, never
   *  duplicated here. */
  crystalGeneration: string | null;
  crystalFrozen: boolean;
  nextGovernedAction: string | null;
  exchangeAvailable: boolean;
}

const CAPABILITY_BADGE: Record<CapabilitiesPayload["effectiveCapability"], { label: string; className: string }> = {
  read: { label: "Read access", className: "border-slate-700 bg-slate-800/60 text-slate-300" },
  review: { label: "Review access", className: "border-violet-500/40 bg-violet-500/10 text-violet-200" },
  write: { label: "Write access", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  run: { label: "Run access", className: "border-blue-500/40 bg-blue-500/10 text-blue-200" },
  admin: { label: "Administrator", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
};

type CapabilitiesState =
  | { kind: "loading" }
  | { kind: "ready"; data: CapabilitiesPayload }
  | { kind: "denied" }
  | { kind: "error" };

export interface WorkspaceCapabilitiesPanelProps {
  workspaceId: string;
  personaId?: string;
}

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm";

export function DocumentRow({
  doc,
  autoOpen,
  highlighted,
}: {
  doc: WorkspaceDocument;
  /** Auto-expand on mount — the navigation contract's `selectedArtifactId`
   *  (message 3 item 9) landed here: the caller navigated to THIS document
   *  specifically, so it opens without a second click. */
  autoOpen?: boolean;
  /** Visual marker for the same navigated-to document — distinct from
   *  `autoOpen` because a caller could highlight without forcing content to
   *  load, though every current use passes both together. */
  highlighted?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    setOpen((prev) => !prev);
    if (!open && content === null && !loading) {
      setLoading(true);
      try {
        const res = await personaFetch(doc.url, { cache: "no-store" });
        setContent(res.ok ? await res.text() : `Could not load this document (HTTP ${res.status}).`);
      } catch (e) {
        setContent(e instanceof Error ? e.message : "Could not load this document.");
      } finally {
        setLoading(false);
      }
    }
  }, [open, content, loading, doc.url]);

  // Load content immediately when auto-opened — `toggle`'s own lazy-load
  // only fires from a click, so a navigated-to document would otherwise
  // render expanded but empty until the caller clicked it again.
  useEffect(() => {
    if (autoOpen) void toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`rounded-lg border bg-slate-900/40 ${highlighted ? "border-violet-500/50 ring-1 ring-violet-500/30" : "border-slate-800"}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <FileText className="h-3.5 w-3.5 shrink-0 text-violet-300" />
        <span className="truncate">{doc.path}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-slate-800 px-3 py-2">
          {loading ? (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </span>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300">{content}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceCapabilitiesPanel({ workspaceId, personaId: _personaId }: WorkspaceCapabilitiesPanelProps) {
  const [state, setState] = useState<CapabilitiesState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await personaFetch(
          `/api/participation/workspace-capabilities?workspaceId=${encodeURIComponent(workspaceId)}`,
          { cache: "no-store" },
        );
        if (!alive) return;
        if (res.status === 403) {
          setState({ kind: "denied" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as CapabilitiesPayload & { ok: boolean };
        setState({ kind: "ready", data });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  if (state.kind === "loading") {
    return (
      <div className={`${PANEL} p-4 text-xs text-slate-500`}>
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> Checking workspace capabilities…
      </div>
    );
  }
  if (state.kind === "denied" || state.kind === "error") {
    // Honest absence, never a broken-looking card — a workspace this caller
    // cannot open should simply show nothing extra here (the workspace
    // itself is already entitlement-filtered upstream in "My Experiments").
    return null;
  }
  const { data } = state;
  if (!data.exchangeAvailable && !data.experimentId) {
    return null;
  }
  const badge = data.experimentId ? CAPABILITY_BADGE[data.effectiveCapability] : null;

  return (
    <div className="space-y-3">
      {data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Capability &amp; dependency status</h3>
            {badge && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-400">
            <p className="flex items-center gap-1.5">
              <Gem className="h-3 w-3 text-violet-300" />
              Crystal substrate:{" "}
              <span className="text-slate-200">
                {data.crystalGeneration
                  ? `${data.crystalGeneration} — ${data.crystalFrozen ? "frozen" : "not frozen"}`
                  : "not yet frozen"}
              </span>{" "}
              <span className="text-slate-600">— full inspection in Review</span>
            </p>
            {data.nextGovernedAction && (
              <p>
                Next governed action: <span className="text-slate-200">{data.nextGovernedAction}</span>
              </p>
            )}
            {data.instrumentValidationAvailable && (
              <p>
                Instrument validation: <span className="text-emerald-300">complete</span>{" "}
                <span className="text-slate-600">— see Validation Programme v1 for IRV-001/IPV-001 evidence</span>
              </p>
            )}
          </div>
        </div>
      )}
      {data.exchangeAvailable && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ArrowLeftRight className="h-4 w-4 text-violet-300" /> Reciprocal Artifact Exchange
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Frozen/exchanged architecture artifacts for this workspace — the same canonical exchange surface,
            scoped to exchanges you are a party to or that anyone with access to this workspace may view.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
            <IRLExchangeTab workspaceScopeId={workspaceId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceCapabilitiesPanel;
