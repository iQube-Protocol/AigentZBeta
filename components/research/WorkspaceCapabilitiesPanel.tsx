"use client";

/**
 * WorkspaceCapabilitiesPanel — the Workspace Overview's role-projected
 * capability cards (2026-09-08, IRL OS Workspace consolidation).
 *
 * GENERALISED AROUND THE CANONICAL WORKSPACE, never a hardcoded EXP-P1/OCSGA
 * exception (operator instruction: "Austin/EXP-P1 and Ian/OCSGA are the
 * acceptance cases, not hardcoded exceptions" — restated, second pass:
 * "experimentId [is] one possible binding rather than a prerequisite").
 * Every section below renders per `GET /api/participation/workspace-
 * capabilities`'s own capability flags — never a per-workspace/per-experiment
 * `if` branch in this file. Two kinds of section:
 *   - EXPERIMENT-BOUND (Experimental Readiness, Reviewer Kit & Protocol,
 *     Review & Countersignature) — only when the workspace names a
 *     registered `EXPERIMENT_REGISTRY` entry AND the caller separately holds
 *     a grant scoped to it. Today only EXP-P1 qualifies for all three — a
 *     fact about what exists, not a special case in this component.
 *   - WORKSPACE-BOUND (Reciprocal Artifact Exchange) — keyed directly off
 *     `workspaceId`, no `experimentId` required at all. OCSGA qualifies for
 *     this one, and only this one, today.
 *
 * COMPOSITION, NOT A NEW VIEWER: "Experimental Readiness" mounts the
 * existing `ExpP1ReadinessTab` (now reachable to a scoped reviewer, not just
 * admin — see the loosened gate on `/api/research/readiness/[experimentId]`).
 * "Reviewer Kit & Protocol" reads the SAME already-authorized
 * `/api/codex/packs/irl/file` route the Phase 2 scoped-reviewer restoration
 * (2026-09-08) opened up, rendered inline (never a browser-tab download) so
 * the reviewer never has to leave the cartridge. "Review & Countersignature"
 * mounts the existing `ReviewerAgreementPanel`. "Reciprocal Artifact
 * Exchange" mounts the existing, already-generic `IRLExchangeTab`.
 *
 * Fail-closed by composition: every fetch here goes through `personaFetch`
 * to routes that independently re-verify the caller's grant server-side —
 * this component renders nothing it cannot actually back with a real,
 * server-checked read (Security invariant: "an experiment/artifact must
 * never be advertised unless the same principal can dereference it").
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronRight, FileText, Gauge, Loader2, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { personaFetch } from "@/utils/personaSpine";
import { ReviewerAgreementPanel } from "@/components/research/ReviewerAgreementPanel";

const ExpP1ReadinessTab = dynamic(() => import("@/components/composer/ExpP1ReadinessTab"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading readiness…</span>,
});

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
  documents: WorkspaceDocument[];
  readinessAvailable: boolean;
  reviewAgreementAvailable: boolean;
  exchangeAvailable: boolean;
}

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

export function DocumentRow({ doc }: { doc: WorkspaceDocument }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
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

export function WorkspaceCapabilitiesPanel({ workspaceId, personaId }: WorkspaceCapabilitiesPanelProps) {
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
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> Checking experiment capabilities…
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
  if (
    !data.exchangeAvailable &&
    data.documents.length === 0 &&
    !data.readinessAvailable &&
    !data.reviewAgreementAvailable
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {data.exchangeAvailable && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ArrowLeftRight className="h-4 w-4 text-violet-300" /> Reciprocal Artifact Exchange
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Your own frozen/exchanged architecture artifacts for this workspace — the same canonical exchange
            surface, scoped to what you are already a party to here.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
            <IRLExchangeTab workspaceScopeId={workspaceId} />
          </div>
        </div>
      )}
      {data.readinessAvailable && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-violet-300" /> Experimental Readiness
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            PRD-EPI-001 §10 — the same readiness sections the Laboratory dashboard shows an admin, scoped to your
            own reviewer grant for {data.experimentId}.
          </p>
          <div className="mt-3">
            <ExpP1ReadinessTab personaId={personaId} />
          </div>
        </div>
      )}
      {data.documents.length > 0 && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileText className="h-4 w-4 text-violet-300" /> Reviewer Kit &amp; Protocol
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            The registered protocol and reviewer documentation for {data.experimentId} — read inline, never a
            browser-tab download.
          </p>
          <div className="mt-3 space-y-1.5">
            {data.documents.map((doc) => (
              <DocumentRow key={doc.path} doc={doc} />
            ))}
          </div>
        </div>
      )}
      {data.reviewAgreementAvailable && data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Review &amp; Countersignature
          </h3>
          <div className="mt-3">
            <ReviewerAgreementPanel experimentId={data.experimentId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceCapabilitiesPanel;
