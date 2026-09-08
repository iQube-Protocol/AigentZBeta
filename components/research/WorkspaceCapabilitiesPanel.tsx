"use client";

/**
 * WorkspaceCapabilitiesPanel — the Workspace Overview's role-projected
 * capability cards (2026-09-08, IRL OS Workspace consolidation).
 *
 * GENERALISED, never a hardcoded EXP-P1 exception (operator instruction:
 * "Austin/EXP-P1 and Ian/OCSGA are the acceptance cases, not hardcoded
 * exceptions"): every section below renders for ANY research workspace whose
 * `experimentId` qualifies, driven entirely by
 * `GET /api/participation/workspace-capabilities` — never a per-experiment
 * `if (experimentId === 'EXP-P1')` branch in this file. Today only EXP-P1
 * actually HAS a registered `irl`-pack protocol directory, a readiness
 * pipeline and a reviewer agreement, so it is the only workspace that
 * currently renders non-empty sections — that is a fact about what exists,
 * not a special case in this component.
 *
 * COMPOSITION, NOT A NEW VIEWER: "Experimental Readiness" mounts the
 * existing `ExpP1ReadinessTab` (now reachable to a scoped reviewer, not just
 * admin — see the loosened gate on `/api/research/readiness/[experimentId]`).
 * "Reviewer Kit & Protocol" reads the SAME already-authorized
 * `/api/codex/packs/irl/file` route the Phase 2 scoped-reviewer restoration
 * (2026-09-08) opened up, rendered inline (never a browser-tab download) so
 * the reviewer never has to leave the cartridge. "Review & Countersignature"
 * mounts the existing `ReviewerAgreementPanel`.
 *
 * Fail-closed by composition: every fetch here goes through `personaFetch`
 * to routes that independently re-verify the caller's grant server-side —
 * this component renders nothing it cannot actually back with a real,
 * server-checked read (Security invariant: "an experiment/artifact must
 * never be advertised unless the same principal can dereference it").
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Gauge, Loader2, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { personaFetch } from "@/utils/personaSpine";
import { ReviewerAgreementPanel } from "@/components/research/ReviewerAgreementPanel";

const ExpP1ReadinessTab = dynamic(() => import("@/components/composer/ExpP1ReadinessTab"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading readiness…</span>,
});

interface WorkspaceDocument {
  path: string;
  url: string;
}

interface CapabilitiesPayload {
  experimentId: string | null;
  documents: WorkspaceDocument[];
  readinessAvailable: boolean;
  reviewAgreementAvailable: boolean;
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

function DocumentRow({ doc }: { doc: WorkspaceDocument }) {
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
  if (!data.experimentId) return null;
  if (data.documents.length === 0 && !data.readinessAvailable && !data.reviewAgreementAvailable) return null;

  return (
    <div className="space-y-3">
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
      {data.reviewAgreementAvailable && (
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
